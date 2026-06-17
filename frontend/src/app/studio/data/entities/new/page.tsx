import { EntityForm } from "@/components/data/entity-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireResourceAccess } from "@/server/lib/auth/organization";
import { ensureDefaultApp } from "@/server/lib/data/modeling";
import { db } from "@/server/lib/db/client";
import { apps, entities } from "@/server/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function NewEntityPage() {
  const current = await requireResourceAccess("data", "create");
  await ensureDefaultApp({
    orgId: current.organization.id,
    userId: current.userId,
  });
  const [appOptions, entityOptions] = await Promise.all([
    db
      .select({ id: apps.id, name: apps.name })
      .from(apps)
      .where(eq(apps.orgId, current.organization.id)),
    db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(eq(entities.orgId, current.organization.id)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New entity"
        description="Create a business data model and its fields."
      />
      <EntityForm apps={appOptions} entities={entityOptions} />
    </div>
  );
}
