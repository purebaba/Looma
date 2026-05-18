import { asc, eq } from "drizzle-orm";
import { Users } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { AddMemberForm } from "@/components/team/add-member-form";
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
import { canManageMembers } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { organizationMembers, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const current = await requireResourceAccess("team", "read");
  const members = await db
    .select({
      id: organizationMembers.id,
      role: organizationMembers.role,
      joinedAt: organizationMembers.joinedAt,
      name: users.name,
      email: users.email,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.orgId, current.organization.id))
    .orderBy(asc(users.email));
  const canManage = canManageMembers(current.membership.role);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team"
        description="Manage members and roles for the current organization."
      />
      <AddMemberForm canManage={canManage} />
      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members found"
          description="Members will appear here once they join this organization."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <p className="font-medium">{member.name || member.email}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{member.role}</Badge>
                    </TableCell>
                    <TableCell>
                      {member.joinedAt
                        ? new Intl.DateTimeFormat("en", {
                            dateStyle: "medium",
                          }).format(member.joinedAt)
                        : "Unknown"}
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
