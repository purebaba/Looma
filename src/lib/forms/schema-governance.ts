import type { FieldSchema, FormSchema } from "@/lib/forms/field-schema";

export type FormSchemaGovernanceIssue = {
  fieldId: string;
  fieldLabel: string;
  code: "data_key_changed" | "entity_binding_changed";
  message: string;
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
