import { FileText, GitBranch, Bot, ArrowRight } from "lucide-react";
import Link from "next/link";
import { count, eq } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentOrganization } from "@/lib/auth/organization";
import { agents, forms, workflows } from "@/lib/db/schema";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const current = await requireCurrentOrganization();
  const [formsCount, workflowsCount, agentsCount] = await Promise.all([
    db
      .select({ value: count() })
      .from(forms)
      .where(eq(forms.orgId, current.organization.id)),
    db
      .select({ value: count() })
      .from(workflows)
      .where(eq(workflows.orgId, current.organization.id)),
    db
      .select({ value: count() })
      .from(agents)
      .where(eq(agents.orgId, current.organization.id)),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Welcome back, {current.userEmail}
        </h2>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening in {current.organization.name}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Forms</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formsCount[0]?.value ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Total forms in this organization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workflowsCount[0]?.value ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Draft and enabled workflows
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agentsCount[0]?.value ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Agent definitions saved
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Create new resources to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Link href="/dashboard/forms/new">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="mr-2 h-4 w-4" />
                Create new form
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard/workflows/new">
              <Button variant="outline" className="w-full justify-start">
                <GitBranch className="mr-2 h-4 w-4" />
                Create new workflow
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard/agents/new">
              <Button variant="outline" className="w-full justify-start">
                <Bot className="mr-2 h-4 w-4" />
                Create new agent
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Follow these steps to build your first app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  1
                </span>
                <span>Create your first form to collect data</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  2
                </span>
                <span>Build automated workflows with our visual editor</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  3
                </span>
                <span>Deploy AI agents to handle complex tasks</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
