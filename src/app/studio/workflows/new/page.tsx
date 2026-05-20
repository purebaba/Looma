import { GitBranch } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireResourceAccess } from "@/lib/auth/organization";

export const dynamic = "force-dynamic";

export default async function NewWorkflowPage() {
  await requireResourceAccess("workflows", "create");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New workflow"
        description="Workflow creation is staged after the form engine foundation."
      />
      <EmptyState
        icon={GitBranch}
        title="Workflow designer foundation"
        description="The next iteration should wire React Flow nodes for manual triggers, form submissions, conditions, HTTP actions, and end states."
      />
    </div>
  );
}
