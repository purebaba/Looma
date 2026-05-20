import { and, asc, eq } from "drizzle-orm";

import { EntityForm } from "@/components/data/entity-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import { apps, entities, entityFields } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function EditEntityPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;
  const current = await requireResourceAccess("data", "update");
  const entity = await db.query.entities.findFirst({
    where: and(eq(entities.id, entityId), eq(entities.orgId, current.organization.id)),
  });

  if (!entity) {
    return (
      <PageHeader
        title="Entity not found"
        description="This entity does not exist in the current organization."
      />
    );
  }

  const [appOptions, fields] = await Promise.all([
    db
      .select({ id: apps.id, name: apps.name })
      .from(apps)
      .where(eq(apps.orgId, current.organization.id)),
    db
      .select()
      .from(entityFields)
      .where(eq(entityFields.entityId, entity.id))
      .orderBy(asc(entityFields.order)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Edit ${entity.name}`}
        description="Update the business model and field definitions."
      />
      <EntityForm
        apps={appOptions}
        initialEntity={{
          ...entity,
          fields: fields.map((field) => ({
            id: field.id,
            name: field.name,
            slug: field.slug,
            type: field.type,
            required: Boolean(field.required),
            unique: Boolean(field.unique),
          })),
        }}
      />
    </div>
  );
}
