"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "email",
  "phone",
  "date",
  "select",
  "checkbox",
  "switch",
];

type AppOption = {
  id: string;
  name: string;
};

type EntityFieldValue = {
  id?: string;
  name: string;
  slug: string;
  type: string;
  required: boolean;
  unique?: boolean;
};

type EntityValue = {
  id?: string;
  appId?: string;
  name: string;
  description?: string | null;
  fields?: EntityFieldValue[];
};

function emptyField(): EntityFieldValue {
  return {
    name: "",
    slug: "",
    type: "text",
    required: false,
    unique: false,
  };
}

export function EntityForm({
  apps,
  initialEntity,
}: {
  apps: AppOption[];
  initialEntity?: EntityValue;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [appId, setAppId] = useState(initialEntity?.appId || apps[0]?.id || "");
  const [name, setName] = useState(initialEntity?.name || "");
  const [description, setDescription] = useState(initialEntity?.description || "");
  const [fields, setFields] = useState<EntityFieldValue[]>(
    initialEntity?.fields?.length ? initialEntity.fields : [emptyField()]
  );
  const [isSaving, setIsSaving] = useState(false);

  function updateField(index: number, patch: Partial<EntityFieldValue>) {
    setFields((current) =>
      current.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...patch } : field
      )
    );
  }

  function removeField(index: number) {
    setFields((current) => current.filter((_, fieldIndex) => fieldIndex !== index));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        appId,
        name,
        description,
        fields: fields.filter((field) => field.name.trim()),
      };
      const response = await fetch(
        initialEntity?.id ? `/api/entities/${initialEntity.id}` : "/api/entities",
        {
          method: initialEntity?.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) throw new Error("Save failed");
      const { entity } = await response.json();
      toast({
        title: initialEntity?.id ? "Entity updated" : "Entity created",
        description: "The business data model was saved.",
      });
      router.push(`/studio/data/entities/${entity.id}`);
      router.refresh();
    } catch {
      toast({
        title: "Save failed",
        description: "Check the entity fields and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Entity details</CardTitle>
          <CardDescription>
            Define the business object. Records will use these fields as their data shape.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="entity-app">App</Label>
            <select
              id="entity-app"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={appId}
              onChange={(event) => setAppId(event.target.value)}
              required
            >
              {apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="entity-name">Name</Label>
            <Input
              id="entity-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Customer"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="entity-description">Description</Label>
            <Textarea
              id="entity-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What does this entity represent?"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Fields</CardTitle>
            <CardDescription>
              Fields become the keys available to forms, records, workflows, and agents.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setFields((current) => [...current, emptyField()])}
          >
            <Plus className="size-4" />
            Add field
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {fields.map((field, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-md border p-3 lg:grid-cols-[1fr_1fr_150px_110px_44px]"
            >
              <div className="grid gap-2">
                <Label htmlFor={`field-name-${index}`}>Name</Label>
                <Input
                  id={`field-name-${index}`}
                  value={field.name}
                  onChange={(event) =>
                    updateField(index, { name: event.target.value })
                  }
                  placeholder="Full name"
                  required={index === 0}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`field-slug-${index}`}>Data key</Label>
                <Input
                  id={`field-slug-${index}`}
                  value={field.slug}
                  onChange={(event) =>
                    updateField(index, { slug: event.target.value })
                  }
                  placeholder="full-name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`field-type-${index}`}>Type</Label>
                <select
                  id={`field-type-${index}`}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={field.type}
                  onChange={(event) =>
                    updateField(index, { type: event.target.value })
                  }
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(event) =>
                    updateField(index, { required: event.target.checked })
                  }
                />
                Required
              </label>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeField(index)}
                  disabled={fields.length === 1}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving || !appId}>
          {isSaving ? "Saving..." : "Save entity"}
        </Button>
      </div>
    </form>
  );
}
