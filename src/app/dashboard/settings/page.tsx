import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { canAccess } from "@/lib/auth/permissions";
import { requireCurrentOrganization } from "@/lib/auth/organization";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const current = await requireCurrentOrganization();
  const canEdit = canAccess(current.membership.role, "settings", "update");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Control organization-level configuration."
      />
      <SettingsForm organization={current.organization} canEdit={canEdit} />
    </div>
  );
}
