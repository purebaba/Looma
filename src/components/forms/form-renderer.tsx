"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type FieldSchema,
  type FormSchema,
  validateForm,
} from "@/lib/forms/field-schema";

type FormValues = Record<string, unknown>;

function getInitialValue(field: FieldSchema) {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === "checkbox") return [];
  if (field.type === "switch") return false;
  return "";
}

export function FormRenderer({
  schema,
  submitLabel = "Submit",
  onSubmit,
  disabled = false,
}: {
  schema: FormSchema;
  submitLabel?: string;
  onSubmit?: (values: FormValues) => Promise<void> | void;
  disabled?: boolean;
}) {
  const initialValues = useMemo(() => {
    return schema.fields.reduce<FormValues>((values, field) => {
      values[field.id] = getInitialValue(field);
      return values;
    }, {});
  }, [schema.fields]);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateValue(fieldId: string, value: unknown) {
    setValues((current) => ({ ...current, [fieldId]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateForm(values, schema);
    setErrors(result.errors);
    if (!result.valid || !onSubmit) return;

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-12 gap-4">
        {schema.fields.map((field) => (
          <FieldControl
            key={field.id}
            field={field}
            value={values[field.id]}
            error={errors[field.id]}
            disabled={disabled || isSubmitting}
            onChange={(value) => updateValue(field.id, value)}
          />
        ))}
      </div>
      {onSubmit ? (
        <Button type="submit" disabled={disabled || isSubmitting}>
          {isSubmitting ? "Submitting..." : submitLabel}
        </Button>
      ) : null}
    </form>
  );
}

function FieldControl({
  field,
  value,
  error,
  disabled,
  onChange,
}: {
  field: FieldSchema;
  value: unknown;
  error?: string;
  disabled?: boolean;
  onChange: (value: unknown) => void;
}) {
  const width = Math.max(1, Math.min(12, field.appearance.width || 12));
  const required = field.validation.some((rule) => rule.type === "required");

  if (field.type === "divider") {
    return <div className="col-span-12 border-t" />;
  }

  return (
    <div className="flex flex-col gap-2" style={{ gridColumn: `span ${width}` }}>
      <Label htmlFor={field.id}>
        {field.label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {renderControl(field, value, disabled, onChange)}
      {field.helpText ? (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function renderControl(
  field: FieldSchema,
  value: unknown,
  disabled: boolean | undefined,
  onChange: (value: unknown) => void
) {
  const common = {
    id: field.id,
    disabled,
    placeholder: field.placeholder,
  };

  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          {...common}
          value={String(value || "")}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "number":
      return (
        <Input
          {...common}
          type="number"
          value={String(value || "")}
          onChange={(event) =>
            onChange(event.target.value === "" ? "" : Number(event.target.value))
          }
        />
      );
    case "email":
      return (
        <Input
          {...common}
          type="email"
          value={String(value || "")}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "phone":
      return (
        <Input
          {...common}
          type="tel"
          value={String(value || "")}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "date":
      return (
        <Input
          {...common}
          type="date"
          value={String(value || "")}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "datetime":
      return (
        <Input
          {...common}
          type="datetime-local"
          value={String(value || "")}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "select":
      return (
        <select
          {...common}
          aria-label={field.label}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={String(value || "")}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select an option</option>
          {(field.options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case "radio":
      return (
        <div className="flex flex-wrap gap-3">
          {(field.options || []).map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                aria-label={option.label}
                name={field.id}
                value={option.value}
                checked={value === option.value}
                disabled={disabled}
                onChange={() => onChange(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <div className="flex flex-wrap gap-3">
          {(field.options || []).map((option) => {
            const selected = Array.isArray(value) ? value : [];
            return (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label={option.label}
                  value={option.value}
                  checked={selected.includes(option.value)}
                  disabled={disabled}
                  onChange={(event) => {
                    onChange(
                      event.target.checked
                        ? [...selected, option.value]
                        : selected.filter((item) => item !== option.value)
                    );
                  }}
                />
                {option.label}
              </label>
            );
          })}
        </div>
      );
    case "switch":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            aria-label={field.label}
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
          />
          Enabled
        </label>
      );
    default:
      return (
        <Input
          {...common}
          value={String(value || "")}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}
