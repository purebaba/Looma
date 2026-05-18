import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { ExternalLink, FileText, Inbox, Plus, Settings } from "lucide-react";

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
import { formSubmissions, forms } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  const current = await requireResourceAccess("forms", "read");
  const rows = await db
    .select()
    .from(forms)
    .where(eq(forms.orgId, current.organization.id))
    .orderBy(desc(forms.updatedAt));

  const items = await Promise.all(
    rows.map(async (form) => {
      const [submissionCount] = await db
        .select({ value: count() })
        .from(formSubmissions)
        .where(eq(formSubmissions.formId, form.id));
      return { ...form, submissionCount: submissionCount?.value ?? 0 };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Forms"
        description="Design, publish, and collect structured submissions."
        actions={
          <Button asChild>
            <Link href="/dashboard/forms/new">
              <Plus className="size-4" />
              New form
            </Link>
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No forms yet"
          description="Create your first form to start collecting data."
          action={
            <Button asChild>
              <Link href="/dashboard/forms/new">Create form</Link>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Submissions</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/forms/${form.id}`}
                        className="font-medium hover:underline"
                      >
                        {form.name}
                      </Link>
                      {form.description ? (
                        <p className="text-xs text-muted-foreground">
                          {form.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          form.status === "published" ? "default" : "secondary"
                        }
                      >
                        {form.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{form.version}</TableCell>
                    <TableCell>{form.submissionCount}</TableCell>
                    <TableCell>
                      {form.updatedAt
                        ? new Intl.DateTimeFormat("en", {
                            dateStyle: "medium",
                          }).format(form.updatedAt)
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/dashboard/forms/${form.id}`}>
                            <Settings className="size-4" />
                            Configure
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/dashboard/forms/${form.id}/submissions`}>
                            <Inbox className="size-4" />
                            Responses
                          </Link>
                        </Button>
                        {form.status === "published" ? (
                          <Button asChild size="sm">
                            <Link href={`/forms/${form.id}`}>
                              <ExternalLink className="size-4" />
                              Fill form
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`/dashboard/forms/${form.id}`}>
                              Publish first
                            </Link>
                          </Button>
                        )}
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
