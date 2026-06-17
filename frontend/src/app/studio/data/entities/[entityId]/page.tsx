import Link from "next/link";
import { and, asc, eq, or } from "drizzle-orm";
import { ArrowLeft, Link2 } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireResourceAccess } from "@/server/lib/auth/organization";
import { db } from "@/server/lib/db/client";
import { apps, entities, entityFields, entityRelations } from "@/server/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function EntityPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;
  const current = await requireResourceAccess("data", "read");
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

  const [app, fields, relations] = await Promise.all([
    db.query.apps.findFirst({ where: eq(apps.id, entity.appId) }),
    db
      .select()
      .from(entityFields)
      .where(eq(entityFields.entityId, entity.id))
      .orderBy(asc(entityFields.order)),
    db
      .select()
      .from(entityRelations)
      .where(
        or(
          eq(entityRelations.sourceEntityId, entity.id),
          eq(entityRelations.targetEntityId, entity.id),
        ),
      ),
  ]);

  const outgoing = relations.filter((r) => r.sourceEntityId === entity.id);
  const incoming = relations.filter((r) => r.targetEntityId === entity.id);

  const relatedEntityIds = new Set([
    ...outgoing.map((r) => r.targetEntityId),
    ...incoming.map((r) => r.sourceEntityId),
  ]);
  const relatedEntities = relatedEntityIds.size > 0
    ? await db.select({ id: entities.id, name: entities.name }).from(entities).where(
        eq(entities.orgId, current.organization.id),
      )
    : [];
  const entityNameMap = new Map(relatedEntities.map((e) => [e.id, e.name]));
  const fieldNameMap = new Map(fields.map((f) => [f.id, f.name]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={entity.name}
        description={entity.description || "Business data model."}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/studio/data/entities">
                <ArrowLeft className="size-4" />
                Entities
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/studio/data/entities/${entity.id}/edit`}>Edit entity</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/studio/data/entities/${entity.id}/views/table`}>
                Configure table
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/studio/data/entities/${entity.id}/views/detail`}>
                Configure detail
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/studio/data/entities/${entity.id}/records`}>
                View records
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>App</CardTitle>
            <CardDescription>Business application container.</CardDescription>
          </CardHeader>
          <CardContent>{app?.name || "Unknown app"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Storage</CardTitle>
            <CardDescription>MVP records use JSON storage.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{entity.storageMode}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fields</CardTitle>
            <CardDescription>Fields synced from bound forms.</CardDescription>
          </CardHeader>
          <CardContent>{fields.length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fields</CardTitle>
          <CardDescription>
            Entity fields define the business data shape. Forms decide how users input them.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Data key</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Required</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={field.id}>
                  <TableCell className="font-medium">{field.name}</TableCell>
                  <TableCell>{field.slug}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{field.type}</Badge>
                  </TableCell>
                  <TableCell>{field.required ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(outgoing.length > 0 || incoming.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Relations</CardTitle>
            <CardDescription>
              Entity relationships defined by reference fields.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {outgoing.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium">References</h3>
                <div className="grid gap-2">
                  {outgoing.map((rel) => (
                    <div key={rel.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                      <Link2 className="size-4 text-muted-foreground" />
                      <span>{fieldNameMap.get(rel.sourceFieldId ?? "") || "Unknown field"}</span>
                      <span className="text-muted-foreground">→</span>
                      <Link
                        href={`/studio/data/entities/${rel.targetEntityId}`}
                        className="font-medium hover:underline"
                      >
                        {entityNameMap.get(rel.targetEntityId) || "Unknown entity"}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {incoming.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium">Referenced by</h3>
                <div className="grid gap-2">
                  {incoming.map((rel) => (
                    <div key={rel.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                      <Link2 className="size-4 text-muted-foreground" />
                      <Link
                        href={`/studio/data/entities/${rel.sourceEntityId}`}
                        className="font-medium hover:underline"
                      >
                        {entityNameMap.get(rel.sourceEntityId) || "Unknown entity"}
                      </Link>
                      <span className="text-muted-foreground">→</span>
                      <span>{fieldNameMap.get(rel.sourceFieldId ?? "") || "Unknown field"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
