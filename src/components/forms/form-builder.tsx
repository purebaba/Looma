"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  ExternalLink,
  GripVertical,
  Hash,
  Inbox,
  Mail,
  Phone,
  Plus,
  Save,
  ToggleLeft,
  Trash2,
  Type,
} from "lucide-react";

import { FormRenderer } from "@/components/forms/form-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  createField,
  type FieldSchema,
  type FormSchema,
  type ValidationRule,
} from "@/lib/forms/field-schema";
import type { FieldType } from "@/types/forms";

const FIELD_PALETTE: Array<{
  type: FieldType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { type: "text", label: "Text", icon: Type },
  { type: "textarea", label: "Textarea", icon: AlignLeft },
  { type: "number", label: "Number", icon: Hash },
  { type: "email", label: "Email", icon: Mail },
  { type: "phone", label: "Phone", icon: Phone },
  { type: "date", label: "Date", icon: Calendar },
  { type: "select", label: "Select", icon: ChevronDown },
  { type: "radio", label: "Radio", icon: CheckSquare },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "switch", label: "Switch", icon: ToggleLeft },
];

const OPTION_FIELD_TYPES = new Set<FieldType>(["select", "radio", "checkbox"]);

export function FormBuilder({
  initialForm,
}: {
  initialForm?: {
    id: string;
    name: string;
    description: string | null;
    schema: FormSchema;
    status: string | null;
  };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(initialForm?.name || "Untitled form");
  const [description, setDescription] = useState(initialForm?.description || "");
  const [fields, setFields] = useState<FieldSchema[]>(initialForm?.schema.fields || []);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialForm?.schema.fields[0]?.id || null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setMode] = useState<"design" | "preview">("design");
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedField = fields.find((field) => field.id === selectedId) || null;
  const schema = useMemo<FormSchema>(() => ({ fields }), [fields]);

  function addField(type: FieldType) {
    const field = createField(type, {
      label: FIELD_PALETTE.find((item) => item.type === type)?.label || type,
      appearance: { width: 12, order: fields.length },
      options: OPTION_FIELD_TYPES.has(type)
        ? [
            { label: "Option 1", value: "option_1" },
            { label: "Option 2", value: "option_2" },
          ]
        : undefined,
    });
    setFields((current) => [...current, field]);
    setSelectedId(field.id);
  }

  function updateField(fieldId: string, patch: Partial<FieldSchema>) {
    setFields((current) =>
      current.map((field) => (field.id === fieldId ? { ...field, ...patch } : field))
    );
  }

  function deleteField(fieldId: string) {
    setFields((current) => current.filter((field) => field.id !== fieldId));
    if (selectedId === fieldId) {
      setSelectedId(fields.find((field) => field.id !== fieldId)?.id || null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFields((current) => {
      const oldIndex = current.findIndex((field) => field.id === active.id);
      const newIndex = current.findIndex((field) => field.id === over.id);
      return arrayMove(current, oldIndex, newIndex).map((field, order) => ({
        ...field,
        appearance: { ...field.appearance, order },
      }));
    });
  }

  async function saveForm(publish = false) {
    setIsSaving(true);
    try {
      const payload = {
        name,
        description,
        schema: { fields },
      };
      const response = await fetch(
        initialForm ? `/api/forms/${initialForm.id}` : "/api/forms",
        {
          method: initialForm ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) throw new Error("Save failed");
      const saved = await response.json();

      if (publish) {
        const publishResponse = await fetch(`/api/forms/${saved.form.id}/publish`, {
          method: "POST",
        });
        if (!publishResponse.ok) throw new Error("Publish failed");
      }

      toast({
        title: publish ? "Form published" : "Draft saved",
        description: publish
          ? "The form is ready to collect submissions."
          : "Your form changes were saved.",
      });
      router.push(`/dashboard/forms/${saved.form.id}`);
      router.refresh();
    } catch {
      toast({
        title: "Save failed",
        description: "Please check the form and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-9rem)] gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Fields</CardTitle>
          <CardDescription>Add fields to your form.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {FIELD_PALETTE.map((item) => (
            <Button
              key={item.type}
              type="button"
              variant="outline"
              className="justify-start"
              data-testid={`add-field-${item.type}`}
              onClick={() => addField(item.type)}
            >
              <item.icon className="size-4" />
              {item.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-1 flex-col gap-3">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-auto border-0 px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
                />
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe what this form collects."
                  className="min-h-16"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={mode === "design" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("design")}
                >
                  Design
                </Button>
                <Button
                  type="button"
                  variant={mode === "preview" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("preview")}
                >
                  Preview
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {mode === "preview" ? (
              fields.length ? (
                <FormRenderer schema={schema} />
              ) : (
                <EmptyCanvas />
              )
            ) : fields.length ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map((field) => field.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-3">
                    {fields.map((field) => (
                      <SortableField
                        key={field.id}
                        field={field}
                        selected={field.id === selectedId}
                        onSelect={() => setSelectedId(field.id)}
                        onDelete={() => deleteField(field.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <EmptyCanvas />
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          {initialForm?.status === "published" ? (
            <>
              <Button asChild variant="outline">
                <Link href={`/dashboard/forms/${initialForm.id}/submissions`}>
                  <Inbox className="size-4" />
                  View responses
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/forms/${initialForm.id}`}>
                  <ExternalLink className="size-4" />
                  Fill live form
                </Link>
              </Button>
            </>
          ) : null}
          <Button variant="outline" disabled={isSaving} onClick={() => saveForm(false)}>
            <Save className="size-4" />
            Save draft
          </Button>
          <Button
            data-testid="publish-form"
            disabled={isSaving || fields.length === 0}
            onClick={() => saveForm(true)}
          >
            Publish
          </Button>
        </div>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Properties</CardTitle>
          <CardDescription>Configure the selected field.</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedField ? (
            <FieldProperties field={selectedField} onChange={updateField} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a field on the canvas to edit its settings.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyCanvas() {
  return (
    <div className="flex min-h-96 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <Plus className="size-10 text-muted-foreground" />
      <div>
        <h3 className="font-semibold">Start with a field</h3>
        <p className="text-sm text-muted-foreground">
          Add fields from the left panel to build your form.
        </p>
      </div>
    </div>
  );
}

function SortableField({
  field,
  selected,
  onSelect,
  onDelete,
}: {
  field: FieldSchema;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: field.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border bg-card p-3 ${
        selected ? "border-primary ring-1 ring-primary" : ""
      }`}
      data-testid={`builder-field-${field.type}`}
      onClick={onSelect}
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{field.label}</p>
          <Badge variant="secondary">{field.type}</Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {field.placeholder || field.helpText || "No helper text"}
        </p>
      </div>
      <Badge variant="outline">{field.appearance.width}/12</Badge>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function FieldProperties({
  field,
  onChange,
}: {
  field: FieldSchema;
  onChange: (fieldId: string, patch: Partial<FieldSchema>) => void;
}) {
  const required = field.validation.some((rule) => rule.type === "required");
  const min = field.validation.find((rule) => rule.type === "min")?.value || "";
  const max = field.validation.find((rule) => rule.type === "max")?.value || "";
  const pattern = field.validation.find((rule) => rule.type === "pattern")?.value || "";

  function setValidation(type: ValidationRule["type"], value: string | number | boolean) {
    let next = field.validation.filter((rule) => rule.type !== type);
    if (type === "required" && value) {
      next = [...next, { type, message: `${field.label} is required` }];
    }
    if (type !== "required" && value !== "") {
      next = [
        ...next,
        {
          type,
          value: type === "pattern" ? String(value) : Number(value),
          message: `${field.label} is invalid`,
        },
      ];
    }
    onChange(field.id, { validation: next });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="field-label">Label</Label>
        <Input
          id="field-label"
          value={field.label}
          onChange={(event) => onChange(field.id, { label: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="field-placeholder">Placeholder</Label>
        <Input
          id="field-placeholder"
          value={field.placeholder || ""}
          onChange={(event) => onChange(field.id, { placeholder: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="field-help">Help text</Label>
        <Textarea
          id="field-help"
          value={field.helpText || ""}
          onChange={(event) => onChange(field.id, { helpText: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="field-width">Width</Label>
        <select
          id="field-width"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={field.appearance.width}
          onChange={(event) =>
            onChange(field.id, {
              appearance: { ...field.appearance, width: Number(event.target.value) },
            })
          }
        >
          <option value={12}>Full width</option>
          <option value={6}>Half width</option>
          <option value={4}>One third</option>
          <option value={3}>One quarter</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={required}
          onChange={(event) => setValidation("required", event.target.checked)}
        />
        Required
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="field-min">Min</Label>
          <Input
            id="field-min"
            value={String(min)}
            onChange={(event) => setValidation("min", event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="field-max">Max</Label>
          <Input
            id="field-max"
            value={String(max)}
            onChange={(event) => setValidation("max", event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="field-pattern">Pattern</Label>
        <Input
          id="field-pattern"
          value={String(pattern)}
          placeholder="^[A-Z]+$"
          onChange={(event) => setValidation("pattern", event.target.value)}
        />
      </div>
      {OPTION_FIELD_TYPES.has(field.type) ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="field-options">Options</Label>
          <Textarea
            id="field-options"
            value={(field.options || [])
              .map((option) => `${option.label}:${option.value}`)
              .join("\n")}
            onChange={(event) =>
              onChange(field.id, {
                options: event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, index) => {
                    const [label, value] = line.split(":");
                    return {
                      label: label.trim(),
                      value: (value || label || `option_${index + 1}`).trim(),
                    };
                  }),
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            One option per line, formatted as Label:value.
          </p>
        </div>
      ) : null}
    </div>
  );
}
