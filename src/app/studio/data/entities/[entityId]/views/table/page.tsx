import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableViewForm } from "@/components/views/table-view-form";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import { entities, entityFields, tableViews } from "@/lib/db/schema";
import { resolveTableView } from "@/lib/views/table-view";

export const dynamic = "force-dynamic";

export default async function TableViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ entityId: string }>;
  searchParams: Promise<{ viewId?: string }>;
}) {
  const { entityId } = await params;
  const query = await searchParams;
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

  const [fields, views] = await Promise.all([
    db
      .select()
      .from(entityFields)
      .where(eq(entityFields.entityId, entity.id))
      .orderBy(asc(entityFields.order)),
    db
      .select()
      .from(tableViews)
      .where(eq(tableViews.entityId, entity.id))
      .orderBy(asc(tableViews.createdAt)),
  ]);
  const selectedView =
    query.viewId === "new"
      ? null
      : views.find((view) => view.id === query.viewId) ||
        views.find((view) => view.isDefault) ||
        views[0] ||
        null;
  const resolvedView = resolveTableView(selectedView, fields);
  const isCreating = query.viewId === "new" || views.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${entity.name} table views`}
        description="Configure runtime record lists for this entity."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/studio/data/entities/${entity.id}`}>
                <ArrowLeft className="size-4" />
                Entity
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/studio/data/entities/${entity.id}/views/table?viewId=new`}>
                <Plus className="size-4" />
                New view
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Views</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {views.map((view) => (
              <Button
                key={view.id}
                asChild
                variant={selectedView?.id === view.id ? "default" : "outline"}
                className="justify-start"
              >
                <Link href={`/studio/data/entities/${entity.id}/views/table?viewId=${view.id}`}>
                  {view.name}
                  {view.isDefault ? " (default)" : ""}
                </Link>
              </Button>
            ))}
            {views.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved table views yet.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <TableViewForm
          entityId={entity.id}
          viewId={selectedView?.id}
          fields={fields.map((field) => ({
            id: field.id,
            name: field.name,
            slug: field.slug,
            type: field.type,
          }))}
          initialName={isCreating ? "New table view" : resolvedView.name}
          initialDescription={isCreating ? "" : resolvedView.description}
          initialConfig={resolvedView.config}
          initialIsDefault={isCreating ? views.length === 0 : Boolean(selectedView?.isDefault)}
          mode={isCreating ? "create" : "update"}
        />
      </div>
    </div>
  );
}
