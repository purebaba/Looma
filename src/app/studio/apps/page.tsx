import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { Boxes, Plus } from "lucide-react";

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
import { apps, entities, forms } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function AppsPage() {
  const current = await requireResourceAccess("apps", "read");
  const rows = await db
    .select()
    .from(apps)
    .where(eq(apps.orgId, current.organization.id))
    .orderBy(desc(apps.updatedAt));

  const items = await Promise.all(
    rows.map(async (app) => {
      const [entityCount] = await db
        .select({ value: count() })
        .from(entities)
        .where(eq(entities.appId, app.id));
      const [formCount] = await db
        .select({ value: count() })
        .from(forms)
        .where(eq(forms.appId, app.id));
      return {
        ...app,
        entityCount: entityCount?.value ?? 0,
        formCount: formCount?.value ?? 0,
      };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Apps"
        description="Group data models, interfaces, workflows, and agents into business applications."
        actions={
          <Button asChild>
            <Link href="/studio/apps/new">
              <Plus className="size-4" />
              New app
            </Link>
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No apps yet"
          description="Create an app to group your business models."
          action={
            <Button asChild>
              <Link href="/studio/apps/new">Create app</Link>
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
                  <TableHead>Entities</TableHead>
                  <TableHead>Forms</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <Link
                        href={`/studio/apps/${app.id}`}
                        className="font-medium hover:underline"
                      >
                        {app.name}
                      </Link>
                      {app.description ? (
                        <p className="text-xs text-muted-foreground">
                          {app.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{app.status}</Badge>
                    </TableCell>
                    <TableCell>{app.entityCount}</TableCell>
                    <TableCell>{app.formCount}</TableCell>
                    <TableCell>
                      {app.updatedAt
                        ? new Intl.DateTimeFormat("en", {
                            dateStyle: "medium",
                          }).format(app.updatedAt)
                        : "Never"}
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
