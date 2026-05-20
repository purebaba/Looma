import { and, asc, eq } from "drizzle-orm";

import { FormBuilder } from "@/components/forms/form-builder";
import { PageHeader } from "@/components/shared/page-header";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import { apps, entities, entityFields, forms } from "@/lib/db/schema";
import type { FormSchema } from "@/lib/forms/field-schema";

export const dynamic = "force-dynamic";

export default async function EditFormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  const current = await requireResourceAccess("forms", "update");
  const form = await db.query.forms.findFirst({
    where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
  });

  if (!form) {
    return (
      <PageHeader
        title="Form not found"
        description="This form does not exist in the current organization."
      />
    );
  }

  const [appOptions, entityRows] = await Promise.all([
    db
      .select({ id: apps.id, name: apps.name })
      .from(apps)
      .where(eq(apps.orgId, current.organization.id)),
    db
      .select()
      .from(entities)
      .where(eq(entities.orgId, current.organization.id)),
  ]);
  const entityOptions = await Promise.all(
    entityRows.map(async (entity) => ({
      id: entity.id,
      appId: entity.appId,
      name: entity.name,
      fields: await db
        .select({
          id: entityFields.id,
          name: entityFields.name,
          slug: entityFields.slug,
          type: entityFields.type,
          required: entityFields.required,
          config: entityFields.config,
          order: entityFields.order,
        })
        .from(entityFields)
        .where(eq(entityFields.entityId, entity.id))
        .orderBy(asc(entityFields.order)),
    }))
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Edit form"
        description="Update fields, preview the experience, and publish changes."
      />
      <FormBuilder
        apps={appOptions}
        entities={entityOptions}
        initialForm={{
          id: form.id,
          appId: form.appId,
          entityId: form.entityId,
          name: form.name,
          description: form.description,
          schema: form.schema as FormSchema,
          status: form.status,
        }}
      />
    </div>
  );
}
