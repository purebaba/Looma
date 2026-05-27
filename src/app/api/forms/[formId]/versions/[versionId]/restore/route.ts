import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { routeError } from "@/lib/api/responses";
import { requireResourceAccess } from "@/lib/auth/organization";
import { ensureDefaultApp, ensureEntityForForm } from "@/lib/data/modeling";
import { db } from "@/lib/db/client";
import { apps, formVersions, forms } from "@/lib/db/schema";
import type { FormSchema } from "@/lib/forms/field-schema";
import { sanitizeFormSettings } from "@/lib/forms/settings";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ formId: string; versionId: string }> }
) {
  try {
    const { formId, versionId } = await params;
    const current = await requireResourceAccess("forms", "update");
    const existing = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    const version = await db.query.formVersions.findFirst({
      where: and(
        eq(formVersions.id, versionId),
        eq(formVersions.formId, existing.id)
      ),
    });

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const app =
      (existing.appId
        ? await db.query.apps.findFirst({
            where: and(
              eq(apps.id, existing.appId),
              eq(apps.orgId, current.organization.id)
            ),
          })
        : null) ||
      (await ensureDefaultApp({
        orgId: current.organization.id,
        userId: current.userId,
      }));
    const restoredSchema = version.schema as FormSchema;
    const model = await ensureEntityForForm({
      orgId: current.organization.id,
      appId: app.id,
      userId: current.userId,
      formName: version.name,
      entityId: existing.entityId,
      schema: restoredSchema,
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

    return NextResponse.json({ form, restoredFromVersion: version.version });
  } catch (error) {
    return routeError(error);
  }
}
