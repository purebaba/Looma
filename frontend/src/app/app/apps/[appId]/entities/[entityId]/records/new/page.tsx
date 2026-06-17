import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";

import { RecordForm } from "@/components/data/record-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requireResourceAccess } from "@/server/lib/auth/organization";
import { db } from "@/server/lib/db/client";
import { apps, entities, entityFields } from "@/server/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function RuntimeNewRecordPage({
  params,
}: {
  params: Promise<{ appId: string; entityId: string }>;
}) {
  const { appId, entityId } = await params;
  const current = await requireResourceAccess("data", "create");
  const app = await db.query.apps.findFirst({
    where: and(eq(apps.id, appId), eq(apps.orgId, current.organization.id)),
  });
  const entity = app
    ? await db.query.entities.findFirst({
        where: and(eq(entities.id, entityId), eq(entities.appId, app.id)),
      })
    : null;

  if (!app || !entity) {
    return (
      <PageHeader
        title="Entity not found"
        description="This entity does not exist in the selected app."
      />
    );
  }

  const fields = await db
    .select()
    .from(entityFields)
    .where(eq(entityFields.entityId, entity.id))
    .orderBy(asc(entityFields.order));
  const returnPathPrefix = `/app/apps/${app.id}/entities/${entity.id}/records`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`New ${entity.name} record`}
        description={`Create a business record in ${app.name}.`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/app/apps/${app.id}/entities/${entity.id}`}>
              <ArrowLeft className="size-4" />
              Records
            </Link>
          </Button>
        }
      />

      <RecordForm
        entityId={entity.id}
        fields={fields}
        returnPathPrefix={returnPathPrefix}
      />
    </div>
  );
}
