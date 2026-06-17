import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { formVersions, forms } from "@/lib/db/schema";
import type { FormSchema } from "@/lib/forms/field-schema";
import { normalizeFormSettings, type FormSettings } from "@/lib/forms/settings";

export type PublishedFormVersion = typeof formVersions.$inferSelect;

export async function createPublishedFormVersion({
  form,
  publishedBy,
}: {
  form: typeof forms.$inferSelect;
  publishedBy?: string;
}) {
  const existing = await db.query.formVersions.findFirst({
    where: and(
      eq(formVersions.formId, form.id),
      eq(formVersions.version, form.version || 1)
    ),
  });
  if (existing) return existing;

  const [version] = await db
    .insert(formVersions)
    .values({
      formId: form.id,
      version: form.version || 1,
      name: form.name,
      description: form.description,
      schema: form.schema,
      settings: form.settings,
      publishedBy,
    })
    .returning();

  return version;
}

export async function getLatestPublishedFormVersion(formId: string) {
  return db.query.formVersions.findFirst({
    where: eq(formVersions.formId, formId),
    orderBy: desc(formVersions.version),
  });
}

export async function getFormVersions(formId: string) {
  return db.query.formVersions.findMany({
    where: eq(formVersions.formId, formId),
    orderBy: desc(formVersions.version),
  });
}

export async function getSubmissionFormVersion({
  formId,
  formVersionId,
}: {
  formId: string;
  formVersionId?: string | null;
}) {
  if (formVersionId) {
    const version = await db.query.formVersions.findFirst({
      where: and(
        eq(formVersions.id, formVersionId),
        eq(formVersions.formId, formId)
      ),
    });
    if (version) return version;
  }

  return getLatestPublishedFormVersion(formId);
}

export function formVersionSchema(version: PublishedFormVersion) {
  return version.schema as FormSchema;
}

export function formVersionSettings(version: PublishedFormVersion): FormSettings {
  return normalizeFormSettings(version.settings);
}
