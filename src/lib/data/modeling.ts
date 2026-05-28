import { and, count, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  apps,
  entities,
  entityFields,
  entityRecords,
  entityRecordVersions,
  formSubmissions,
  forms,
} from "@/lib/db/schema";
import type { FieldSchema, FormSchema } from "@/lib/forms/field-schema";
import { isFieldVisible } from "@/lib/forms/field-schema";

const DEFAULT_APP_NAME = "Core App";

export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "resource";
}

function hasRequiredValidation(field: FieldSchema) {
  return field.validation.some((rule) => rule.type === "required");
}

function fieldConfig(field: FieldSchema) {
  return {
    placeholder: field.placeholder,
    helpText: field.helpText,
    options: field.options,
    validation: field.validation,
    appearance: field.appearance,
  };
}

export async function ensureDefaultApp({
  orgId,
  userId,
}: {
  orgId: string;
  userId?: string;
}) {
  const existing = await db.query.apps.findFirst({
    where: eq(apps.orgId, orgId),
  });
  if (existing) return existing;

  const [app] = await db
    .insert(apps)
    .values({
      orgId,
      createdBy: userId,
      name: DEFAULT_APP_NAME,
      slug: "core-app",
      description: "Default app for business data models.",
      status: "active",
    })
    .returning();
  return app;
}

export async function ensureEntityForForm({
  orgId,
  appId,
  userId,
  formName,
  entityId,
  schema,
}: {
  orgId: string;
  appId: string;
  userId?: string;
  formName: string;
  entityId?: string | null;
  schema: FormSchema;
}) {
  let entity = entityId
    ? await db.query.entities.findFirst({
        where: and(eq(entities.id, entityId), eq(entities.orgId, orgId)),
      })
    : null;

  if (!entity) {
    const [created] = await db
      .insert(entities)
      .values({
        orgId,
        appId,
        createdBy: userId,
        name: formName,
        slug: `${slugify(formName)}-${Date.now().toString(36)}`,
        description: `Data model generated for ${formName}.`,
        storageMode: "json",
      })
      .returning();
    entity = created;
  }

  const syncedSchema = await syncFieldsToEntity({
    entityId: entity.id,
    schema,
  });

  return { entity, schema: syncedSchema };
}

export async function syncFieldsToEntity({
  entityId,
  schema,
}: {
  entityId: string;
  schema: FormSchema;
}) {
  const syncedFields: FieldSchema[] = [];
  const usedDataKeys = new Set<string>();

  for (const [index, field] of schema.fields.entries()) {
    if (field.type === "divider") {
      syncedFields.push(field);
      continue;
    }

    const baseDataKey = field.dataKey || slugify(field.label || field.id);
    let dataKey = baseDataKey;
    let suffix = 2;
    while (usedDataKeys.has(dataKey)) {
      dataKey = `${baseDataKey}-${suffix}`;
      suffix += 1;
    }
    usedDataKeys.add(dataKey);
    let entityField = field.entityFieldId
      ? await db.query.entityFields.findFirst({
          where: and(
            eq(entityFields.id, field.entityFieldId),
            eq(entityFields.entityId, entityId)
          ),
        })
      : null;

    if (!entityField) {
      const [created] = await db
        .insert(entityFields)
        .values({
          entityId,
          name: field.label,
          slug: dataKey,
          type: field.type,
          required: hasRequiredValidation(field),
          defaultValue: field.defaultValue,
          config: fieldConfig(field),
          order: field.appearance.order ?? index,
        })
        .returning();
      entityField = created;
    } else {
      await db
        .update(entityFields)
        .set({
          name: field.label,
          type: field.type,
          required: hasRequiredValidation(field),
          defaultValue: field.defaultValue,
          config: fieldConfig(field),
          order: field.appearance.order ?? index,
          updatedAt: new Date(),
        })
        .where(eq(entityFields.id, entityField.id));
    }

    syncedFields.push({
      ...field,
      entityFieldId: entityField.id,
      dataKey,
      layout: {
        width: field.appearance.width,
        order: field.appearance.order ?? index,
      },
    });
  }

  return { ...schema, fields: syncedFields };
}

