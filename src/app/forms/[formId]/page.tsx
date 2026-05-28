import { and, eq } from "drizzle-orm";
import { Bot } from "lucide-react";

import { FormSubmitClient } from "@/components/forms/form-submit-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireResourceAccess } from "@/lib/auth/organization";
import { mapRecordDataToFormData } from "@/lib/data/modeling";
import { db } from "@/lib/db/client";
import { entityRecords, forms } from "@/lib/db/schema";
import {
  formVersionSchema,
  formVersionSettings,
  getLatestPublishedFormVersion,
} from "@/lib/forms/versions";

export const dynamic = "force-dynamic";

export default async function PublicFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ formId: string }>;
  searchParams?: Promise<{ recordId?: string }>;
}) {
  const { formId } = await params;
  const { recordId } = (await searchParams) || {};
  const form = await db.query.forms.findFirst({
    where: eq(forms.id, formId),
  });

  const publishedVersion = form
    ? await getLatestPublishedFormVersion(form.id)
    : null;
  const settings = publishedVersion ? formVersionSettings(publishedVersion) : null;

  if (!form || form.status === "archived" || !publishedVersion) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Form unavailable</CardTitle>
            <CardDescription>
              This form is not published or no longer exists.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!settings?.collectingEnabled) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Form closed</CardTitle>
            <CardDescription>{settings?.closedMessage}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const initialData =
    recordId && form.entityId
      ? await getInitialFormDataForRecord({
          form,
          recordId,
          schema: formVersionSchema(publishedVersion),
        })
      : null;

  if (recordId && !initialData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Record unavailable</CardTitle>
            <CardDescription>
              This record cannot be edited with the selected form.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center gap-2">
          <Bot className="size-8 text-primary" />
          <span className="text-xl font-bold">Looma</span>
        </div>
        <Card>
          <CardHeader>
            <h1 className="font-semibold leading-none tracking-tight">
              {publishedVersion.name}
            </h1>
            {publishedVersion.description ? (
              <CardDescription>{publishedVersion.description}</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            <FormSubmitClient
              formId={form.id}
              recordId={recordId}
              schema={formVersionSchema(publishedVersion)}
              settings={settings}
              initialValues={initialData || undefined}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

async function getInitialFormDataForRecord({
  form,
  recordId,
  schema,
}: {
  form: typeof forms.$inferSelect;
  recordId: string;
  schema: ReturnType<typeof formVersionSchema>;
}) {
  const current = await requireResourceAccess("data", "update");
  if (current.organization.id !== form.orgId || !form.appId || !form.entityId) {
    return null;
  }

  const record = await db.query.entityRecords.findFirst({
    where: and(
      eq(entityRecords.id, recordId),
      eq(entityRecords.orgId, form.orgId),
      eq(entityRecords.appId, form.appId),
      eq(entityRecords.entityId, form.entityId)
    ),
  });

  if (!record) return null;
  return mapRecordDataToFormData(record.data as Record<string, unknown>, schema);
}
