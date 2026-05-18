import { desc, eq } from "drizzle-orm";
import { Bot } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
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
import { agents } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const current = await requireResourceAccess("agents", "read");
  const items = await db
    .select()
    .from(agents)
    .where(eq(agents.orgId, current.organization.id))
    .orderBy(desc(agents.updatedAt));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agents"
        description="AI agent definitions will build on top of forms and workflows."
      />
      {items.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="Agent authoring is intentionally staged after the workflow runtime."
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{agent.status}</Badge>
                    </TableCell>
                    <TableCell>{agent.version}</TableCell>
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