export function mapSubmissionToRecordData(
  data: Record<string, unknown>,
  schema: FormSchema
) {
  return schema.fields.reduce<Record<string, unknown>>((recordData, field) => {
    if (field.type === "divider") return recordData;
    if (!isFieldVisible(data, field)) return recordData;
    const key = field.dataKey || slugify(field.label || field.id);
    recordData[key] = data[field.id];
    return recordData;
  }, {});
}

export function mapRecordDataToFormData(
  data: Record<string, unknown>,
  schema: FormSchema
) {
  return schema.fields.reduce<Record<string, unknown>>((formData, field) => {
    if (field.type === "divider") return formData;
    const key = field.dataKey || slugify(field.label || field.id);
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      formData[field.id] = data[key];
    }
    return formData;
  }, {});
}

export async function createRecordAndSubmission({
  form,
  data,
  schema,
  formVersionId,
  submittedBy,
  ipAddress,
  userAgent,
}: {
  form: typeof forms.$inferSelect;
  data: Record<string, unknown>;
  schema?: FormSchema;
  formVersionId?: string | null;
  submittedBy?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  if (!form.appId || !form.entityId) {
    throw new Error("Published form is not bound to an app and entity.");
  }

  const submissionSchema = schema || (form.schema as FormSchema);
  const recordData = mapSubmissionToRecordData(data, submissionSchema);
  const [record] = await db
    .insert(entityRecords)
    .values({
      orgId: form.orgId,
      appId: form.appId,
      entityId: form.entityId,
      data: recordData,
      createdBy: submittedBy,
      updatedBy: submittedBy,
    })
    .returning();

  await db.insert(entityRecordVersions).values({
    recordId: record.id,
    version: 1,
    data: recordData,
    changedBy: submittedBy,
  });

  const [submission] = await db
    .insert(formSubmissions)
    .values({
      formId: form.id,
      formVersionId,
      entityRecordId: record.id,
      data,
      submittedBy,
      ipAddress,
      userAgent,
    })
    .returning();

  return { record, submission };
}

export async function updateRecordAndSubmission({
  form,
  recordId,
  data,
  schema,
  formVersionId,
  submittedBy,
  ipAddress,
  userAgent,
}: {
  form: typeof forms.$inferSelect;
  recordId: string;
  data: Record<string, unknown>;
  schema?: FormSchema;
  formVersionId?: string | null;
  submittedBy?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  if (!form.appId || !form.entityId) {
    throw new Error("Published form is not bound to an app and entity.");
  }

  const existingRecord = await db.query.entityRecords.findFirst({
    where: and(
      eq(entityRecords.id, recordId),
      eq(entityRecords.orgId, form.orgId),
      eq(entityRecords.appId, form.appId),
      eq(entityRecords.entityId, form.entityId)
    ),
  });

  if (!existingRecord) {
    return null;
  }

  const submissionSchema = schema || (form.schema as FormSchema);
  const recordData = mapSubmissionToRecordData(data, submissionSchema);
  const nextData = {
    ...(existingRecord.data as Record<string, unknown>),
    ...recordData,
  };

  const [record] = await db
    .update(entityRecords)
    .set({
      data: nextData,
      updatedBy: submittedBy,
      updatedAt: new Date(),
    })
    .where(eq(entityRecords.id, existingRecord.id))
    .returning();

  const [versionCount] = await db
    .select({ value: count() })
    .from(entityRecordVersions)
    .where(eq(entityRecordVersions.recordId, record.id));

  await db.insert(entityRecordVersions).values({
    recordId: record.id,
    version: (versionCount?.value ?? 0) + 1,
    data: nextData,
    changedBy: submittedBy,
  });

  const [submission] = await db
    .insert(formSubmissions)
    .values({
      formId: form.id,
      formVersionId,
      entityRecordId: record.id,
      data,
      submittedBy,
      ipAddress,
      userAgent,
    })
    .returning();

  return { record, submission };
}
