import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Database } from "lucide-react";

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
import { formSubmissions, forms } from "@/server/lib/db/schema";
import type { FormSchema } from "@/server/lib/forms/field-schema";
import {
  formatSubmissionValue,
  submissionFields,
  submissionStatus,
} from "@/server/lib/forms/submissions";
import {
  formVersionSchema,
  getSubmissionFormVersion,
} from "@/server/lib/forms/versions";

export const dynamic = "force-dynamic";

export default async function FormSubmissionDetailPage({
  params,
}: {
  params: Promise<{ formId: string; submissionId: string }>;
}) {
  const { formId, submissionId } = await params;
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

  const submission = await db.query.formSubmissions.findFirst({
    where: and(
      eq(formSubmissions.id, submissionId),
      eq(formSubmissions.formId, form.id)
    ),
  });

  if (!submission) {
    return (
      <PageHeader
        title="Response not found"
        description="This response does not exist for the selected form."
      />
    );
  }

  const submissionVersion = await getSubmissionFormVersion({
    formId: form.id,
    formVersionId: submission.formVersionId,
  });
  const schema = submissionVersion
    ? formVersionSchema(submissionVersion)
    : (form.schema as FormSchema);
  const fields = submissionFields(schema);
  const data = submission.data as Record<string, unknown>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${form.name} response`}
        description="Inspect the submitted snapshot and the business record it created."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/studio/interfaces/forms/${form.id}/submissions`}>
                <ArrowLeft className="size-4" />
                Responses
              </Link>
            </Button>
            {form.entityId && submission.entityRecordId ? (
              <Button asChild>
                <Link
                  href={`/studio/data/entities/${form.entityId}/records/${submission.entityRecordId}`}
                >
                  <Database className="size-4" />
                  Open record
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Submitted values</CardTitle>
            <CardDescription>
              This is the immutable form submission snapshot.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">{field.label}</TableCell>
                    <TableCell>{formatSubmissionValue(data[field.id])}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Audit metadata</CardTitle>
            <CardDescription>Submission identity and origin.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Submission ID</p>
              <p className="break-all font-mono text-xs">{submission.id}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <Badge
                variant={
                  submissionStatus(submission) === "archived"
                    ? "secondary"
                    : "default"
                }
              >
                {submissionStatus(submission)}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Submitted at</p>
              <p>
                {submission.createdAt
                  ? new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(submission.createdAt)
                  : "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Form version</p>
              <p>
                {submissionVersion ? `v${submissionVersion.version}` : "-"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Entity record</p>
              <p className="break-all font-mono text-xs">
                {submission.entityRecordId || "-"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">User agent</p>
              <p className="break-words">{submission.userAgent || "-"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
