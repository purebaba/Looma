import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowLeft, FileText, SquarePen } from "lucide-react";

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
  entityRecordVersions,
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

function formatDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value)
    : "Unknown";
}

function isSameValue(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function describeVersionChanges({
  current,
  previous,
  fields,
}: {
  current: Record<string, unknown>;
  previous?: Record<string, unknown>;
  fields: Array<{ name: string; slug: string }>;
}) {
  if (!previous) {
    return fields
      .filter((field) => current[field.slug] !== undefined)
      .map((field) => ({
        field: field.name,
        before: null,
        after: current[field.slug],
      }));
  }

  return fields
    .filter((field) => !isSameValue(previous[field.slug], current[field.slug]))
    .map((field) => ({
      field: field.name,
      before: previous[field.slug],
      after: current[field.slug],
    }));
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
  const [sourceSubmissions, recordVersions] = await Promise.all([
    db
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
      .orderBy(desc(formSubmissions.createdAt)),
    db
      .select()
      .from(entityRecordVersions)
      .where(eq(entityRecordVersions.recordId, record.id))
      .orderBy(asc(entityRecordVersions.version)),
  ]);
  const versionSummaries = recordVersions
    .map((version, index) => {
      const previous = recordVersions[index - 1]?.data as
        | Record<string, unknown>
        | undefined;
      const currentData = version.data as Record<string, unknown>;
      return {
        ...version,
        changes: describeVersionChanges({
          current: currentData,
          previous,
          fields,
        }),
      };
    })
    .reverse();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${entity.name} record`}
        description={`Record ${record.id}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {sourceSubmissions[0]?.formId ? (
              <Button asChild>
                <Link
                  href={`/forms/${sourceSubmissions[0].formId}?recordId=${record.id}`}
                >
                  <SquarePen className="size-4" />
                  Edit with form
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={`/studio/data/entities/${entity.id}/records`}>
                <ArrowLeft className="size-4" />
                Records
              </Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Current values</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table data-testid="record-current-values">
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
                      {formatDate(submission.createdAt)}
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

      <Card>
        <CardHeader>
          <CardTitle>Record version history</CardTitle>
          <CardDescription>
            Immutable snapshots created when this record is created or updated.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {versionSummaries.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Changed at</TableHead>
                  <TableHead>Changed values</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versionSummaries.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="font-medium">
                      Version {version.version}
                    </TableCell>
                    <TableCell>{formatDate(version.createdAt)}</TableCell>
                    <TableCell>
                      {version.changes.length ? (
                        <div className="grid gap-1">
                          {version.changes.map((change) => (
                            <div key={`${version.id}-${change.field}`}>
                              <span className="font-medium">{change.field}: </span>
                              {change.before !== null &&
                              change.before !== undefined ? (
                                <>
                                  <span className="text-muted-foreground">
                                    {formatValue(change.before)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {" -> "}
                                  </span>
                                </>
                              ) : null}
                              <span>{formatValue(change.after)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No data changes</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              No version snapshots have been recorded for this record.
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
