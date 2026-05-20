import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { Boxes, Database } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import { apps, entities, entityRecords } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function AppRuntimeHomePage() {
  const current = await requireResourceAccess("apps", "read");
  const appRows = await db
    .select()
    .from(apps)
    .where(eq(apps.orgId, current.organization.id))
    .orderBy(desc(apps.updatedAt));

  const items = await Promise.all(
    appRows.map(async (app) => {
      const [entityCount] = await db
        .select({ value: count() })
        .from(entities)
        .where(eq(entities.appId, app.id));
      const [recordCount] = await db
        .select({ value: count() })
        .from(entityRecords)
        .where(eq(entityRecords.appId, app.id));
      return {
        ...app,
        entityCount: entityCount?.value ?? 0,
        recordCount: recordCount?.value ?? 0,
      };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Apps"
        description="Use published business apps and work with their records."
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No apps available"
          description="Create an app in Studio before using the runtime."
          action={
            <Button asChild>
              <Link href="/studio/apps/new">Create in Studio</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((app) => (
            <Link key={app.id} href={`/app/apps/${app.id}`}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{app.name}</CardTitle>
                      <CardDescription>
                        {app.description || "Business app runtime"}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{app.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border p-3">
                    <Database className="mb-2 size-4 text-muted-foreground" />
                    <div className="text-2xl font-semibold">{app.entityCount}</div>
                    <p className="text-muted-foreground">Entities</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <Boxes className="mb-2 size-4 text-muted-foreground" />
                    <div className="text-2xl font-semibold">{app.recordCount}</div>
                    <p className="text-muted-foreground">Records</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
