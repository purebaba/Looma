import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";

import { RecordForm } from "@/components/data/record-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { requireResourceAccess } from "@/lib/auth/organization";
import { formatRecordValue } from "@/lib/data/format";
import { db } from "@/lib/db/client";
import {
  apps,
  detailViews,
  entities,
  entityFields,
  entityRecords,
} from "@/lib/db/schema";
import { resolveDetailView } from "@/lib/views/detail-view";

export const dynamic = "force-dynamic";

export default async function RuntimeRecordDetailPage({
  params,
}: {
  params: Promise<{ appId: string; entityId: string; recordId: string }>;
}) {
  const { appId, entityId, recordId } = await params;
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

  const [fields, record, view] = await Promise.all([
    db
      .select()
      .from(entityFields)
      .where(eq(entityFields.entityId, entity.id))
      .orderBy(asc(entityFields.order)),
    db.query.entityRecords.findFirst({
      where: and(
        eq(entityRecords.id, recordId),
        eq(entityRecords.entityId, entity.id)
      ),
    }),
    db.query.detailViews.findFirst({
      where: and(eq(detailViews.entityId, entity.id), eq(detailViews.isDefault, true)),
    }),
  ]);

  if (!record) {
    return (
      <PageHeader
        title="Record not found"
        description="This record does not exist for the selected entity."
      />
    );
  }

  const data = record.data as Record<string, unknown>;
  const returnPathPrefix = `/app/apps/${app.id}/entities/${entity.id}/records`;
  const resolvedView = resolveDetailView(view, fields);
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const visibleFields = resolvedView.config.fields
    .filter((field) => field.visible && fieldById.has(field.fieldId))
    .sort((a, b) => a.order - b.order);
  const editableFields = resolvedView.config.fields
    .filter((field) => field.editable && fieldById.has(field.fieldId))
    .sort((a, b) => a.order - b.order)
    .map((field) => fieldById.get(field.fieldId))
    .filter((field): field is (typeof fields)[number] => Boolean(field));
  const sections = visibleFields.reduce<
    Array<{ name: string; fields: typeof visibleFields }>
  >((groups, field) => {
    const sectionName = field.section || "Details";
    const group = groups.find((item) => item.name === sectionName);
    if (group) {
      group.fields.push(field);
    } else {
      groups.push({ name: sectionName, fields: [field] });
    }
    return groups;
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${entity.name} record`}
        description={resolvedView.description || `Record ${record.id}`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/app/apps/${app.id}/entities/${entity.id}`}>
              <ArrowLeft className="size-4" />
              Records
            </Link>
          </Button>
        }
      />

      {sections.map((section) => (
        <Card key={section.name}>
          <CardHeader>
            <CardTitle>{section.name}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {section.fields.map((viewField) => {
                  const field = fieldById.get(viewField.fieldId);
                  if (!field) return null;
                  return (
                    <TableRow key={viewField.fieldId}>
                      <TableCell className="w-64 font-medium">
                        {viewField.label}
                      </TableCell>
                      <TableCell>{formatRecordValue(data[field.slug])}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <RecordForm
        entityId={entity.id}
        fields={editableFields}
        initialRecord={{
          id: record.id,
          data: record.data as Record<string, unknown>,
        }}
        returnPathPrefix={returnPathPrefix}
      />
    </div>
  );
}
