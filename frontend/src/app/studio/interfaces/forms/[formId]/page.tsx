import Link from "next/link";
import { and, asc, count, eq } from "drizzle-orm";
import {
  AlertCircle,
  Database,
  ExternalLink,
  Inbox,
  LayoutTemplate,
  Settings,
} from "lucide-react";

import { FormBuilder } from "@/components/forms/form-builder";
import { FormVersionActions } from "@/components/forms/form-version-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireResourceAccess } from "@/server/lib/auth/organization";
import { db } from "@/server/lib/db/client";
import {
  apps,
  entities,
  entityFields,
  formSubmissions,
  forms,
} from "@/server/lib/db/schema";
import type { FormSchema } from "@/server/lib/forms/field-schema";
import { diffFormSchemas } from "@/server/lib/forms/schema-governance";
import { getFormVersions } from "@/server/lib/forms/versions";

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

  const [
    appOptions,
    entityRows,
    submissionCount,
    boundEntity,
    versions,
  ] = await Promise.all([
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
    getFormVersions(form.id),
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
  const latestPublishedVersion = versions[0];
  const draftDiffs = latestPublishedVersion
    ? diffFormSchemas({
        draftSchema: form.schema as FormSchema,
        baselineSchema: latestPublishedVersion.schema as FormSchema,
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={form.name}
        description="Manage the form interface, public fill flow, responses, and the records it creates."
        actions={
          <div className="flex flex-wrap gap-2">
            {versions.length > 0 && form.status !== "archived" ? (
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
        {versions.length > 0 && form.status !== "archived" ? (
          <Badge variant="secondary">Public version live</Badge>
        ) : null}
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
          {versions.length > 0 && form.status !== "archived" ? (
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
      {latestPublishedVersion ? (
        <Card data-testid="form-publish-diff">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="size-4 text-amber-600" />
              Draft changes since Version {latestPublishedVersion.version}
            </CardTitle>
            <CardDescription>
              Review field changes before publishing this draft. Responses keep
              their original version snapshots.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {draftDiffs.length ? (
              <div className="grid gap-2">
                {draftDiffs.map((diff) => (
                  <div
                    key={`${diff.kind}-${diff.fieldId}`}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          diff.severity === "danger"
                            ? "destructive"
                            : diff.severity === "warning"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {diff.kind}
                      </Badge>
                      <p className="font-medium">{diff.summary}</p>
                    </div>
                    <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
                      {diff.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No field-level changes from the live published version.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardContent className="grid gap-3 p-4">
          <div>
            <h3 className="font-semibold">Version history</h3>
            <p className="text-sm text-muted-foreground">
              Published snapshots stay available to public submitters while you edit a new draft.
            </p>
          </div>
          {versions.length ? (
            <div className="grid gap-2">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      Version {version.version}: {version.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Published{" "}
                      {version.publishedAt
                        ? new Intl.DateTimeFormat("en", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(version.publishedAt)
                        : "recently"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Published snapshot</Badge>
                    <FormVersionActions
                      formId={form.id}
                      versionId={version.id}
                      version={version.version}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Publish this form to create the first immutable snapshot.
            </p>
          )}
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
          hasPublishedVersion: versions.length > 0,
        }}
      />
    </div>
  );
}
