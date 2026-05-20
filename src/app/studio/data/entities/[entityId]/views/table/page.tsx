import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { TableViewForm } from "@/components/views/table-view-form";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import { entities, entityFields, tableViews } from "@/lib/db/schema";
import { resolveTableView } from "@/lib/views/table-view";

export const dynamic = "force-dynamic";

export default async function TableViewPage({
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

  const [fields, view] = await Promise.all([
    db
      .select()
      .from(entityFields)
      .where(eq(entityFields.entityId, entity.id))
      .orderBy(asc(entityFields.order)),
    db.query.tableViews.findFirst({
      where: and(eq(tableViews.entityId, entity.id), eq(tableViews.isDefault, true)),
    }),
  ]);
  const resolvedView = resolveTableView(view, fields);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${entity.name} table view`}
        description="Configure the runtime record list for this entity."
        actions={
          <Button asChild variant="outline">
            <Link href={`/studio/data/entities/${entity.id}`}>
              <ArrowLeft className="size-4" />
              Entity
            </Link>
          </Button>
        }
      />

      <TableViewForm
        entityId={entity.id}
        fields={fields.map((field) => ({
          id: field.id,
          name: field.name,
          slug: field.slug,
          type: field.type,
        }))}
        initialName={resolvedView.name}
        initialDescription={resolvedView.description}
        initialConfig={resolvedView.config}
      />
    </div>
  );
}
