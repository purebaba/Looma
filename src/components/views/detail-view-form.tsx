"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { DetailViewConfig } from "@/lib/views/detail-view";

type FieldOption = {
  id: string;
  name: string;
  slug: string;
  type: string;
};

export function DetailViewForm({
  entityId,
  fields,
  initialName,
  initialDescription,
  initialConfig,
}: {
  entityId: string;
  fields: FieldOption[];
  initialName: string;
  initialDescription?: string | null;
  initialConfig: DetailViewConfig;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription || "");
  const [viewFields, setViewFields] = useState(initialConfig.fields);
  const [isSaving, setIsSaving] = useState(false);

  function updateField(
    fieldId: string,
    patch: Partial<(typeof viewFields)[number]>
  ) {
    setViewFields((current) =>
      current.map((field) =>
        field.fieldId === fieldId ? { ...field, ...patch } : field
      )
    );
  }

  function moveField(fieldId: string, direction: -1 | 1) {
    setViewFields((current) => {
      const sorted = [...current].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((field) => field.fieldId === fieldId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) return current;
      const [field] = sorted.splice(index, 1);
      sorted.splice(targetIndex, 0, field);
      return sorted.map((item, order) => ({ ...item, order }));
    });
  }

  async function saveView() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/entities/${entityId}/views/detail`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          config: {
            fields: viewFields,
          },
        }),
      });

      if (!response.ok) throw new Error("Save failed");
      toast({
        title: "Detail view saved",
        description: "The app runtime record detail will use this configuration.",
      });
      router.refresh();
    } catch {
      toast({
        title: "Save failed",
        description: "Check the detail configuration and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  const sortedFields = [...viewFields].sort((a, b) => a.order - b.order);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>View details</CardTitle>
          <CardDescription>
            Configure how a single record appears in the App Runtime.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="detail-view-name">Name</Label>
            <Input
              id="detail-view-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="detail-view-description">Description</Label>
            <Textarea
              id="detail-view-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fields</CardTitle>
          <CardDescription>
            Choose visible fields, editability, labels, and sections.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {sortedFields.map((viewField, index) => {
            const field = fields.find((item) => item.id === viewField.fieldId);
            if (!field) return null;
            return (
              <div
                key={viewField.fieldId}
                className="grid gap-3 rounded-md border p-3 xl:grid-cols-[32px_120px_120px_1fr_180px_160px]"
              >
                <div className="flex items-center text-muted-foreground">
                  <GripVertical className="size-4" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={viewField.visible}
                    onChange={(event) =>
                      updateField(viewField.fieldId, { visible: event.target.checked })
                    }
                  />
                  Visible
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={viewField.editable}
                    onChange={(event) =>
                      updateField(viewField.fieldId, { editable: event.target.checked })
                    }
                  />
                  Editable
                </label>
                <div className="grid gap-2">
                  <Label htmlFor={`detail-label-${viewField.fieldId}`}>Label</Label>
                  <Input
                    id={`detail-label-${viewField.fieldId}`}
                    value={viewField.label}
                    onChange={(event) =>
                      updateField(viewField.fieldId, { label: event.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {field.slug} · {field.type}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`detail-section-${viewField.fieldId}`}>
                    Section
                  </Label>
                  <Input
                    id={`detail-section-${viewField.fieldId}`}
                    value={viewField.section || ""}
                    onChange={(event) =>
                      updateField(viewField.fieldId, {
                        section: event.target.value || "Details",
                      })
                    }
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={index === 0}
                    onClick={() => moveField(viewField.fieldId, -1)}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={index === sortedFields.length - 1}
                    onClick={() => moveField(viewField.fieldId, 1)}
                  >
                    Down
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveView} disabled={isSaving}>
          <Save className="size-4" />
          {isSaving ? "Saving..." : "Save detail view"}
        </Button>
      </div>
    </div>
  );
}
