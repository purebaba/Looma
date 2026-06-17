import type { FormSchema } from "@/lib/forms/field-schema";

type SubmissionLike = {
  id: string;
  formVersionId?: string | null;
  entityRecordId?: string | null;
  status?: string | null;
  data: unknown;
  createdAt?: Date | string | null;
};

type VersionLike = {
  id: string;
  version: number;
  schema: unknown;
};

export type VersionMap = Map<string, VersionLike>;

export function submissionFields(schema: FormSchema) {
  return schema.fields.filter((field) => field.type !== "divider");
}

export function selectSubmissionFields(schema: FormSchema, fieldIds?: string[]) {
  const fields = submissionFields(schema);
  if (!fieldIds?.length) return fields;
  const selected = new Set(fieldIds);
  return fields.filter((field) => selected.has(field.id));
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

export function schemaForSubmission({
  fallbackSchema,
  submission,
  versionsById,
}: {
  fallbackSchema: FormSchema;
  submission: SubmissionLike;
  versionsById?: VersionMap;
}) {
  const version = submission.formVersionId
    ? versionsById?.get(submission.formVersionId)
    : null;
  return version ? (version.schema as FormSchema) : fallbackSchema;
}

export function versionLabelForSubmission({
  submission,
  versionsById,
}: {
  submission: SubmissionLike;
  versionsById?: VersionMap;
}) {
  const version = submission.formVersionId
    ? versionsById?.get(submission.formVersionId)
    : null;
  return version ? `v${version.version}` : "-";
}

export function submissionSnapshotValues({
  fallbackSchema,
  submission,
  versionsById,
  fieldIds,
}: {
  fallbackSchema: FormSchema;
  submission: SubmissionLike;
  versionsById?: VersionMap;
  fieldIds?: string[];
}) {
  const schema = schemaForSubmission({ fallbackSchema, submission, versionsById });
  const data = (submission.data || {}) as Record<string, unknown>;
  return selectSubmissionFields(schema, fieldIds).map((field) => ({
    field,
    value: data[field.id],
    text: `${field.label}: ${formatSubmissionValue(data[field.id])}`,
  }));
}

export function formatSubmissionSnapshot({
  fallbackSchema,
  submission,
  versionsById,
  fieldIds,
}: {
  fallbackSchema: FormSchema;
  submission: SubmissionLike;
  versionsById?: VersionMap;
  fieldIds?: string[];
}) {
  return submissionSnapshotValues({
    fallbackSchema,
    submission,
    versionsById,
    fieldIds,
  })
    .map((item) => item.text)
    .join("; ");
}

export function submissionsToCsv({
  schema,
  submissions,
  versionsById,
  fieldIds,
}: {
  schema: FormSchema;
  submissions: SubmissionLike[];
  versionsById?: VersionMap;
  fieldIds?: string[];
}) {
  const fields = selectSubmissionFields(schema, fieldIds);
  const header = [
    "Submission ID",
    "Submitted At",
    "Entity Record ID",
    "Form Version",
    "Submitted Values",
    ...fields.map((field) => field.label),
  ];

  const rows = submissions.map((submission) => {
    const data = (submission.data || {}) as Record<string, unknown>;
    return [
      submission.id,
      submission.createdAt ? new Date(submission.createdAt).toISOString() : "",
      submission.entityRecordId || "",
      versionLabelForSubmission({ submission, versionsById }),
      formatSubmissionSnapshot({
        fallbackSchema: schema,
        submission,
        versionsById,
        fieldIds,
      }),
      ...fields.map((field) => data[field.id]),
    ];
  });

  return [header, ...rows]
    .map((row) => row.map((value) => csvEscape(value)).join(","))
    .join("\n");
}

export function submissionStatus(submission: SubmissionLike) {
  return submission.status === "archived" ? "archived" : "active";
}

export function filterSubmissionsByStatus<T extends SubmissionLike>(
  submissions: T[],
  status?: string | null
) {
  const normalizedStatus = status === "archived" || status === "all" ? status : "active";
  if (normalizedStatus === "all") return submissions;
  return submissions.filter(
    (submission) => submissionStatus(submission) === normalizedStatus
  );
}

export function filterSubmissions<T extends SubmissionLike>({
  schema,
  submissions,
  query,
  fieldId,
  fieldValue,
  versionsById,
}: {
  schema: FormSchema;
  submissions: T[];
  query?: string | null;
  fieldId?: string | null;
  fieldValue?: string | null;
  versionsById?: VersionMap;
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
        versionLabelForSubmission({ submission, versionsById }),
        formatSubmissionSnapshot({
          fallbackSchema: schema,
          submission,
          versionsById,
        }),
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
