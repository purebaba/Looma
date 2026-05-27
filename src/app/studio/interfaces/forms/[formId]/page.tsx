import Link from "next/link";
import { and, asc, count, eq } from "drizzle-orm";
import {
  Database,
  ExternalLink,
  Inbox,
  LayoutTemplate,
  Settings,
} from "lucide-react";

import { FormBuilder } from "@/components/forms/form-builder";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireResourceAccess } from "@/lib/auth/organization";
import { db } from "@/lib/db/client";
import {
  apps,
  entities,
  entityFields,
  formSubmissions,
  forms,
} from "@/lib/db/schema";
import type { FormSchema } from "@/lib/forms/field-schema";

export const dynamic = "force-dynamic";

export default async function EditFormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  const current = await requireResourceAccess("forms", "update");
  const form = await db.query.forms.findFirst({
    where: and(eq(forms.id, formId), eq(forms.orgId, current.organization.id)),
  });

  if (!form) {
    return (
      <PageHeader
        title="Form not found"
        description="This form does not exist in the current organization."
      />
    );
  }

  const [appOptions, entityRows, submissionCount, boundEntity] = await Promise.all([
    db
      .select({ id: apps.id, name: apps.name })
      .from(apps)
      .where(eq(apps.orgId, current.organization.id)),
    db
      .select()
      .from(entities)
      .where(eq(entities.orgId, current.organization.id)),
    db
      .select({ value: count() })
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, form.id)),
    form.entityId
      ? db.query.entities.findFirst({
          where: and(
            eq(entities.id, form.entityId),
            eq(entities.orgId, current.organization.id)
          ),
        })
      : Promise.resolve(null),
  ]);
  const entityOptions = await Promise.all(
    entityRows.map(async (entity) => ({
      id: entity.id,
      appId: entity.appId,
      name: entity.name,
      fields: await db
        .select({
          id: entityFields.id,
          name: entityFields.name,
          slug: entityFields.slug,
          type: entityFields.type,
          required: entityFields.required,
          config: entityFields.config,
          order: entityFields.order,
        })
        .from(entityFields)
        .where(eq(entityFields.entityId, entity.id))
        .orderBy(asc(entityFields.order)),
    }))
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={form.name}
        description="Manage the form interface, public fill flow, responses, and the records it creates."
        actions={
          <div className="flex flex-wrap gap-2">
            {form.status === "published" ? (
              <Button asChild>
                <Link href={`/forms/${form.id}`}>
                  <ExternalLink className="size-4" />
                  Fill form
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={`/studio/interfaces/forms/${form.id}/submissions`}>
                <Inbox className="size-4" />
                Responses
              </Link>
            </Button>
            {form.entityId ? (
              <Button asChild variant="outline">
                <Link href={`/studio/data/entities/${form.entityId}/records`}>
                  <Database className="size-4" />
                  Records
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={form.status === "published" ? "default" : "secondary"}>
          {form.status}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Version {form.version || 1}
        </span>
        <span className="text-sm text-muted-foreground">
          {submissionCount[0]?.value ?? 0} responses
        </span>
        <span className="text-sm text-muted-foreground">
          Entity: {boundEntity?.name || "Auto-created on save"}
        </span>
      </div>
      <Card>
        <CardContent className="flex flex-wrap gap-2 p-2">
          <Button asChild variant="default" size="sm">
            <Link href="#builder">
              <LayoutTemplate className="size-4" />
              Builder
            </Link>
          </Button>
          {form.status === "published" ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/forms/${form.id}`}>
                <ExternalLink className="size-4" />
                Public form
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="sm">
            <Link href={`/studio/interfaces/forms/${form.id}/submissions`}>
              <Inbox className="size-4" />
              Responses
            </Link>
          </Button>
          {form.entityId ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/studio/data/entities/${form.entityId}/records`}>
                <Database className="size-4" />
                Records
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="sm">
            <Link href="#settings">
              <Settings className="size-4" />
              Settings
            </Link>
          </Button>
        </CardContent>
      </Card>
      <FormBuilder
        apps={appOptions}
        entities={entityOptions}
        initialForm={{
          id: form.id,
          appId: form.appId,
          entityId: form.entityId,
          name: form.name,
          description: form.description,
          schema: form.schema as FormSchema,
          settings: form.settings,
          status: form.status,
        }}
      />
    </div>
  );
}
