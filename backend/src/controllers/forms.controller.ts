import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { and, count, desc, eq, inArray } from "drizzle-orm";

import { AccessService } from "../auth/access.service";
import { canAccess } from "@/lib/auth/permissions";
import {
  createRecordAndSubmission,
  ensureDefaultApp,
  ensureEntityForForm,
  updateRecordAndSubmission,
} from "@/lib/data/modeling";
import { db } from "@/lib/db/client";
import { apps, entities, formSubmissions, formVersions, forms } from "@/lib/db/schema";
import type { FormSchema } from "@/lib/forms/field-schema";
import { validateForm } from "@/lib/forms/field-schema";
import { reconcileSchemaWithPublishedBaseline } from "@/lib/forms/schema-governance";
import {
  checkSubmissionRateLimit,
  hasHoneypotValue,
} from "@/lib/forms/submission-guard";
import {
  filterSubmissions,
  filterSubmissionsByStatus,
  sortSubmissions,
  submissionsToCsv,
} from "@/lib/forms/submissions";
import { sanitizeFormSettings } from "@/lib/forms/settings";
import {
  createPublishedFormVersion,
  formVersionSchema,
  formVersionSettings,
  getLatestPublishedFormVersion,
} from "@/lib/forms/versions";

function clientIp(request: Request) {
  const headers = request.headers as Headers & Record<string, string | undefined>;
  const forwardedFor =
    typeof headers.get === "function"
      ? headers.get("x-forwarded-for")
      : headers["x-forwarded-for"];
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null;
  return (
    (typeof headers.get === "function" ? headers.get("x-real-ip") : headers["x-real-ip"]) ||
    (typeof headers.get === "function"
      ? headers.get("cf-connecting-ip")
      : headers["cf-connecting-ip"]) ||
    null
  );
}

function filenameFor(name: string) {
  return `${name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "form"}-responses.csv`;
}

@Controller("forms")
export class FormsController {
  constructor(@Inject(AccessService) private readonly access: AccessService) {}

  @Get()
  async list(@Req() request: Request) {
    const current = await this.access.requireResourceAccess(request, "forms", "read");
    const rows = await db
      .select()
      .from(forms)
      .where(eq(forms.orgId, current.organization.id))
      .orderBy(desc(forms.createdAt));

    const items = await Promise.all(
      rows.map(async (form) => {
        const [submissionCount] = await db
          .select({ value: count() })
          .from(formSubmissions)
          .where(eq(formSubmissions.formId, form.id));
        const entity = form.entityId
          ? await db.query.entities.findFirst({ where: eq(entities.id, form.entityId) })
          : null;
        return {
          ...form,
          entityName: entity?.name ?? null,
          submissionCount: submissionCount?.value ?? 0,
        };
      })
    );
    return { forms: items };
  }

  @Post()
  async create(@Req() request: Request, @Body() body: Record<string, unknown>) {
    const current = await this.access.requireResourceAccess(request, "forms", "create");
    const name = String(body.name || "").trim();
    if (!name) throw new BadRequestException("Name is required");

    const requestedApp = body.appId
      ? await db.query.apps.findFirst({
          where: and(
            eq(apps.id, String(body.appId)),
            eq(apps.orgId, current.organization.id)
          ),
        })
      : null;
    const app =
      requestedApp ||
      (await ensureDefaultApp({
        orgId: current.organization.id,
        userId: current.userId,
      }));
    const schema = (body.schema || { fields: [] }) as FormSchema;
    const model = await ensureEntityForForm({
      orgId: current.organization.id,
      appId: app.id,
      userId: current.userId,
      formName: name,
      entityId: body.entityId ? String(body.entityId) : null,
      schema,
    });
    const [form] = await db
      .insert(forms)
      .values({
        orgId: current.organization.id,
        appId: app.id,
        entityId: model.entity.id,
        createdBy: current.userId,
        name,
        description: body.description ? String(body.description) : null,
        schema: model.schema,
        settings: sanitizeFormSettings(body.settings),
      })
      .returning();
    return { form };
  }

