"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type EntityField = {
  id: string;
  name: string;
  slug: string;
  type: string;
  required?: boolean | null;
};

type RecordValue = {
  id?: string;
  data: Record<string, unknown>;
};

function valueToString(value: unknown) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseValue(field: EntityField, value: string) {
  if (field.type === "number") return value === "" ? "" : Number(value);
  if (field.type === "switch" || field.type === "checkbox") return value === "true";
  return value;
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
      initial[field.slug] = valueToString(initialRecord?.data?.[field.slug]);
      return initial;
    }, {})
  );
  const [isSaving, setIsSaving] = useState(false);

  function updateValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      if (!response.ok) throw new Error("Save failed");
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
    } catch {
      toast({
        title: "Save failed",
        description: "Check the record values and try again.",
        variant: "destructive",
      });
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
                  required={Boolean(field.required)}
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
              ) : (
                <Input
                  id={`record-${field.slug}`}
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  value={values[field.slug] || ""}
                  onChange={(event) => updateValue(field.slug, event.target.value)}
                  required={Boolean(field.required)}
                />
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
