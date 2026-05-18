import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { GitBranch, Plus } from "lucide-react";

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
import { workflows } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const current = await requireResourceAccess("workflows", "read");
  const items = await db
    .select()
    .from(workflows)
    .where(eq(workflows.orgId, current.organization.id))
    .orderBy(desc(workflows.updatedAt));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Workflows"
        description="Automate form and business events with visual workflows."
        actions={
          <Button asChild>
            <Link href="/dashboard/workflows/new">
              <Plus className="size-4" />
              New workflow
            </Link>
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No workflows yet"
          description="Create a workflow shell and add runtime nodes as the engine evolves."
          action={
            <Button asChild>
              <Link href="/dashboard/workflows/new">Create workflow</Link>
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
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((workflow) => (
                  <TableRow key={workflow.id}>
                    <TableCell className="font-medium">{workflow.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{workflow.status}</Badge>
                    </TableCell>
                    <TableCell>{workflow.version}</TableCell>
                    <TableCell>
                      {workflow.updatedAt
                        ? new Intl.DateTimeFormat("en", {
                            dateStyle: "medium",
                          }).format(workflow.updatedAt)
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
