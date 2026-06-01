import type { FieldSchema, FormSchema } from "@/lib/forms/field-schema";

export type FormSchemaGovernanceIssue = {
  fieldId: string;
  fieldLabel: string;
  code: "data_key_changed" | "entity_binding_changed";
  message: string;
};

export type FormSchemaDiffItem = {
  fieldId: string;
  fieldLabel: string;
  kind: "added" | "removed" | "changed";
  severity: "info" | "warning" | "danger";
  summary: string;
  details: string[];
};

export function reconcileSchemaWithPublishedBaseline({
  incomingSchema,
  baselineSchema,
}: {
  incomingSchema: FormSchema;
  baselineSchema?: FormSchema | null;
}) {
  if (!baselineSchema) {
    return { schema: incomingSchema, issues: [] as FormSchemaGovernanceIssue[] };
  }

  const baselineFieldsById = new Map(
    baselineSchema.fields.map((field) => [field.id, field])
  );
  const issues: FormSchemaGovernanceIssue[] = [];

  const fields = incomingSchema.fields.map((field) => {
    const baselineField = baselineFieldsById.get(field.id);
    if (!baselineField) return field;

    const reconciled: FieldSchema = { ...field };
    if (baselineField.dataKey && !field.dataKey) {
      reconciled.dataKey = baselineField.dataKey;
    }
    if (baselineField.entityFieldId && !field.entityFieldId) {
      reconciled.entityFieldId = baselineField.entityFieldId;
    }

    if (
      baselineField.dataKey &&
      reconciled.dataKey &&
      baselineField.dataKey !== reconciled.dataKey
    ) {
      issues.push({
        fieldId: field.id,
        fieldLabel: field.label || baselineField.label,
        code: "data_key_changed",
        message: `Field "${field.label || baselineField.label}" is published with data key "${baselineField.dataKey}" and cannot be changed to "${reconciled.dataKey}". Create a new field instead.`,
      });
    }

    if (
      baselineField.entityFieldId &&
      reconciled.entityFieldId &&
      baselineField.entityFieldId !== reconciled.entityFieldId
    ) {
      issues.push({
        fieldId: field.id,
        fieldLabel: field.label || baselineField.label,
        code: "entity_binding_changed",
        message: `Field "${field.label || baselineField.label}" is already bound to an Entity Field and cannot be rebound after publishing. Create a new field instead.`,
      });
    }

    return reconciled;
  });

  return {
    schema: { ...incomingSchema, fields },
    issues,
  };
}

export function diffFormSchemas({
  draftSchema,
  baselineSchema,
}: {
  draftSchema: FormSchema;
  baselineSchema: FormSchema;
}) {
  const draftFieldsById = new Map(draftSchema.fields.map((field) => [field.id, field]));
  const baselineFieldsById = new Map(
    baselineSchema.fields.map((field) => [field.id, field])
  );
  const diffs: FormSchemaDiffItem[] = [];

  for (const field of draftSchema.fields) {
    const baselineField = baselineFieldsById.get(field.id);
    if (!baselineField) {
      diffs.push({
        fieldId: field.id,
        fieldLabel: field.label,
        kind: "added",
        severity: "info",
        summary: `Added field "${field.label}"`,
        details: [
          `Type: ${field.type}`,
          `Data key: ${field.dataKey || "assigned on save"}`,
        ],
      });
      continue;
    }

    const details = changedFieldDetails(field, baselineField);
    if (details.length > 0) {
      const dangerous = details.some(
        (detail) =>
          detail.startsWith("Data key") || detail.startsWith("Entity binding")
      );
      diffs.push({
        fieldId: field.id,
        fieldLabel: field.label || baselineField.label,
        kind: "changed",
        severity: dangerous ? "danger" : "warning",
        summary: `Changed field "${baselineField.label}"`,
        details,
      });
    }
  }

  for (const field of baselineSchema.fields) {
    if (!draftFieldsById.has(field.id)) {
      diffs.push({
        fieldId: field.id,
        fieldLabel: field.label,
        kind: "removed",
        severity: "danger",
        summary: `Removed field "${field.label}"`,
        details: [
          `Existing submissions keep historical snapshots, but future Record data will no longer collect ${field.dataKey || field.id}.`,
        ],
      });
    }
  }

  return diffs;
}

function changedFieldDetails(field: FieldSchema, baselineField: FieldSchema) {
  const details: string[] = [];

  if (field.label !== baselineField.label) {
    details.push(`Label: "${baselineField.label}" -> "${field.label}"`);
  }
  if (field.type !== baselineField.type) {
    details.push(`Type: ${baselineField.type} -> ${field.type}`);
  }
  if ((field.dataKey || "") !== (baselineField.dataKey || "")) {
    details.push(
      `Data key: ${baselineField.dataKey || "none"} -> ${field.dataKey || "none"}`
    );
  }
  if ((field.entityFieldId || "") !== (baselineField.entityFieldId || "")) {
    details.push("Entity binding changed");
  }
  if (isRequired(field) !== isRequired(baselineField)) {
    details.push(
      `Required: ${isRequired(baselineField) ? "yes" : "no"} -> ${isRequired(field) ? "yes" : "no"}`
    );
  }
  if (JSON.stringify(field.options || []) !== JSON.stringify(baselineField.options || [])) {
    details.push("Options changed");
  }
  if (
    JSON.stringify(field.validation || []) !==
    JSON.stringify(baselineField.validation || [])
  ) {
    details.push("Validation changed");
  }
  if (JSON.stringify(field.defaultValue) !== JSON.stringify(baselineField.defaultValue)) {
    details.push("Default value changed");
  }
  if (
    JSON.stringify(field.condition || null) !==
    JSON.stringify(baselineField.condition || null)
  ) {
    details.push("Conditional visibility changed");
  }

  return details;
}

function isRequired(field: FieldSchema) {
  return field.validation.some((rule) => rule.type === "required");
}
