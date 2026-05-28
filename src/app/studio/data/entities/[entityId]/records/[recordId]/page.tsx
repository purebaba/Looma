import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowLeft, FileText } from "lucide-react";

import { RecordForm } from "@/components/data/record-form";
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
import { db } from "@/lib/db/client";
import {
  entities,
  entityFields,
  entityRecords,
  forms,
  formSubmissions,
  formVersions,
} from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function formatValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ entityId: string; recordId: string }>;
}) {
  const { entityId, recordId } = await params;
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

  const [fields, record] = await Promise.all([
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
  const sourceSubmissions = await db
    .select({
      id: formSubmissions.id,
      createdAt: formSubmissions.createdAt,
      formId: formSubmissions.formId,
      formName: forms.name,
      formVersion: formVersions.version,
    })
    .from(formSubmissions)
    .innerJoin(forms, eq(forms.id, formSubmissions.formId))
    .leftJoin(formVersions, eq(formVersions.id, formSubmissions.formVersionId))
    .where(
      and(
        eq(formSubmissions.entityRecordId, record.id),
        eq(forms.orgId, current.organization.id)
      )
    )
    .orderBy(desc(formSubmissions.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${entity.name} record`}
        description={`Record ${record.id}`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/studio/data/entities/${entity.id}/records`}>
              <ArrowLeft className="size-4" />
              Records
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Current values</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={field.id}>
                  <TableCell className="w-64 font-medium">{field.name}</TableCell>
                  <TableCell>{formatValue(data[field.slug])}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Source submissions</CardTitle>
          <CardDescription>
            Form submission events that created or updated this business record.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {sourceSubmissions.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Submitted at</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourceSubmissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-medium">
                      {submission.formName}
                    </TableCell>
                    <TableCell>
                      {submission.formVersion ? `v${submission.formVersion}` : "-"}
                    </TableCell>
                    <TableCell>
                      {submission.createdAt
                        ? new Intl.DateTimeFormat("en", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(submission.createdAt)
                        : "Unknown"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/studio/interfaces/forms/${submission.formId}/submissions/${submission.id}`}
                        >
                          <FileText className="size-4" />
                          Open response
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              This record was created manually or has no linked form submission.
            </p>
          )}
        </CardContent>
      </Card>

      <RecordForm
        entityId={entity.id}
        fields={fields}
        initialRecord={{
          id: record.id,
          data: record.data as Record<string, unknown>,
        }}
      />
    </div>
  );
}