  @Get(":formId")
  async get(@Req() request: Request, @Param("formId") formId: string) {
    const current = await this.access.requireResourceAccess(request, "forms", "read");
    const form = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
    });
    if (!form) throw new NotFoundException("Form not found");
    return { form };
  }

  @Put(":formId")
  async update(
    @Req() request: Request,
    @Param("formId") formId: string,
    @Body() body: Record<string, unknown>
  ) {
    const current = await this.access.requireResourceAccess(request, "forms", "update");
    const name = String(body.name || "").trim();
    if (!name) throw new BadRequestException("Name is required");

    const existing = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
    });
    if (!existing) throw new NotFoundException("Form not found");

    const requestedApp = body.appId
      ? await db.query.apps.findFirst({
          where: and(
            eq(apps.id, String(body.appId)),
            eq(apps.orgId, current.organization.id)
          ),
        })
      : null;
    const app =
      requestedApp ||
      (existing.appId
        ? await db.query.apps.findFirst({
            where: and(eq(apps.id, existing.appId), eq(apps.orgId, current.organization.id)),
          })
        : null) ||
      (await ensureDefaultApp({
        orgId: current.organization.id,
        userId: current.userId,
      }));
    const latestPublishedVersion = await getLatestPublishedFormVersion(existing.id);
    const governed = reconcileSchemaWithPublishedBaseline({
      incomingSchema: (body.schema || { fields: [] }) as FormSchema,
      baselineSchema: latestPublishedVersion ? formVersionSchema(latestPublishedVersion) : null,
    });
    if (governed.issues.length > 0) {
      throw new ConflictException({
        error: "Form schema has unsafe published field changes",
        issues: governed.issues,
      });
    }

    const model = await ensureEntityForForm({
      orgId: current.organization.id,
      appId: app.id,
      userId: current.userId,
      formName: name,
      entityId: body.entityId ? String(body.entityId) : existing.entityId,
      schema: governed.schema,
    });
    const [form] = await db
      .update(forms)
      .set({
        appId: app.id,
        entityId: model.entity.id,
        name,
        description: body.description ? String(body.description) : null,
        schema: model.schema,
        settings: sanitizeFormSettings(body.settings),
        status: existing.status === "published" ? "draft" : existing.status,
        version:
          existing.status === "published" ? (existing.version ?? 1) + 1 : existing.version,
        publishedAt: existing.status === "published" ? null : existing.publishedAt,
        updatedAt: new Date(),
      })
      .where(and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)))
      .returning();
    return { form };
  }

  @Patch(":formId")
  async patch(
    @Req() request: Request,
    @Param("formId") formId: string,
    @Body() body: Record<string, unknown>
  ) {
    const current = await this.access.requireResourceAccess(request, "forms", "update");
    const status = String(body.status || "");
    if (!["draft", "archived"].includes(status)) {
      throw new BadRequestException("Invalid form status");
    }
    const nextStatus = status as "draft" | "archived";
    const [form] = await db
      .update(forms)
      .set(
        nextStatus === "archived"
          ? { status: nextStatus, publishedAt: null, updatedAt: new Date() }
          : { status: nextStatus, updatedAt: new Date() }
      )
      .where(and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)))
      .returning();
    if (!form) throw new NotFoundException("Form not found");
    return { form };
  }

  @Delete(":formId")
  async remove(@Req() request: Request, @Param("formId") formId: string) {
    const current = await this.access.requireResourceAccess(request, "forms", "delete");
    const [form] = await db
      .delete(forms)
      .where(and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)))
      .returning();
    if (!form) throw new NotFoundException("Form not found");
    return { success: true };
  }

  @Post(":formId/publish")
  async publish(@Req() request: Request, @Param("formId") formId: string) {
    const current = await this.access.requireResourceAccess(request, "forms", "publish");
    const existing = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
    });
    if (!existing) throw new NotFoundException("Form not found");

    const existingApp = existing.appId
      ? await db.query.apps.findFirst({ where: eq(apps.id, existing.appId) })
      : null;
    const app =
      existingApp ||
      (await ensureDefaultApp({
        orgId: current.organization.id,
        userId: current.userId,
      }));
    const latestPublishedVersion = await getLatestPublishedFormVersion(existing.id);
    const governed = reconcileSchemaWithPublishedBaseline({
      incomingSchema: existing.schema as FormSchema,
      baselineSchema: latestPublishedVersion ? formVersionSchema(latestPublishedVersion) : null,
    });
    if (governed.issues.length > 0) {
      throw new ConflictException({
        error: "Form schema has unsafe published field changes",
        issues: governed.issues,
      });
    }

    const model = await ensureEntityForForm({
      orgId: current.organization.id,
      appId: app.id,
      userId: current.userId,
      formName: existing.name,
      entityId: existing.entityId,
      schema: governed.schema,
    });
    const [form] = await db
      .update(forms)
      .set({
        appId: app.id,
        entityId: model.entity.id,
        schema: model.schema,
        status: "published",
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)))
      .returning();
    if (!form) throw new NotFoundException("Form not found");
    const version = await createPublishedFormVersion({
      form,
      publishedBy: current.userId,
    });
    return { form, version };
  }

  @Get(":formId/submissions")
  async submissions(
    @Req() request: Request,
    @Param("formId") formId: string,
    @Query("status") status?: string
  ) {
    const current = await this.access.requireResourceAccess(request, "forms", "read");
    const form = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
    });
    if (!form) throw new NotFoundException("Form not found");
    const submissions = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, formId))
      .orderBy(desc(formSubmissions.createdAt));
    return { submissions: status ? filterSubmissionsByStatus(submissions, status) : submissions };
  }

  @Patch(":formId/submissions/bulk")
  async bulkSubmissions(
    @Req() request: Request,
    @Param("formId") formId: string,
    @Body() body: Record<string, unknown>
  ) {
    const current = await this.access.requireResourceAccess(request, "forms", "update");
    const status = String(body.status || "");
    const submissionIds = Array.isArray(body.submissionIds)
      ? body.submissionIds.filter((id): id is string => typeof id === "string")
      : [];
    if (!["active", "archived"].includes(status)) {
      throw new BadRequestException("Invalid submission status");
    }
    if (submissionIds.length === 0) {
      throw new BadRequestException("Select at least one response");
    }
    const form = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
    });
    if (!form) throw new NotFoundException("Form not found");
    const updatedSubmissions = await db
      .update(formSubmissions)
      .set({ status })
      .where(and(eq(formSubmissions.formId, form.id), inArray(formSubmissions.id, submissionIds)))
      .returning();
    return { count: updatedSubmissions.length, submissions: updatedSubmissions };
  }

  @Patch(":formId/submissions/:submissionId")
  async updateSubmission(
    @Req() request: Request,
    @Param("formId") formId: string,
    @Param("submissionId") submissionId: string,
    @Body() body: Record<string, unknown>
  ) {
    const current = await this.access.requireResourceAccess(request, "forms", "update");
    const status = String(body.status || "");
    if (!["active", "archived"].includes(status)) {
      throw new BadRequestException("Invalid submission status");
    }
    const form = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
    });
    if (!form) throw new NotFoundException("Form not found");
    const [submission] = await db
      .update(formSubmissions)
      .set({ status })
      .where(and(eq(formSubmissions.id, submissionId), eq(formSubmissions.formId, form.id)))
      .returning();
    if (!submission) throw new NotFoundException("Submission not found");
    return { submission };
  }

  @Get(":formId/submissions/export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  async exportSubmissions(
    @Req() request: Request,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
    @Param("formId") formId: string,
    @Query() query: Record<string, string | string[] | undefined>
  ) {
    const current = await this.access.requireResourceAccess(request, "forms", "read");
    const form = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
    });
    if (!form) throw new NotFoundException("Form not found");
    const submissions = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, form.id))
      .orderBy(desc(formSubmissions.createdAt));
    const versions = await db.select().from(formVersions).where(eq(formVersions.formId, form.id));
    const versionsById = new Map(versions.map((version) => [version.id, version]));
    const publishedVersion = await getLatestPublishedFormVersion(form.id);
    const schema = publishedVersion ? formVersionSchema(publishedVersion) : (form.schema as FormSchema);
    const arrayQuery = (key: string) => {
      const value = query[key];
      return Array.isArray(value) ? value : value ? [value] : [];
    };
    const selectedSubmissionSet = new Set(arrayQuery("submissionId"));
    const filteredSubmissions = sortSubmissions(
      filterSubmissions({
        schema,
        submissions: filterSubmissionsByStatus(
          submissions,
          typeof query.status === "string" ? query.status : undefined
        ),
        query: typeof query.q === "string" ? query.q : undefined,
        fieldId: typeof query.fieldId === "string" ? query.fieldId : undefined,
        fieldValue: typeof query.fieldValue === "string" ? query.fieldValue : undefined,
        versionsById,
      }),
      query.sort === "asc" ? "asc" : "desc"
    ).filter(
      (submission) => selectedSubmissionSet.size === 0 || selectedSubmissionSet.has(submission.id)
    );
    response.setHeader("Content-Disposition", `attachment; filename="${filenameFor(form.name)}"`);
    return submissionsToCsv({
      schema,
      submissions: filteredSubmissions,
      versionsById,
      fieldIds: arrayQuery("exportField"),
    });
  }

  @Post(":formId/versions/:versionId/restore")
  async restoreVersion(
    @Req() request: Request,
    @Param("formId") formId: string,
    @Param("versionId") versionId: string
  ) {
    const current = await this.access.requireResourceAccess(request, "forms", "update");
    const existing = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
    });
    if (!existing) throw new NotFoundException("Form not found");
    const version = await db.query.formVersions.findFirst({
      where: and(eq(formVersions.id, versionId), eq(formVersions.formId, existing.id)),
    });
    if (!version) throw new NotFoundException("Version not found");
    const app =
      (existing.appId
        ? await db.query.apps.findFirst({
            where: and(eq(apps.id, existing.appId), eq(apps.orgId, current.organization.id)),
          })
        : null) ||
      (await ensureDefaultApp({
        orgId: current.organization.id,
        userId: current.userId,
      }));
    const model = await ensureEntityForForm({
      orgId: current.organization.id,
      appId: app.id,
      userId: current.userId,
      formName: version.name,
      entityId: existing.entityId,
      schema: version.schema as FormSchema,
    });
    const [form] = await db
      .update(forms)
      .set({
        appId: app.id,
        entityId: model.entity.id,
        name: version.name,
        description: version.description,
        schema: model.schema,
        settings: sanitizeFormSettings(version.settings),
        status: "draft",
        version: (existing.version ?? 1) + 1,
        publishedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)))
      .returning();
    return { form, restoredFromVersion: version.version };
  }

  @Post(":formId/submit")
  @HttpCode(201)
  async submit(
    @Req() request: Request,
    @Param("formId") formId: string,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
    @Body() body: Record<string, unknown>
  ) {
    const form = await db.query.forms.findFirst({ where: eq(forms.id, formId) });
    const publishedVersion = form ? await getLatestPublishedFormVersion(form.id) : null;
    if (!form || form.status === "archived" || !publishedVersion) {
      throw new NotFoundException("Form not found");
    }
    const settings = formVersionSettings(publishedVersion);
    if (!settings.collectingEnabled) {
      throw new ConflictException("Form is not accepting responses");
    }
    if (hasHoneypotValue(body)) throw new BadRequestException("Invalid submission");
    const ipAddress = clientIp(request);
    const rateLimit = checkSubmissionRateLimit({ formId, clientIp: ipAddress });
    if (!rateLimit.allowed) {
      response.setHeader("Retry-After", String(rateLimit.retryAfter));
      throw new HttpException(
        "Too many submissions. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const data = (body.data || {}) as Record<string, unknown>;
    const schema = formVersionSchema(publishedVersion);
    const validation = validateForm(data, schema);
    if (!validation.valid) {
      throw new BadRequestException({ error: "Invalid submission", errors: validation.errors });
    }
    if (!form.appId || !form.entityId) {
      throw new ConflictException("Form is not bound to a data entity");
    }

    const recordId =
      typeof body.recordId === "string"
        ? body.recordId
        : typeof body.entityRecordId === "string"
          ? body.entityRecordId
          : null;

    if (recordId) {
      const current = await this.access.getCurrentOrganization(request);
      if (!current) throw new BadRequestException("Authentication required");
      if (!canAccess(current.membership.role, "data", "update")) {
        throw new BadRequestException("Forbidden");
      }
      if (current.organization.id !== form.orgId) throw new NotFoundException("Form not found");
      const result = await updateRecordAndSubmission({
        form,
        recordId,
        data,
        schema,
        formVersionId: publishedVersion.id,
        submittedBy: current.userId,
        ipAddress,
        userAgent: (request.headers as Headers).get?.("user-agent") || null,
      });
      if (!result) throw new NotFoundException("Record not found");
      return {
        submission: result.submission,
        submissionId: result.submission.id,
        recordId: result.record.id,
      };
    }

    const userId = await this.access.getUserId(request);
    const { record, submission } = await createRecordAndSubmission({
      form,
      data,
      schema,
      formVersionId: publishedVersion.id,
      submittedBy: userId || undefined,
      ipAddress,
      userAgent: (request.headers as Headers).get?.("user-agent") || null,
    });
    return { submission, submissionId: submission.id, recordId: record.id };
  }
}
