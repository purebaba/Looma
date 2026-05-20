import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowLeft, Database, Plus } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
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
import { requireResourceAccess } from "@/lib/auth/organization";
import { formatRecordValue } from "@/lib/data/format";
import { db } from "@/lib/db/client";
import { apps, entities, entityFields, entityRecords } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function RuntimeEntityPage({
  params,
}: {
  params: Promise<{ appId: string; entityId: string }>;
}) {
  const { appId, entityId } = await params;
  const current = await requireResourceAccess("data", "read");
  const app = await db.query.apps.findFirst({
    where: and(eq(apps.id, appId), eq(apps.orgId, current.organization.id)),
  });
  const entity = app
    ? await db.query.entities.findFirst({
        where: and(eq(entities.id, entityId), eq(entities.appId, app.id)),
      })
    : null;

  if (!app || !entity) {
    return (
      <PageHeader
        title="Entity not found"
        description="This entity does not exist in the selected app."
      />
    );
  }

  const [fields, records] = await Promise.all([
    db
      .select()
      .from(entityFields)
      .where(eq(entityFields.entityId, entity.id))
      .orderBy(asc(entityFields.order)),
    db
      .select()
      .from(entityRecords)
      .where(eq(entityRecords.entityId, entity.id))
      .orderBy(desc(entityRecords.createdAt)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={entity.name}
        description={entity.description || `Records in ${app.name}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/app/apps/${app.id}`}>
                <ArrowLeft className="size-4" />
                {app.name}
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/app/apps/${app.id}/entities/${entity.id}/records/new`}>
                <Plus className="size-4" />
                New record
              </Link>
            </Button>
          </div>
        }
      />

      {records.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No records yet"
          description="Create the first record for this business object."
          action={
            <Button asChild>
              <Link href={`/app/apps/${app.id}/entities/${entity.id}/records/new`}>
                Create record
              </Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{records.length} records</CardTitle>
            <CardDescription>Latest records are shown first.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Record</TableHead>
                  {fields.map((field) => (
                    <TableHead key={field.id}>{field.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const data = record.data as Record<string, unknown>;
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap">
                        {record.createdAt
                          ? new Intl.DateTimeFormat("en", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(record.createdAt)
                          : "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/app/apps/${app.id}/entities/${entity.id}/records/${record.id}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {record.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      {fields.map((field) => (
                        <TableCell key={field.id}>
                          {formatRecordValue(data[field.slug])}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
