import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { requireResourceAccess } from "@/lib/auth/organization";
import { ensureDefaultApp, ensureEntityForForm } from "@/lib/data/modeling";
import { db } from "@/lib/db/client";
import { apps, forms } from "@/lib/db/schema";
import type { FormSchema } from "@/lib/forms/field-schema";
import { reconcileSchemaWithPublishedBaseline } from "@/lib/forms/schema-governance";
import { sanitizeFormSettings } from "@/lib/forms/settings";
import { getLatestPublishedFormVersion, formVersionSchema } from "@/lib/forms/versions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;
    const current = await requireResourceAccess("forms", "read");
    const form = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
    });

    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
    return NextResponse.json({ form });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;
    const current = await requireResourceAccess("forms", "update");
    const body = await request.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const existing = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    const requestedApp = body.appId
      ? await db.query.apps.findFirst({
          where: and(
            eq(apps.id, String(body.appId)),
            eq(apps.orgId, current.organization.id)
          ),
        })
      : null;
    const app = requestedApp || (existing.appId
      ? await db.query.apps.findFirst({
          where: and(eq(apps.id, existing.appId), eq(apps.orgId, current.organization.id)),
        })
      : null) || (await ensureDefaultApp({
      orgId: current.organization.id,
      userId: current.userId,
    }));
    const incomingSchema = (body.schema || { fields: [] }) as FormSchema;
    const latestPublishedVersion = await getLatestPublishedFormVersion(existing.id);
    const governed = reconcileSchemaWithPublishedBaseline({
      incomingSchema,
      baselineSchema: latestPublishedVersion
        ? formVersionSchema(latestPublishedVersion)
        : null,
    });

    if (governed.issues.length > 0) {
      return NextResponse.json(
        {
          error: "Form schema has unsafe published field changes",
          issues: governed.issues,
        },
        { status: 409 }
      );
    }

    const model = await ensureEntityForForm({
      orgId: current.organization.id,
      appId: app.id,
      userId: current.userId,
      formName: name,
      entityId: body.entityId || existing.entityId,
      schema: governed.schema,
    });

    const [form] = await db
      .update(forms)
      .set({
        appId: app.id,
        entityId: model.entity.id,
        name,
        description: body.description || null,
        schema: model.schema,
        settings: sanitizeFormSettings(body.settings),
        status: existing.status === "published" ? "draft" : existing.status,
        version:
          existing.status === "published"
            ? (existing.version ?? 1) + 1
            : existing.version,
        publishedAt: existing.status === "published" ? null : existing.publishedAt,
        updatedAt: new Date(),
      })
      .where(and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)))
      .returning();

    return NextResponse.json({ form });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;
    const current = await requireResourceAccess("forms", "update");
    const body = await request.json();
    const status = String(body.status || "");

    if (!["draft", "archived"].includes(status)) {
      return NextResponse.json({ error: "Invalid form status" }, { status: 400 });
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

    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
    return NextResponse.json({ form });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;
    const current = await requireResourceAccess("forms", "delete");
    const [form] = await db
      .delete(forms)
      .where(and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)))
      .returning();

    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
