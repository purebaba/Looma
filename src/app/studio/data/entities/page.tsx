import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { Database, Plus } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import { apps, entities, entityFields, entityRecords } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function EntitiesPage() {
  const current = await requireResourceAccess("data", "read");
  const rows = await db
    .select()
    .from(entities)
    .where(eq(entities.orgId, current.organization.id))
    .orderBy(desc(entities.updatedAt));

  const items = await Promise.all(
    rows.map(async (entity) => {
      const [fieldCount] = await db
        .select({ value: count() })
        .from(entityFields)
        .where(eq(entityFields.entityId, entity.id));
      const [recordCount] = await db
        .select({ value: count() })
        .from(entityRecords)
        .where(eq(entityRecords.entityId, entity.id));
      const app = await db.query.apps.findFirst({
        where: eq(apps.id, entity.appId),
      });
      return {
        ...entity,
        appName: app?.name ?? "Unknown app",
        fieldCount: fieldCount?.value ?? 0,
        recordCount: recordCount?.value ?? 0,
      };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Entities"
        description="Model business objects and inspect the records created by forms, workflows, APIs, and agents."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/studio/interfaces/forms/new">New form-backed entity</Link>
            </Button>
            <Button asChild>
              <Link href="/studio/data/entities/new">
                <Plus className="size-4" />
                New entity
              </Link>
            </Button>
          </div>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No entities yet"
          description="Create a form to automatically create the first business entity."
          action={
            <Button asChild>
              <Link href="/studio/data/entities/new">Create entity</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>App</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((entity) => (
                  <TableRow key={entity.id}>
                    <TableCell>
                      <Link
                        href={`/studio/data/entities/${entity.id}`}
                        className="font-medium hover:underline"
                      >
                        {entity.name}
                      </Link>
                      {entity.description ? (
                        <p className="text-xs text-muted-foreground">
                          {entity.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>{entity.appName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{entity.storageMode}</Badge>
                    </TableCell>
                    <TableCell>{entity.fieldCount}</TableCell>
                    <TableCell>{entity.recordCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/studio/data/entities/${entity.id}/edit`}>
                            Edit
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/studio/data/entities/${entity.id}/records`}>
                            View records
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
