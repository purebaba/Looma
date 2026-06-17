"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { RecordPicker } from "@/components/data/record-picker";

type EntityField = {
  id: string;
  name: string;
  slug: string;
  type: string;
  required?: boolean | null;
  unique?: boolean | null;
  defaultValue?: unknown | null;
  config?: unknown;
};

type RecordValue = {
  id?: string;
  data: Record<string, unknown>;
};

function valueToString(value: unknown) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseValue(field: EntityField, value: string) {
  if (field.type === "number") return value === "" ? "" : Number(value);
  if (field.type === "switch" || field.type === "checkbox") return value === "true";
  return value;
}

function isEmpty(value: unknown) {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function validateClient(fields: EntityField[], values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const rawValue = values[field.slug] || "";
    const parsedValue = parseValue(field, rawValue);

    if (field.required && isEmpty(parsedValue)) {
      errors[field.slug] = `${field.name} is required`;
      continue;
    }

    if (isEmpty(parsedValue)) continue;

    if (field.type === "email" && typeof parsedValue === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsedValue)) {
      errors[field.slug] = `${field.name} must be a valid email`;
    }
    if (field.type === "number" && (typeof parsedValue !== "number" || !Number.isFinite(parsedValue))) {
      errors[field.slug] = `${field.name} must be a valid number`;
    }
    if (field.type === "phone" && typeof parsedValue === "string" && !/^[+()\-\s\d]{6,}$/.test(parsedValue)) {
      errors[field.slug] = `${field.name} must be a valid phone number`;
    }
  }

  return errors;
}

export function RecordForm({
  entityId,
  fields,
  initialRecord,
  returnPathPrefix,
}: {
  entityId: string;
  fields: EntityField[];
  initialRecord?: RecordValue;
  returnPathPrefix?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>(() =>
    fields.reduce<Record<string, string>>((initial, field) => {
      initial[field.slug] = valueToString(
        initialRecord?.data?.[field.slug] ?? field.defaultValue
      );
      return initial;
    }, {})
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  function updateValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const clientErrors = validateClient(fields, values);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setIsSaving(true);
    try {
      const data = fields.reduce<Record<string, unknown>>((recordData, field) => {
        recordData[field.slug] = parseValue(field, values[field.slug] || "");
        return recordData;
      }, {});
      const response = await fetch(
        initialRecord?.id
          ? `/api/entities/${entityId}/records/${initialRecord.id}`
          : `/api/entities/${entityId}/records`,
        {
          method: initialRecord?.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (body?.errors && Array.isArray(body.errors)) {
          const apiErrors: Record<string, string> = {};
          for (const err of body.errors as Array<{ field: string; message: string }>) {
            apiErrors[err.field] = err.message;
          }
          setErrors(apiErrors);
          throw new Error("Validation failed");
        }
        throw new Error(body?.error || "Save failed");
      }
      const { record } = await response.json();
      toast({
        title: initialRecord?.id ? "Record updated" : "Record created",
        description: "The business record was saved.",
      });
      router.push(
        returnPathPrefix
          ? `${returnPathPrefix}/${record.id}`
          : `/studio/data/entities/${entityId}/records/${record.id}`
      );
      router.refresh();
    } catch (err) {
      if (!Object.keys(errors).length) {
        toast({
          title: "Save failed",
          description: err instanceof Error ? err.message : "Check the record values and try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record data</CardTitle>
        <CardDescription>
          Create or edit a business record using the entity fields.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          {fields.map((field) => (
            <div key={field.id} className="grid gap-2">
              <Label htmlFor={`record-${field.slug}`}>
                {field.name}
                {field.required ? <span className="text-destructive"> *</span> : null}
              </Label>
              {field.type === "textarea" ? (
                <Textarea
                  id={`record-${field.slug}`}
                  value={values[field.slug] || ""}
                  onChange={(event) => updateValue(field.slug, event.target.value)}
                />
              ) : field.type === "switch" || field.type === "checkbox" ? (
                <select
                  id={`record-${field.slug}`}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={values[field.slug] || "false"}
                  onChange={(event) => updateValue(field.slug, event.target.value)}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              ) : field.type === "reference" ? (
                <RecordPicker
                  targetEntityId={
                    (field.config as Record<string, unknown>)?.targetEntityId as string || ""
                  }
                  value={values[field.slug] || ""}
                  onChange={(newValue) => updateValue(field.slug, newValue)}
                />
              ) : (
                <Input
                  id={`record-${field.slug}`}
                  type={field.type === "number" ? "number" : field.type === "date" || field.type === "datetime" ? "date" : "text"}
                  value={values[field.slug] || ""}
                  onChange={(event) => updateValue(field.slug, event.target.value)}
                />
              )}
              {errors[field.slug] && (
                <p className="text-sm text-destructive">{errors[field.slug]}</p>
              )}
            </div>
          ))}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving || fields.length === 0}>
              {isSaving ? "Saving..." : "Save record"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
