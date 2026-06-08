import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, Download, Eye, Inbox } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formSubmissions, formVersions, forms } from "@/lib/db/schema";
import type { FormSchema } from "@/lib/forms/field-schema";
import {
  filterSubmissions,
  formatSubmissionValue,
  formatSubmissionSnapshot,
  sortSubmissions,
  submissionFields,
  versionLabelForSubmission,
} from "@/lib/forms/submissions";
import {
  formVersionSchema,
  getLatestPublishedFormVersion,
} from "@/lib/forms/versions";

export const dynamic = "force-dynamic";

export default async function FormSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ formId: string }>;
  searchParams: Promise<{
    q?: string;
    fieldId?: string;
    fieldValue?: string;
    sort?: string;
    exportField?: string | string[];
  }>;
}) {
  const { formId } = await params;
  const filters = await searchParams;
  const current = await requireResourceAccess("forms", "read");
  const form = await db.query.forms.findFirst({
    where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
  });

  if (!form) {
    return (
      <PageHeader
        title="Form not found"
        description="This form does not exist in the current organization."
      />
    );
  }

  const publishedVersion = await getLatestPublishedFormVersion(form.id);
  const schema = publishedVersion
    ? formVersionSchema(publishedVersion)
    : (form.schema as FormSchema);
  const fields = submissionFields(schema);
  const submissions = await db
    .select()
    .from(formSubmissions)
    .where(eq(formSubmissions.formId, form.id))
    .orderBy(desc(formSubmissions.createdAt));
  const versions = await db
    .select()
    .from(formVersions)
    .where(eq(formVersions.formId, form.id));
  const versionsById = new Map(versions.map((version) => [version.id, version]));
  const sort = filters.sort === "asc" ? "asc" : "desc";
  const selectedExportFieldIds = Array.isArray(filters.exportField)
    ? filters.exportField
    : filters.exportField
      ? [filters.exportField]
      : [];
  const selectedExportFields = new Set(selectedExportFieldIds);
  const filteredSubmissions = sortSubmissions(
    filterSubmissions({
      schema,
      submissions,
      query: filters.q,
      fieldId: filters.fieldId,
      fieldValue: filters.fieldValue,
      versionsById,
    }),
    sort
  );
  const activeField = fields.find((field) => field.id === filters.fieldId);
  const exportParams = new URLSearchParams();
  if (filters.q) exportParams.set("q", filters.q);
  if (filters.fieldId) exportParams.set("fieldId", filters.fieldId);
  if (filters.fieldValue) exportParams.set("fieldValue", filters.fieldValue);
  if (filters.sort) exportParams.set("sort", sort);
  selectedExportFieldIds.forEach((fieldId) =>
    exportParams.append("exportField", fieldId)
  );
  const exportHref = `/api/forms/${form.id}/submissions/export${
    exportParams.toString() ? `?${exportParams.toString()}` : ""
  }`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${form.name} responses`}
        description="Review submitted form data."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/studio/interfaces/forms">
                <ArrowLeft className="size-4" />
                Forms
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/studio/interfaces/forms/${form.id}`}>Configure</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={exportHref}>
                <Download className="size-4" />
                Export CSV
              </Link>
            </Button>
            {form.entityId ? (
              <Button asChild variant="outline">
                <Link href={`/studio/data/entities/${form.entityId}/records`}>
                  Records
                </Link>
              </Button>
            ) : null}
            {form.status === "published" ? (
              <Button asChild>
                <Link href={`/forms/${form.id}`}>Fill form</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {submissions.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No responses yet"
          description="Responses will appear here after someone fills this published form."
          action={
            form.status === "published" ? (
              <Button asChild>
                <Link href={`/forms/${form.id}`}>Fill a test response</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <Card>
          <CardHeader className="gap-4">
            <div>
              <CardTitle>{filteredSubmissions.length} responses</CardTitle>
              <CardDescription>
                {filteredSubmissions.length === submissions.length
                  ? "Latest submissions are shown first."
                  : `Filtered from ${submissions.length} total submissions.`}
              </CardDescription>
            </div>
            <form className="grid gap-3 rounded-md border bg-muted/30 p-3 lg:grid-cols-[minmax(180px,1fr)_180px_minmax(180px,1fr)_120px_auto]">
              <div className="grid gap-2">
                <Label htmlFor="response-search">Search</Label>
                <Input
                  id="response-search"
                  name="q"
                  defaultValue={filters.q || ""}
                  placeholder="Name, email, record..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="response-field">Field</Label>
                <select
                  id="response-field"
                  name="fieldId"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={filters.fieldId || ""}
                >
                  <option value="">Any field</option>
                  {fields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="response-field-value">Field contains</Label>
                <Input
                  id="response-field-value"
                  name="fieldValue"
                  defaultValue={filters.fieldValue || ""}
                  placeholder={activeField ? `Filter ${activeField.label}` : "Any value"}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="response-sort">Sort</Label>
                <select
                  id="response-sort"
                  name="sort"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={sort}
                >
                  <option value="desc">Newest</option>
                  <option value="asc">Oldest</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit">Apply</Button>
                <Button asChild variant="outline">
                  <Link href={`/studio/interfaces/forms/${form.id}/submissions`}>
                    Reset
                  </Link>
                </Button>
              </div>
              <div className="grid gap-2 lg:col-span-5">
                <Label>Export fields</Label>
                <div className="flex flex-wrap gap-3 rounded-md border bg-background p-3 text-sm">
                  {fields.map((field) => (
                    <label key={field.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="exportField"
                        value={field.id}
                        defaultChecked={
                          selectedExportFieldIds.length === 0 ||
                          selectedExportFields.has(field.id)
                        }
                      />
                      <span>{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </form>
          </CardHeader>
          {filteredSubmissions.length === 0 ? (
            <CardContent>
              <EmptyState
                icon={Inbox}
                title="No matching responses"
                description="Try another search term or clear the field filter."
                action={
                  <Button asChild variant="outline">
                    <Link href={`/studio/interfaces/forms/${form.id}/submissions`}>
                      Reset filters
                    </Link>
                  </Button>
                }
              />
            </CardContent>
          ) : (
            <CardContent className="p-0">
              <form action={`/api/forms/${form.id}/submissions/export`}>
                {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
                {filters.fieldId ? (
                  <input type="hidden" name="fieldId" value={filters.fieldId} />
                ) : null}
                {filters.fieldValue ? (
                  <input
                    type="hidden"
                    name="fieldValue"
                    value={filters.fieldValue}
                  />
                ) : null}
                <input type="hidden" name="sort" value={sort} />
                {selectedExportFieldIds.map((fieldId) => (
                  <input
                    key={fieldId}
                    type="hidden"
                    name="exportField"
                    value={fieldId}
                  />
                ))}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
                  <p className="text-sm text-muted-foreground">
                    Select rows below, or leave blank to export the filtered set.
                  </p>
                  <Button type="submit" variant="outline" size="sm">
                    <Download className="size-4" />
                    Export selected CSV
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Select</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead>Submitted values</TableHead>
                      {fields.map((field) => (
                        <TableHead key={field.id}>{field.label}</TableHead>
                      ))}
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubmissions.map((submission) => {
                      const data = submission.data as Record<string, unknown>;
                      return (
                        <TableRow key={submission.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              name="submissionId"
                              value={submission.id}
                              aria-label={`Select response ${submission.id.slice(0, 8)}`}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {submission.createdAt
                              ? new Intl.DateTimeFormat("en", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                }).format(submission.createdAt)
                              : "Unknown"}
                          </TableCell>
                          <TableCell>
                            {versionLabelForSubmission({ submission, versionsById })}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {submission.entityRecordId
                              ? submission.entityRecordId.slice(0, 8)
                              : "-"}
                          </TableCell>
                          <TableCell className="min-w-64 text-xs text-muted-foreground">
                            {formatSubmissionSnapshot({
                              fallbackSchema: schema,
                              submission,
                              versionsById,
                            })}
                          </TableCell>
                          {fields.map((field) => (
                            <TableCell key={field.id}>
                              {formatSubmissionValue(data[field.id])}
                            </TableCell>
                          ))}
                          <TableCell>
                            <div className="flex justify-end">
                              <Button asChild variant="outline" size="sm">
                                <Link
                                  href={`/studio/interfaces/forms/${form.id}/submissions/${submission.id}`}
                                >
                                  <Eye className="size-4" />
                                  View
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </form>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
