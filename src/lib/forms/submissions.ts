import type { FormSchema } from "@/lib/forms/field-schema";

export function submissionFields(schema: FormSchema) {
  return schema.fields.filter((field) => field.type !== "divider");
}

export function formatSubmissionValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function csvEscape(value: unknown) {
  const text = formatSubmissionValue(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function submissionsToCsv({
  schema,
  submissions,
}: {
  schema: FormSchema;
  submissions: Array<{
    id: string;
    entityRecordId?: string | null;
    data: unknown;
    createdAt?: Date | string | null;
  }>;
}) {
  const fields = submissionFields(schema);
  const header = [
    "Submission ID",
    "Submitted At",
    "Entity Record ID",
    ...fields.map((field) => field.label),
  ];

  const rows = submissions.map((submission) => {
    const data = (submission.data || {}) as Record<string, unknown>;
    return [
      submission.id,
      submission.createdAt ? new Date(submission.createdAt).toISOString() : "",
      submission.entityRecordId || "",
      ...fields.map((field) => data[field.id]),
    ];
  });

  return [header, ...rows]
    .map((row) => row.map((value) => csvEscape(value)).join(","))
    .join("\n");
}
