import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, Inbox } from "lucide-react";

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
import { db } from "@/lib/db/client";
import { formSubmissions, forms } from "@/lib/db/schema";
import type { FormSchema } from "@/lib/forms/field-schema";

export const dynamic = "force-dynamic";

function formatValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default async function FormSubmissionsPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
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

  const schema = form.schema as FormSchema;
  const fields = schema.fields.filter((field) => field.type !== "divider");
  const submissions = await db
    .select()
    .from(formSubmissions)
    .where(eq(formSubmissions.formId, form.id))
    .orderBy(desc(formSubmissions.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${form.name} responses`}
        description="Review submitted form data."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/forms">
                <ArrowLeft className="size-4" />
                Forms
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/dashboard/forms/${form.id}`}>Configure</Link>
            </Button>
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
          <CardHeader>
            <CardTitle>{submissions.length} responses</CardTitle>
            <CardDescription>
              Latest submissions are shown first.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  {fields.map((field) => (
                    <TableHead key={field.id}>{field.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => {
                  const data = submission.data as Record<string, unknown>;
                  return (
                    <TableRow key={submission.id}>
                      <TableCell className="whitespace-nowrap">
                        {submission.createdAt
                          ? new Intl.DateTimeFormat("en", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(submission.createdAt)
                          : "Unknown"}
                      </TableCell>
                      {fields.map((field) => (
                        <TableCell key={field.id}>
                          {formatValue(data[field.id])}
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
