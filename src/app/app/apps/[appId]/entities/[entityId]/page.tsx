import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowDown, ArrowLeft, ArrowUp, Database, Plus, Search } from "lucide-react";

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
import { apps, entities, entityFields, entityRecords, tableViews } from "@/lib/db/schema";
import { resolveTableView } from "@/lib/views/table-view";

export const dynamic = "force-dynamic";

export default async function RuntimeEntityPage({
  params,
  searchParams,
}: {
  params: Promise<{ appId: string; entityId: string }>;
  searchParams: Promise<{
    q?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { appId, entityId } = await params;
  const query = await searchParams;
  const search = String(query.q || "").trim().toLowerCase();
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
  const currentApp = app;
  const currentEntity = entity;

  const [fields, records, view] = await Promise.all([
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
    db.query.tableViews.findFirst({
      where: and(eq(tableViews.entityId, entity.id), eq(tableViews.isDefault, true)),
    }),
  ]);
  const resolvedView = resolveTableView(view, fields);
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const visibleColumns = resolvedView.config.columns
    .filter((column) => column.visible && fieldById.has(column.fieldId))
    .sort((a, b) => a.order - b.order);
  const searchFields = (resolvedView.config.searchFieldIds || [])
    .map((fieldId) => fieldById.get(fieldId))
    .filter((field): field is (typeof fields)[number] => Boolean(field));
  const sortFieldId = String(query.sort || resolvedView.config.sort?.fieldId || "");
  const sortField = fieldById.get(sortFieldId);
  const sortDirection =
    query.dir === "desc" || resolvedView.config.sort?.direction === "desc"
      ? "desc"
      : "asc";
  const filteredRecords = records
    .filter((record) => {
      if (!search) return true;
      const data = record.data as Record<string, unknown>;
      return searchFields.some((field) =>
        String(formatRecordValue(data[field.slug])).toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      if (!sortField) return 0;
      const aValue = (a.data as Record<string, unknown>)[sortField.slug];
      const bValue = (b.data as Record<string, unknown>)[sortField.slug];
      const result = String(formatRecordValue(aValue)).localeCompare(
        String(formatRecordValue(bValue)),
        undefined,
        { numeric: true, sensitivity: "base" }
      );
      return sortDirection === "desc" ? -result : result;
    });

  function sortHref(fieldId: string) {
    const nextDir = sortFieldId === fieldId && sortDirection === "asc" ? "desc" : "asc";
    const params = new URLSearchParams();
    if (query.q) params.set("q", String(query.q));
    params.set("sort", fieldId);
    params.set("dir", nextDir);
    return `/app/apps/${currentApp.id}/entities/${currentEntity.id}?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={currentEntity.name}
        description={
          resolvedView.description ||
          currentEntity.description ||
          `Records in ${currentApp.name}`
        }
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/app/apps/${currentApp.id}`}>
                <ArrowLeft className="size-4" />
                {currentApp.name}
              </Link>
            </Button>
            <Button asChild>
              <Link
                href={`/app/apps/${currentApp.id}/entities/${currentEntity.id}/records/new`}
              >
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
              <Link
                href={`/app/apps/${currentApp.id}/entities/${currentEntity.id}/records/new`}
              >
                Create record
              </Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{resolvedView.name}</CardTitle>
            <CardDescription>
              {filteredRecords.length} of {records.length} records shown.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-0">
            <form className="flex gap-2 px-6">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  name="q"
                  defaultValue={query.q || ""}
                  placeholder="Search records"
                  className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
                />
              </div>
              {sortFieldId ? <input type="hidden" name="sort" value={sortFieldId} /> : null}
              <input type="hidden" name="dir" value={sortDirection} />
              <Button type="submit" variant="outline">
                Search
              </Button>
            </form>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Record</TableHead>
                  {visibleColumns.map((column) => (
                    <TableHead key={column.fieldId}>
                      <Link
                        href={sortHref(column.fieldId)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {column.label}
                        {sortFieldId === column.fieldId ? (
                          sortDirection === "desc" ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUp className="size-3" />
                          )
                        ) : null}
                      </Link>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => {
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
                          href={`/app/apps/${currentApp.id}/entities/${currentEntity.id}/records/${record.id}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {record.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      {visibleColumns.map((column) => {
                        const field = fieldById.get(column.fieldId);
                        return (
                          <TableCell key={column.fieldId}>
                            {field ? formatRecordValue(data[field.slug]) : "-"}
                          </TableCell>
                        );
                      })}
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
