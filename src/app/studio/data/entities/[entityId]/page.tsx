import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import { apps, entities, entityFields } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function EntityPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;
  const current = await requireResourceAccess("data", "read");
  const entity = await db.query.entities.findFirst({
    where: and(eq(entities.id, entityId), eq(entities.orgId, current.organization.id)),
  });

  if (!entity) {
    return (
      <PageHeader
        title="Entity not found"
        description="This entity does not exist in the current organization."
      />
    );
  }

  const [app, fields] = await Promise.all([
    db.query.apps.findFirst({ where: eq(apps.id, entity.appId) }),
    db
      .select()
      .from(entityFields)
      .where(eq(entityFields.entityId, entity.id))
      .orderBy(asc(entityFields.order)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={entity.name}
        description={entity.description || "Business data model."}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/studio/data/entities">
                <ArrowLeft className="size-4" />
                Entities
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/studio/data/entities/${entity.id}/edit`}>Edit entity</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/studio/data/entities/${entity.id}/views/table`}>
                Configure table
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/studio/data/entities/${entity.id}/records`}>
                View records
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>App</CardTitle>
            <CardDescription>Business application container.</CardDescription>
          </CardHeader>
          <CardContent>{app?.name || "Unknown app"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Storage</CardTitle>
            <CardDescription>MVP records use JSON storage.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{entity.storageMode}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fields</CardTitle>
            <CardDescription>Fields synced from bound forms.</CardDescription>
          </CardHeader>
          <CardContent>{fields.length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fields</CardTitle>
          <CardDescription>
            Entity fields define the business data shape. Forms decide how users input them.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Data key</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Required</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={field.id}>
                  <TableCell className="font-medium">{field.name}</TableCell>
                  <TableCell>{field.slug}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{field.type}</Badge>
                  </TableCell>
                  <TableCell>{field.required ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
