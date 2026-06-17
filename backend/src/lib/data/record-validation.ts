import { and, eq, ne } from "drizzle-orm";

import { entityRecords } from "@/lib/db/schema";
import type { Database } from "@/lib/db/client";

import type { entityFields } from "@/lib/db/schema";

type EntityFieldRow = typeof entityFields.$inferSelect;

export interface ValidationError {
  field: string;
  message: string;
  type: "required" | "unique" | "type" | "min" | "max" | "pattern";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

function isEmpty(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && value === date.toISOString().slice(0, 10);
}

function isValidDateTime(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

export function validateRecordField(
  value: unknown,
  field: EntityFieldRow
): { valid: boolean; message?: string } {
  if (field.required && isEmpty(value)) {
    return { valid: false, message: `${field.name} is required` };
  }

  if (isEmpty(value)) return { valid: true };

  const config = (field.config || {}) as Record<string, unknown>;
  const options = (config.options || []) as { label: string; value: string }[];
  const optionValues = new Set(options.map((o) => o.value));

  switch (field.type) {
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return { valid: false, message: `${field.name} must be a valid number` };
      }
      break;
    case "email":
      if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { valid: false, message: `${field.name} must be a valid email` };
      }
      break;
    case "phone":
      if (typeof value !== "string" || !/^[+()\-\s\d]{6,}$/.test(value)) {
        return { valid: false, message: `${field.name} must be a valid phone number` };
      }
      break;
    case "date":
      if (typeof value !== "string" || !isValidDate(value)) {
        return { valid: false, message: `${field.name} must be a valid date` };
      }
      break;
    case "datetime":
      if (typeof value !== "string" || !isValidDateTime(value)) {
        return { valid: false, message: `${field.name} must be a valid datetime` };
      }
      break;
    case "select":
    case "radio":
      if (options.length > 0 && !optionValues.has(String(value))) {
        return { valid: false, message: `${field.name} has an invalid selection` };
      }
      break;
    case "checkbox":
      if (options.length > 0) {
        const arr = Array.isArray(value) ? value : [value];
        if (!arr.every((v) => optionValues.has(String(v)))) {
          return { valid: false, message: `${field.name} has an invalid selection` };
        }
      }
      break;
    case "switch":
      if (typeof value !== "boolean") {
        return { valid: false, message: `${field.name} must be true or false` };
      }
      break;
    case "reference":
      if (typeof value !== "string" || value.trim() === "") {
        return { valid: false, message: `${field.name} must be a valid reference` };
      }
      break;
  }

  const rules = (config.validation || []) as Array<{
    type: string;
    value?: string | number;
    message: string;
  }>;

  for (const rule of rules) {
    switch (rule.type) {
      case "min":
        if (typeof value === "string" && value.length < (rule.value as number)) {
          return { valid: false, message: rule.message };
        }
        if (typeof value === "number" && value < (rule.value as number)) {
          return { valid: false, message: rule.message };
        }
        break;
      case "max":
        if (typeof value === "string" && value.length > (rule.value as number)) {
          return { valid: false, message: rule.message };
        }
        if (typeof value === "number" && value > (rule.value as number)) {
          return { valid: false, message: rule.message };
        }
        break;
      case "pattern":
        if (typeof value === "string" && rule.value) {
          try {
            if (!new RegExp(rule.value as string).test(value)) {
              return { valid: false, message: rule.message };
            }
          } catch {
            return { valid: false, message: rule.message };
          }
        }
        break;
    }
  }

  return { valid: true };
}

export function validateRecordData(
  data: Record<string, unknown>,
  fields: EntityFieldRow[],
  options?: { mode: "create" | "update" }
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const field of fields) {
    let value = data[field.slug];

    if (options?.mode === "create" && isEmpty(value) && field.defaultValue !== null && field.defaultValue !== undefined) {
      value = field.defaultValue as unknown;
      data[field.slug] = value;
    }

    const result = validateRecordField(value, field);
    if (!result.valid) {
      errors.push({
        field: field.slug,
        message: result.message!,
        type: field.required && isEmpty(data[field.slug]) ? "required" : "type",
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function checkUniqueConstraints(
  data: Record<string, unknown>,
  fields: EntityFieldRow[],
  db: Database,
  opts: {
    entityId: string;
    excludeRecordId?: string;
  }
): Promise<ValidationError[]> {
  const uniqueFields = fields.filter((f) => f.unique);
  if (uniqueFields.length === 0) return [];

  const conditions = [eq(entityRecords.entityId, opts.entityId)];
  if (opts.excludeRecordId) {
    conditions.push(ne(entityRecords.id, opts.excludeRecordId));
  }

  const allRecords = await db
    .select()
    .from(entityRecords)
    .where(and(...conditions));

  const errors: ValidationError[] = [];

  for (const record of allRecords) {
    const recordData = record.data as Record<string, unknown>;
    for (const field of uniqueFields) {
      const newValue = data[field.slug];
      if (isEmpty(newValue)) continue;
      const existingValue = recordData[field.slug];
      if (JSON.stringify(newValue) === JSON.stringify(existingValue)) {
        errors.push({
          field: field.slug,
          message: `${field.name} must be unique`,
          type: "unique",
        });
      }
    }
  }

  return errors;
}

export async function validateReferenceIntegrity(
  data: Record<string, unknown>,
  fields: EntityFieldRow[],
  db: Database,
  orgId: string,
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const referenceFields = fields.filter((f) => f.type === "reference");

  for (const field of referenceFields) {
    const value = data[field.slug];
    if (isEmpty(value)) continue;

    const config = (field.config || {}) as Record<string, unknown>;
    const targetEntityId = config.targetEntityId as string | undefined;
    if (!targetEntityId) continue;

    const targetRecord = await db.query.entityRecords.findFirst({
      where: and(
        eq(entityRecords.id, String(value)),
        eq(entityRecords.entityId, targetEntityId),
        eq(entityRecords.orgId, orgId),
      ),
    });

    if (!targetRecord) {
      errors.push({
        field: field.slug,
        message: `${field.name}: referenced record not found`,
        type: "type",
      });
    }
  }

  return errors;
}
