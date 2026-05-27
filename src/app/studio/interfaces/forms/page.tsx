import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { ExternalLink, FileText, Inbox, Plus, Settings } from "lucide-react";

import { FormLifecycleActions } from "@/components/forms/form-lifecycle-actions";
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
import { entities, formSubmissions, formVersions, forms } from "@/lib/db/schema";

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
      const entity = form.entityId
        ? await db.query.entities.findFirst({
            where: eq(entities.id, form.entityId),
          })
        : null;
      const [publishedVersions] = await db
        .select({ value: count() })
        .from(formVersions)
        .where(eq(formVersions.formId, form.id));
      return {
        ...form,
        entityName: entity?.name ?? null,
        submissionCount: submissionCount?.value ?? 0,
        hasPublishedVersion: (publishedVersions?.value ?? 0) > 0,
      };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Forms"
        description="Design, publish, and collect structured submissions."
        actions={
          <Button asChild>
            <Link href="/studio/interfaces/forms/new">
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
              <Link href="/studio/interfaces/forms/new">Create form</Link>
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
                  <TableHead>Entity</TableHead>
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
                        href={`/studio/interfaces/forms/${form.id}`}
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
                    <TableCell>
                      {form.entityId ? (
                        <Link
                          href={`/studio/data/entities/${form.entityId}`}
                          className="hover:underline"
                        >
                          {form.entityName || "Entity"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Not bound</span>
                      )}
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
                          <Link href={`/studio/interfaces/forms/${form.id}`}>
                            <Settings className="size-4" />
                            Configure
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/studio/interfaces/forms/${form.id}/submissions`}>
                            <Inbox className="size-4" />
                            Responses
                          </Link>
                        </Button>
                        {form.hasPublishedVersion && form.status !== "archived" ? (
                          <Button asChild size="sm">
                            <Link href={`/forms/${form.id}`}>
                              <ExternalLink className="size-4" />
                              Fill form
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`/studio/interfaces/forms/${form.id}`}>
                              Publish first
                            </Link>
                          </Button>
                        )}
                        <FormLifecycleActions
                          formId={form.id}
                          status={form.status}
                          compact
                        />
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
