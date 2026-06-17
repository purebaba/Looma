import { and, asc, eq } from "drizzle-orm";

import { RecordForm } from "@/components/data/record-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireResourceAccess } from "@/server/lib/auth/organization";
import { db } from "@/server/lib/db/client";
import { entities, entityFields } from "@/server/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function NewRecordPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;
  const current = await requireResourceAccess("data", "create");
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

  const fields = await db
    .select()
    .from(entityFields)
    .where(eq(entityFields.entityId, entity.id))
    .orderBy(asc(entityFields.order));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`New ${entity.name} record`}
        description="Create a business record manually."
      />
      <RecordForm entityId={entity.id} fields={fields} />
    </div>
  );
}
