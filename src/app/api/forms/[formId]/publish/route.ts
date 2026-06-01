import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { requireResourceAccess } from "@/lib/auth/organization";
import { ensureDefaultApp, ensureEntityForForm } from "@/lib/data/modeling";
import { db } from "@/lib/db/client";
import { apps, forms } from "@/lib/db/schema";
import type { FormSchema } from "@/lib/forms/field-schema";
import { reconcileSchemaWithPublishedBaseline } from "@/lib/forms/schema-governance";
import {
  createPublishedFormVersion,
  formVersionSchema,
  getLatestPublishedFormVersion,
} from "@/lib/forms/versions";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;
    const current = await requireResourceAccess("forms", "publish");
    const existing = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    const existingApp = existing.appId
      ? await db.query.apps.findFirst({ where: eq(apps.id, existing.appId) })
      : null;
    const app = existingApp || (await ensureDefaultApp({
      orgId: current.organization.id,
      userId: current.userId,
    }));
    const latestPublishedVersion = await getLatestPublishedFormVersion(existing.id);
    const governed = reconcileSchemaWithPublishedBaseline({
      incomingSchema: existing.schema as FormSchema,
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

    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
    const version = await createPublishedFormVersion({
      form,
      publishedBy: current.userId,
    });
    return NextResponse.json({ form, version });
  } catch (error) {
    return routeError(error);
  }
}
