import { AppForm } from "@/components/apps/app-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireResourceAccess } from "@/server/lib/auth/organization";

export const dynamic = "force-dynamic";

export default async function NewAppPage() {
  await requireResourceAccess("apps", "create");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New app"
        description="Create a business application container."
      />
      <AppForm />
    </div>
  );
}
