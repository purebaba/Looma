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
import { requireResourceAccess } from "@/server/lib/auth/organization";
import { db } from "@/server/lib/db/client";
import { entities, entityFields, entityRecords } from "@/server/lib/db/schema";

export const dynamic = "force-dynamic";

function formatValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default async function EntityRecordsPage({
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
        title={`${entity.name} records`}
        description="Business records created by forms, workflows, APIs, or agents."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/studio/data/entities/${entity.id}`}>
                <ArrowLeft className="size-4" />
                Entity
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/studio/data/entities">Entities</Link>
            </Button>
            <Button asChild>
              <Link href={`/studio/data/entities/${entity.id}/records/new`}>
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
          description="Records appear here when a bound form is submitted or data is created through the API."
          action={
            <Button asChild>
              <Link href={`/studio/data/entities/${entity.id}/records/new`}>
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
                          href={`/studio/data/entities/${entity.id}/records/${record.id}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {record.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      {fields.map((field) => (
                        <TableCell key={field.id}>
                          {formatValue(data[field.slug])}
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
