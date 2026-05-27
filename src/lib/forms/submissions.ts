import type { FormSchema } from "@/lib/forms/field-schema";

type SubmissionLike = {
  id: string;
  entityRecordId?: string | null;
  data: unknown;
  createdAt?: Date | string | null;
};

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
  submissions: SubmissionLike[];
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

export function filterSubmissions<T extends SubmissionLike>({
  schema,
  submissions,
  query,
  fieldId,
  fieldValue,
}: {
  schema: FormSchema;
  submissions: T[];
  query?: string | null;
  fieldId?: string | null;
  fieldValue?: string | null;
}) {
  const normalizedQuery = query?.trim().toLowerCase();
  const normalizedFieldValue = fieldValue?.trim().toLowerCase();
  const fields = submissionFields(schema);

  return submissions.filter((submission) => {
    const data = (submission.data || {}) as Record<string, unknown>;

    if (normalizedQuery) {
      const haystack = [
        submission.id,
        submission.entityRecordId || "",
        ...fields.map((field) => formatSubmissionValue(data[field.id])),
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(normalizedQuery)) return false;
    }

    if (fieldId && normalizedFieldValue) {
      const fieldText = formatSubmissionValue(data[fieldId]).toLowerCase();
      if (!fieldText.includes(normalizedFieldValue)) return false;
    }

    return true;
  });
}

export function sortSubmissions<T extends SubmissionLike>(
  submissions: T[],
  direction: "asc" | "desc"
) {
  return [...submissions].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return direction === "asc" ? leftTime - rightTime : rightTime - leftTime;
  });
}
