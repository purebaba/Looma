import Link from "next/link";
import { and, asc, count, eq } from "drizzle-orm";
import { ArrowLeft, Database, Plus } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireResourceAccess } from "@/server/lib/auth/organization";
import { db } from "@/server/lib/db/client";
import { apps, entities, entityFields, entityRecords } from "@/server/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function RuntimeAppPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = await params;
  const current = await requireResourceAccess("apps", "read");
  const app = await db.query.apps.findFirst({
    where: and(eq(apps.id, appId), eq(apps.orgId, current.organization.id)),
  });

  if (!app) {
    return (
      <PageHeader
        title="App not found"
        description="This app does not exist in the current organization."
      />
    );
  }

  const entityRows = await db
    .select()
    .from(entities)
    .where(eq(entities.appId, app.id))
    .orderBy(asc(entities.name));
  const items = await Promise.all(
    entityRows.map(async (entity) => {
      const [fieldCount] = await db
        .select({ value: count() })
        .from(entityFields)
        .where(eq(entityFields.entityId, entity.id));
      const [recordCount] = await db
        .select({ value: count() })
        .from(entityRecords)
        .where(eq(entityRecords.entityId, entity.id));
      return {
        ...entity,
        fieldCount: fieldCount?.value ?? 0,
        recordCount: recordCount?.value ?? 0,
      };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={app.name}
        description={app.description || "Business objects available in this app."}
        actions={
          <Button asChild variant="outline">
            <Link href="/app">
              <ArrowLeft className="size-4" />
              Apps
            </Link>
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No entities available"
          description="Add entities in Studio before using this app."
          action={
            <Button asChild>
              <Link href="/studio/data/entities/new">Create entity</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((entity) => (
            <Card key={entity.id}>
              <CardHeader>
                <CardTitle>{entity.name}</CardTitle>
                <CardDescription>
                  {entity.description || "Business records"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border p-3">
                    <div className="text-2xl font-semibold">{entity.fieldCount}</div>
                    <p className="text-muted-foreground">Fields</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-2xl font-semibold">{entity.recordCount}</div>
                    <p className="text-muted-foreground">Records</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button asChild className="flex-1">
                    <Link href={`/app/apps/${app.id}/entities/${entity.id}`}>
                      Open
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link
                      href={`/app/apps/${app.id}/entities/${entity.id}/records/new`}
                    >
                      <Plus className="size-4" />
                      New
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
