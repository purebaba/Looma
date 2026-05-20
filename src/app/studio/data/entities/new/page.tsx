import { EntityForm } from "@/components/data/entity-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireResourceAccess } from "@/lib/auth/organization";
import { ensureDefaultApp } from "@/lib/data/modeling";
import { db } from "@/lib/db/client";
import { apps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function NewEntityPage() {
  const current = await requireResourceAccess("data", "create");
  await ensureDefaultApp({
    orgId: current.organization.id,
    userId: current.userId,
  });
  const appOptions = await db
    .select({ id: apps.id, name: apps.name })
    .from(apps)
    .where(eq(apps.orgId, current.organization.id));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New entity"
        description="Create a business data model and its fields."
      />
      <EntityForm apps={appOptions} />
    </div>
  );
}
