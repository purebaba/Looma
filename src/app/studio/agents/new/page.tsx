import { Bot } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireResourceAccess } from "@/lib/auth/organization";

export const dynamic = "force-dynamic";

export default async function NewAgentPage() {
  await requireResourceAccess("agents", "create");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New agent"
        description="Agent creation will be enabled after the workflow runtime is stable."
      />
      <EmptyState
        icon={Bot}
        title="Agent builder foundation"
        description="The planned MVP will add LangGraph nodes, tools, memory configuration, and execution logs here."
      />
    </div>
  );
}
