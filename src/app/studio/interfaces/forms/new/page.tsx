import { FormBuilder } from "@/components/forms/form-builder";
import { PageHeader } from "@/components/shared/page-header";
import { requireResourceAccess } from "@/lib/auth/organization";
import { ensureDefaultApp } from "@/lib/data/modeling";
import { db } from "@/lib/db/client";
import { apps, entities, entityFields } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function NewFormPage() {
  const current = await requireResourceAccess("forms", "create");
  await ensureDefaultApp({
    orgId: current.organization.id,
    userId: current.userId,
  });
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
        title="New form"
        description="Build a form from fields, configure validation, and publish when ready."
      />
      <FormBuilder apps={appOptions} entities={entityOptions} />
    </div>
  );
}
