import { and, eq } from "drizzle-orm";

import { AppForm } from "@/components/apps/app-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import { apps } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function EditAppPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = await params;
  const current = await requireResourceAccess("apps", "update");
  const app = await db.query.apps.findFirst({
    where: and(eq(apps.id, appId), eq(apps.orgId, current.organization.id)),
  });

  if (!app) {
    return (
      <PageHeader
        title="App not found"
        description="This app does not exist in the current organization."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={app.name} description="Edit the app container." />
      <AppForm initialApp={app} />
    </div>
  );
}
