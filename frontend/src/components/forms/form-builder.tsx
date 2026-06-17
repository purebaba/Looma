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
  AlertCircle,
  Calendar,
  CheckSquare,
  ChevronDown,
  Database,
  Eye,
  ExternalLink,
  GripVertical,
  Hash,
  Inbox,
  Link2,
  Mail,
  Phone,
  Plus,
  Save,
  ToggleLeft,
  Trash2,
  Type,
} from "lucide-react";

import { FormLifecycleActions } from "@/components/forms/form-lifecycle-actions";
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
  type ConditionalLogic,
  type FieldSchema,
  type FormSchema,
  type ValidationRule,
} from "@/server/lib/forms/field-schema";
import {
  DEFAULT_FORM_SETTINGS,
  normalizeFormSettings,
  type FormSettings,
} from "@/server/lib/forms/settings";
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
  { type: "reference", label: "Reference", icon: Link2 },
];

const OPTION_FIELD_TYPES = new Set<FieldType>(["select", "radio", "checkbox"]);

type AppOption = {
  id: string;
  name: string;
};

type EntityFieldOption = {
  id: string;
  name: string;
  slug: string;
  type: string;
  required?: boolean | null;
  config?: unknown;
  order?: number | null;
};

type EntityOption = {
  id: string;
  appId: string;
  name: string;
  fields: EntityFieldOption[];
};

type PublishCheckIssue = {
  fieldId?: string;
  message: string;
};

export function FormBuilder({
  initialForm,
  apps = [],
  entities = [],
}: {
  initialForm?: {
    id: string;
    appId?: string | null;
    entityId?: string | null;
    name: string;
    description: string | null;
    schema: FormSchema;
    settings?: unknown;
    status: string | null;
    hasPublishedVersion?: boolean;
  };
  apps?: AppOption[];
  entities?: EntityOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(initialForm?.name || "Untitled form");
  const [description, setDescription] = useState(initialForm?.description || "");
  const [settings, setSettings] = useState<FormSettings>(
    initialForm?.settings
      ? normalizeFormSettings(initialForm.settings)
      : DEFAULT_FORM_SETTINGS
  );
  const [appId, setAppId] = useState(initialForm?.appId || apps[0]?.id || "");
  const [entityId, setEntityId] = useState(initialForm?.entityId || "");
  const [fields, setFields] = useState<FieldSchema[]>(
    initialForm?.schema.fields || []
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialForm?.schema.fields[0]?.id || null
  );
  const [pendingDeleteFieldId, setPendingDeleteFieldId] = useState<string | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setMode] = useState<"design" | "preview">("design");
  const hasPublishedVersion = Boolean(initialForm?.hasPublishedVersion);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedField = fields.find((field) => field.id === selectedId) || null;
  const schema = useMemo<FormSchema>(() => ({ fields }), [fields]);
  const publishIssues = useMemo(() => validatePublishSchema(fields), [fields]);
  const availableEntities = entities.filter((entity) => entity.appId === appId);
  const selectedEntity =
    availableEntities.find((entity) => entity.id === entityId) || null;
  const selectedEntityFields = selectedEntity?.fields || [];
  const importedEntityFieldIds = new Set(
    fields.map((field) => field.entityFieldId).filter(Boolean)
  );

  function entityFieldToFormField(entityField: EntityFieldOption): FieldSchema {
    const type = FIELD_PALETTE.some((item) => item.type === entityField.type)
      ? (entityField.type as FieldType)
      : "text";
    const config = (entityField.config || {}) as Record<string, unknown>;
    const reference =
      type === "reference" && config.targetEntityId
        ? { targetEntityId: String(config.targetEntityId) }
        : undefined;
    return createField(type, {
      entityFieldId: entityField.id,
      dataKey: entityField.slug,
      label: entityField.name,
      reference,
      appearance: {
        width: 12,
        order: fields.length,
      },
      validation: entityField.required
        ? [{ type: "required", message: `${entityField.name} is required` }]
        : [],
      options:
        OPTION_FIELD_TYPES.has(type) &&
        typeof config === "object" &&
        config &&
        "options" in config &&
        Array.isArray(config.options)
          ? (config as { options: { label: string; value: string }[] }).options
          : OPTION_FIELD_TYPES.has(type)
            ? [
                { label: "Option 1", value: "option_1" },
                { label: "Option 2", value: "option_2" },
              ]
            : undefined,
    });
  }

  function importEntityField(entityField: EntityFieldOption) {
    const field = entityFieldToFormField(entityField);
    setFields((current) => [
      ...current,
      {
        ...field,
        appearance: { ...field.appearance, order: current.length },
      },
    ]);
    setSelectedId(field.id);
  }

  function importAllEntityFields() {
    if (!selectedEntity) return;
    setFields((current) => {
      const existing = new Set(
        current.map((field) => field.entityFieldId).filter(Boolean)
      );
      const imported = selectedEntity.fields
        .filter((field) => !existing.has(field.id))
        .map((field, index) => {
          const next = entityFieldToFormField(field);
          return {
            ...next,
            appearance: { ...next.appearance, order: current.length + index },
          };
        });
      if (imported[0]) setSelectedId(imported[0].id);
      return [...current, ...imported];
    });
  }

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

  function requestDeleteField(fieldId: string) {
    const field = fields.find((candidate) => candidate.id === fieldId);
    if (!field) return;
    const impact = fieldImpactSummary(field, hasPublishedVersion);
    if (impact.requiresConfirmation) {
      setSelectedId(fieldId);
      setPendingDeleteFieldId(fieldId);
      return;
    }
    deleteField(fieldId);
  }

  function deleteField(fieldId: string) {
    const nextFields = fields.filter((field) => field.id !== fieldId);
    setPendingDeleteFieldId(null);
    setFields(nextFields);
    if (selectedId === fieldId) {
      setSelectedId(nextFields[0]?.id || null);
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
    if (publish && publishIssues.length > 0) {
      const firstFieldIssue = publishIssues.find((issue) => issue.fieldId);
      if (firstFieldIssue?.fieldId) setSelectedId(firstFieldIssue.fieldId);
      setMode("design");
      toast({
        title: "Fix publish checks",
        description: "Resolve the highlighted issues before publishing this form.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        appId,
        entityId: entityId || null,
        name,
        description,
        schema: { fields },
        settings,
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
      router.push(`/studio/interfaces/forms/${saved.form.id}`);
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
          <CardDescription>
            Import entity fields first, or add a new field and sync it back.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {selectedEntity ? (
            <div className="grid gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={importAllEntityFields}
              >
                Import all entity fields
              </Button>
              <div className="grid gap-2">
                {selectedEntity.fields.map((entityField) => (
                  <Button
                    key={entityField.id}
                    type="button"
                    variant="outline"
                    className="justify-start"
                    disabled={importedEntityFieldIds.has(entityField.id)}
                    onClick={() => importEntityField(entityField)}
                  >
                    <Type className="size-4" />
                    {entityField.name}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid gap-2 border-t pt-4">
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
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card id="builder">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-1 flex-col gap-3">
                {initialForm ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        initialForm.status === "published"
                          ? "default"
                          : initialForm.status === "archived"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {initialForm.status}
                    </Badge>
                    {initialForm.status === "published" ? (
                      <p className="text-xs text-muted-foreground">
                        Saving changes creates a new draft version.
                      </p>
                    ) : null}
                    {initialForm.status === "archived" ? (
                      <p className="text-xs text-muted-foreground">
                        Restore this form before publishing it again.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="form-app">App</Label>
                    <select
                      id="form-app"
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={appId}
                      onChange={(event) => {
                        setAppId(event.target.value);
                        setEntityId("");
                      }}
                    >
                      {apps.map((app) => (
                        <option key={app.id} value={app.id}>
                          {app.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="form-entity">Entity</Label>
                    <select
                      id="form-entity"
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={entityId}
                      onChange={(event) => setEntityId(event.target.value)}
                    >
                      <option value="">Create entity from this form</option>
                      {availableEntities.map((entity) => (
                        <option key={entity.id} value={entity.id}>
                          {entity.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
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
                        fields={fields}
                        entityFields={selectedEntityFields}
                        hasPublishedVersion={hasPublishedVersion}
                        pendingDelete={pendingDeleteFieldId === field.id}
                        selected={field.id === selectedId}
                        onSelect={() => setSelectedId(field.id)}
                        onRequestDelete={() => requestDeleteField(field.id)}
                        onCancelDelete={() => setPendingDeleteFieldId(null)}
                        onConfirmDelete={() => deleteField(field.id)}
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

        {publishIssues.length > 0 ? (
          <Card className="border-destructive/40" data-testid="publish-checks">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="size-4 text-destructive" />
                Publish checks
              </CardTitle>
              <CardDescription>
                Resolve these issues before the form can be published.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 text-sm">
                {publishIssues.map((issue, index) => (
                  <li
                    key={`${issue.fieldId || "form"}-${index}`}
                    className="flex items-start gap-2 text-destructive"
                  >
                    <span className="mt-1 size-1.5 rounded-full bg-destructive" />
                    {issue.fieldId ? (
                      <button
                        type="button"
                        className="text-left underline-offset-4 hover:underline"
                        onClick={() => {
                          setMode("design");
                          setSelectedId(issue.fieldId || null);
                        }}
                      >
                        {issue.message}
                      </button>
                    ) : (
                      <span>{issue.message}</span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <Card id="settings">
          <CardHeader>
            <CardTitle>Submission experience</CardTitle>
            <CardDescription>
              Control whether the public form accepts responses and what happens after submit.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.collectingEnabled}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    collectingEnabled: event.target.checked,
                  }))
                }
              />
              Accept new responses
            </label>
            <div className="grid gap-2">
              <Label htmlFor="form-closed-message">Closed message</Label>
              <Textarea
                id="form-closed-message"
                value={settings.closedMessage}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    closedMessage: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="form-success-title">Success title</Label>
                <Input
                  id="form-success-title"
                  value={settings.successTitle}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      successTitle: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="form-redirect-url">Redirect URL</Label>
                <Input
                  id="form-redirect-url"
                  value={settings.redirectUrl}
                  placeholder="/thank-you or https://example.com"
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      redirectUrl: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="form-success-message">Success message</Label>
              <Textarea
                id="form-success-message"
                value={settings.successMessage}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    successMessage: event.target.value,
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          {initialForm ? (
            <FormLifecycleActions
              formId={initialForm.id}
              status={initialForm.status}
            />
          ) : null}
          {initialForm?.hasPublishedVersion && initialForm.status !== "archived" ? (
            <>
              {initialForm.entityId ? (
                <Button asChild variant="outline">
                  <Link href={`/studio/data/entities/${initialForm.entityId}/records`}>
                    <Inbox className="size-4" />
                    View records
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link href={`/studio/interfaces/forms/${initialForm.id}/submissions`}>
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
            disabled={
              isSaving || fields.length === 0 || initialForm?.status === "archived"
            }
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
            <FieldProperties
              entityFields={selectedEntityFields}
              field={selectedField}
              fields={fields}
              hasPublishedVersion={hasPublishedVersion}
              onChange={updateField}
            />
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
  fields,
  entityFields,
  hasPublishedVersion,
  pendingDelete,
  selected,
  onSelect,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  field: FieldSchema;
  fields: FieldSchema[];
  entityFields: EntityFieldOption[];
  hasPublishedVersion: boolean;
  pendingDelete: boolean;
  selected: boolean;
  onSelect: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: field.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const boundEntityField = entityFields.find(
    (entityField) => entityField.id === field.entityFieldId
  );
  const dataKey = field.dataKey || slugifyFieldLabel(field.label || field.id);
  const conditionSummary = describeCondition(field.condition, fields);
  const impact = fieldImpactSummary(field, hasPublishedVersion, boundEntityField);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-card p-3 ${
        selected ? "border-primary ring-1 ring-primary" : ""
      }`}
      data-testid={`builder-field-${field.type}`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
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
          <div
            className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
            data-testid="field-binding-summary"
          >
            {boundEntityField ? (
              <>
                <Badge variant="outline" className="gap-1">
                  <Link2 className="size-3" />
                  Bound
                </Badge>
                <span className="truncate">
                  {boundEntityField.name} · {boundEntityField.slug}
                </span>
              </>
            ) : field.entityFieldId ? (
              <>
                <Badge variant="outline" className="gap-1">
                  <Link2 className="size-3" />
                  Missing binding
                </Badge>
                <span className="truncate">{dataKey}</span>
              </>
            ) : (
              <>
                <Badge variant="outline" className="gap-1">
                  <Database className="size-3" />
                  Creates field
                </Badge>
                <span className="truncate">{dataKey}</span>
              </>
            )}
          </div>
          {conditionSummary ? (
            <div
              className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
              data-testid="field-condition-summary"
            >
              <Badge variant="outline" className="gap-1">
                <Eye className="size-3" />
                Conditional
              </Badge>
              <span className="truncate">{conditionSummary}</span>
            </div>
          ) : null}
          {impact.level !== "none" ? (
            <div
              className="mt-2 flex flex-wrap items-center gap-2 text-xs text-amber-700"
              data-testid="field-impact-summary"
            >
              <Badge variant="outline" className="gap-1">
                <AlertCircle className="size-3" />
                Data impact
              </Badge>
              <span className="truncate">{impact.shortMessage}</span>
            </div>
          ) : null}
        </div>
        <Badge variant="outline">{field.appearance.width}/12</Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Delete ${field.label}`}
          onClick={(event) => {
            event.stopPropagation();
            onRequestDelete();
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      {pendingDelete && impact.level !== "none" ? (
        <div
          className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
          data-testid="field-delete-confirmation"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 flex-none" />
            <div className="grid gap-1">
              <p className="font-medium">Deleting this field changes collected data</p>
              <p>{impact.deleteMessage}</p>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancelDelete}
            >
              Cancel delete
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onConfirmDelete}
            >
              Confirm delete
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FieldProperties({
  field,
  fields,
  entityFields,
  hasPublishedVersion,
  onChange,
}: {
  field: FieldSchema;
  fields: FieldSchema[];
  entityFields: EntityFieldOption[];
  hasPublishedVersion: boolean;
  onChange: (fieldId: string, patch: Partial<FieldSchema>) => void;
}) {
  const required = field.validation.some((rule) => rule.type === "required");
  const min = field.validation.find((rule) => rule.type === "min")?.value || "";
  const max = field.validation.find((rule) => rule.type === "max")?.value || "";
  const pattern = field.validation.find((rule) => rule.type === "pattern")?.value || "";
  const boundEntityField = entityFields.find(
    (entityField) => entityField.id === field.entityFieldId
  );
  const compatibleEntityFields = entityFields.filter((entityField) =>
    canBindFieldToEntityField(field, entityField)
  );
  const dataKey = field.dataKey || slugifyFieldLabel(field.label || field.id);
  const conditionFields = fields.filter(
    (candidate) => candidate.id !== field.id && candidate.type !== "divider"
  );
  const conditionSource = conditionFields.find(
    (candidate) => candidate.id === field.condition?.field
  );
  const impact = fieldImpactSummary(field, hasPublishedVersion, boundEntityField);

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

  function setEntityBinding(entityFieldId: string) {
    if (!entityFieldId) {
      onChange(field.id, {
        entityFieldId: undefined,
        dataKey: slugifyFieldLabel(field.label || field.id),
      });
      return;
    }
    const entityField = entityFields.find((item) => item.id === entityFieldId);
    if (!entityField || !canBindFieldToEntityField(field, entityField)) return;
    onChange(field.id, {
      entityFieldId: entityField.id,
      dataKey: entityField.slug,
    });
  }

  function setConditionSource(sourceFieldId: string) {
    if (!sourceFieldId) {
      onChange(field.id, { condition: undefined });
      return;
    }
    const source = conditionFields.find((candidate) => candidate.id === sourceFieldId);
    if (!source) return;
    onChange(field.id, {
      condition: {
        field: source.id,
        operator: "equals",
        value: defaultConditionValue(source),
      },
    });
  }

  function updateCondition(patch: Partial<ConditionalLogic>) {
    if (!field.condition) return;
    const next = { ...field.condition, ...patch };
    const nextSource = conditionFields.find(
      (candidate) => candidate.id === next.field
    );
    if (!nextSource) {
      onChange(field.id, { condition: undefined });
      return;
    }
    if (next.operator === "not_empty") {
      onChange(field.id, {
        condition: { field: nextSource.id, operator: next.operator },
      });
      return;
    }
    onChange(field.id, {
      condition: {
        field: nextSource.id,
        operator: next.operator || "equals",
        value:
          next.value === undefined
            ? defaultConditionValue(nextSource)
            : normalizeConditionValue(nextSource, next.value),
      },
    });
  }

  function setDefaultValue(value: unknown) {
    onChange(field.id, { defaultValue: normalizeDefaultValue(field, value) });
  }

  function setOptions(options: FieldSchema["options"]) {
    const nextOptions = options || [];
    const nextValues = new Set(nextOptions.map((option) => option.value));
    let nextDefaultValue = field.defaultValue;

    if (field.type === "checkbox") {
      nextDefaultValue = Array.isArray(field.defaultValue)
        ? field.defaultValue.filter((value) => nextValues.has(String(value)))
        : [];
    } else if (
      field.defaultValue !== undefined &&
      field.defaultValue !== "" &&
      !nextValues.has(String(field.defaultValue))
    ) {
      nextDefaultValue = "";
    }

    onChange(field.id, {
      options: nextOptions,
      defaultValue: nextDefaultValue,
    });
  }

  function updateOption(index: number, patch: { label?: string; value?: string }) {
    const options = field.options || [];
    setOptions(
      options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...patch } : option
      )
    );
  }

  function addOption() {
    const options = field.options || [];
    const nextIndex = options.length + 1;
    setOptions([
      ...options,
      {
        label: `Option ${nextIndex}`,
        value: `option_${nextIndex}`,
      },
    ]);
  }

  function removeOption(index: number) {
    setOptions((field.options || []).filter((_, optionIndex) => optionIndex !== index));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border bg-muted/30 p-3">
        <div className="flex items-start gap-2">
          <Database className="mt-0.5 size-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Data binding</p>
            <p className="text-xs text-muted-foreground">
              {boundEntityField
                ? `Writes to ${boundEntityField.name} (${boundEntityField.slug}).`
                : "This field will create or sync a business data field on save."}
            </p>
          </div>
        </div>
      </div>
      {impact.level !== "none" ? (
        <div
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900"
          data-testid="field-data-impact"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4" />
            <div className="grid gap-1">
              <p className="text-sm font-medium">Data impact</p>
              <p className="text-xs">{impact.longMessage}</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="field-entity-binding">Entity field</Label>
        <select
          id="field-entity-binding"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={field.entityFieldId || ""}
          onChange={(event) => setEntityBinding(event.target.value)}
        >
          <option value="">Create/sync a new entity field</option>
          {compatibleEntityFields.map((entityField) => (
            <option key={entityField.id} value={entityField.id}>
              {entityField.name} · {entityField.slug}
            </option>
          ))}
        </select>
        {entityFields.length > 0 && !compatibleEntityFields.length ? (
          <p className="text-xs text-muted-foreground">
            No compatible {field.type} fields exist on the selected Entity.
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="field-data-key">Data key</Label>
        <Input
          id="field-data-key"
          value={dataKey}
          disabled={Boolean(boundEntityField)}
          onChange={(event) =>
            onChange(field.id, {
              dataKey: slugifyFieldLabel(event.target.value),
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          Stored on Entity Records as this JSON key.
        </p>
      </div>
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
      <DefaultValueControl field={field} onChange={setDefaultValue} />
      {OPTION_FIELD_TYPES.has(field.type) ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="field-options">Options</Label>
            <Button type="button" variant="outline" size="sm" onClick={addOption}>
              <Plus className="size-4" />
              Add option
            </Button>
          </div>
          <div className="grid gap-2" data-testid="option-editor">
            {(field.options || []).map((option, index) => (
              <div
                key={`${option.value}-${index}`}
                className="grid gap-2 rounded-md border p-2"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                  <Input
                    aria-label={`Choice ${index + 1} name`}
                    value={option.label}
                    onChange={(event) =>
                      updateOption(index, { label: event.target.value })
                    }
                  />
                  <Input
                    aria-label={`Choice ${index + 1} stored value`}
                    value={option.value}
                    onChange={(event) =>
                      updateOption(index, {
                        value: slugifyOptionValue(event.target.value),
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Textarea
            id="field-options"
            value={(field.options || [])
              .map((option) => `${option.label}:${option.value}`)
              .join("\n")}
            onChange={(event) =>
              setOptions(
                event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, index) => {
                    const [label, value] = line.split(":");
                    return {
                      label: label.trim(),
                      value: slugifyOptionValue(
                        (value || label || `option_${index + 1}`).trim()
                      ),
                    };
                  })
              )
            }
          />
          <p className="text-xs text-muted-foreground">
            Edit rows directly, or paste one option per line as Label:value.
          </p>
        </div>
      ) : null}
      <div className="rounded-md border bg-muted/30 p-3">
        <div className="flex items-start gap-2">
          <Eye className="mt-0.5 size-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Conditional visibility</p>
            <p className="text-xs text-muted-foreground">
              Show this field only when another field matches a rule.
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="field-condition-source">Show when</Label>
            <select
              id="field-condition-source"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={field.condition?.field || ""}
              onChange={(event) => setConditionSource(event.target.value)}
            >
              <option value="">Always visible</option>
              {conditionFields.map((conditionField) => (
                <option key={conditionField.id} value={conditionField.id}>
                  {conditionField.label}
                </option>
              ))}
            </select>
          </div>
          {field.condition && conditionSource ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="field-condition-operator">Operator</Label>
                <select
                  id="field-condition-operator"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={field.condition.operator}
                  onChange={(event) =>
                    updateCondition({
                      operator: event.target.value as ConditionalLogic["operator"],
                      value:
                        event.target.value === "not_empty"
                          ? undefined
                          : field.condition?.value,
                    })
                  }
                >
                  <option value="equals">Equals</option>
                  <option value="not_equals">Does not equal</option>
                  <option value="contains">Contains</option>
                  <option value="not_empty">Is not empty</option>
                </select>
              </div>
              {field.condition.operator !== "not_empty" ? (
                <ConditionValueControl
                  condition={field.condition}
                  sourceField={conditionSource}
                  onChange={(value) => updateCondition({ value })}
                />
              ) : null}
            </>
          ) : conditionFields.length ? null : (
            <p className="text-xs text-muted-foreground">
              Add another field before this one can depend on a condition.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ConditionValueControl({
  condition,
  sourceField,
  onChange,
}: {
  condition: ConditionalLogic;
  sourceField: FieldSchema;
  onChange: (value: unknown) => void;
}) {
  const value = condition.value ?? defaultConditionValue(sourceField);
  const label = "Value";

  if (sourceField.type === "switch") {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor="field-condition-value">{label}</Label>
        <select
          id="field-condition-value"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={String(Boolean(value))}
          onChange={(event) => onChange(event.target.value === "true")}
        >
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>
      </div>
    );
  }

  if (sourceField.options?.length) {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor="field-condition-value">{label}</Label>
        <select
          id="field-condition-value"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        >
          {sourceField.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="field-condition-value">{label}</Label>
      <Input
        id="field-condition-value"
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function DefaultValueControl({
  field,
  onChange,
}: {
  field: FieldSchema;
  onChange: (value: unknown) => void;
}) {
  const value = field.defaultValue;

  if (field.type === "divider") return null;

  if (field.type === "switch") {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor="field-default-value">Default value</Label>
        <select
          id="field-default-value"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={String(Boolean(value))}
          onChange={(event) => onChange(event.target.value === "true")}
        >
          <option value="false">Disabled</option>
          <option value="true">Enabled</option>
        </select>
      </div>
    );
  }

  if (field.type === "checkbox") {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      <div className="flex flex-col gap-2">
        <Label>Default value</Label>
        <div className="flex flex-wrap gap-3">
          {(field.options || []).map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label={`Default ${option.label}`}
                checked={selected.includes(option.value)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, option.value]
                      : selected.filter((item) => item !== option.value)
                  )
                }
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.options?.length) {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor="field-default-value">Default value</Label>
        <select
          id="field-default-value"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={String(value || "")}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">No default</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="field-default-value">Default value</Label>
      <Input
        id="field-default-value"
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function canBindFieldToEntityField(
  field: FieldSchema,
  entityField: EntityFieldOption
) {
  return field.type === entityField.type;
}

function validatePublishSchema(fields: FieldSchema[]): PublishCheckIssue[] {
  const issues: PublishCheckIssue[] = [];
  const usableFields = fields.filter((field) => field.type !== "divider");
  const fieldIds = new Set(fields.map((field) => field.id));
  const dataKeyToFields = new Map<string, FieldSchema[]>();

  if (usableFields.length === 0) {
    issues.push({ message: "Add at least one input field before publishing." });
  }

  for (const field of usableFields) {
    const label = field.label.trim();
    const dataKey = field.dataKey || slugifyFieldLabel(label || field.id);

    if (!label) {
      issues.push({
        fieldId: field.id,
        message: "Every field needs a visible label.",
      });
    }

    if (!dataKey) {
      issues.push({
        fieldId: field.id,
        message: `${label || "This field"} needs a data key.`,
      });
    }

    dataKeyToFields.set(dataKey, [...(dataKeyToFields.get(dataKey) || []), field]);

    if (OPTION_FIELD_TYPES.has(field.type)) {
      const options = field.options || [];
      const optionValues = new Set<string>();
      if (options.length === 0) {
        issues.push({
          fieldId: field.id,
          message: `${label || "This option field"} needs at least one option.`,
        });
      }
      for (const option of options) {
        if (!option.label.trim() || !option.value.trim()) {
          issues.push({
            fieldId: field.id,
            message: `${label || "This option field"} has an option with an empty label or value.`,
          });
          break;
        }
        if (optionValues.has(option.value)) {
          issues.push({
            fieldId: field.id,
            message: `${label || "This option field"} has duplicate option values.`,
          });
          break;
        }
        optionValues.add(option.value);
      }
    }

    if (field.condition) {
      const sourceField = fields.find((candidate) => candidate.id === field.condition?.field);
      if (!sourceField || !fieldIds.has(field.condition.field)) {
        issues.push({
          fieldId: field.id,
          message: `${label || "This field"} depends on a missing field.`,
        });
      } else if (sourceField.id === field.id) {
        issues.push({
          fieldId: field.id,
          message: `${label || "This field"} cannot depend on itself.`,
        });
      } else if (
        field.condition.operator !== "not_empty" &&
        (field.condition.value === undefined || field.condition.value === "")
      ) {
        issues.push({
          fieldId: field.id,
          message: `${label || "This field"} condition needs a comparison value.`,
        });
      } else if (
        field.condition.operator !== "not_empty" &&
        sourceField.options?.length &&
        !sourceField.options.some(
          (option) => option.value === String(field.condition?.value)
        )
      ) {
        issues.push({
          fieldId: field.id,
          message: `${label || "This field"} condition references an option that no longer exists.`,
        });
      }
    }
  }

  for (const [dataKey, duplicatedFields] of dataKeyToFields) {
    if (duplicatedFields.length > 1) {
      const labels = duplicatedFields
        .map((field) => field.label.trim() || "Untitled field")
        .join(", ");
      for (const field of duplicatedFields) {
        issues.push({
          fieldId: field.id,
          message: `Duplicate data key "${dataKey}" is used by ${labels}.`,
        });
      }
    }
  }

  return issues;
}

function defaultConditionValue(field: FieldSchema) {
  if (field.type === "switch") return true;
  if (field.options?.[0]) return field.options[0].value;
  return "";
}

function normalizeConditionValue(field: FieldSchema, value: unknown) {
  if (field.type === "switch") {
    return value === true || value === "true";
  }
  return String(value ?? "");
}

function normalizeDefaultValue(field: FieldSchema, value: unknown) {
  if (field.type === "number") {
    return value === "" ? "" : Number(value);
  }
  if (field.type === "switch") {
    return value === true || value === "true";
  }
  if (field.type === "checkbox") {
    return Array.isArray(value) ? value.map(String) : [];
  }
  return value;
}

function fieldImpactSummary(
  field: FieldSchema,
  hasPublishedVersion: boolean,
  boundEntityField?: EntityFieldOption
) {
  const dataKey = field.dataKey || slugifyFieldLabel(field.label || field.id);
  const isBound = Boolean(field.entityFieldId);

  if (!isBound && !hasPublishedVersion) {
    return {
      level: "none" as const,
      requiresConfirmation: false,
      shortMessage: "",
      longMessage: "",
      deleteMessage: "",
    };
  }

  const bindingName = boundEntityField
    ? `${boundEntityField.name} (${boundEntityField.slug})`
    : `Entity data key ${dataKey}`;
  const publishedPart = hasPublishedVersion
    ? "This form has a live published version, so changes can affect how future responses and historical snapshots are interpreted."
    : "";
  const bindingPart = isBound
    ? `This field is bound to ${bindingName}. Label or type changes update the interface, while data key changes affect where values are stored on Entity Records.`
    : `This field has already been saved with data key ${dataKey}. Changing it can split future Record data from existing values.`;

  return {
    level: isBound ? ("high" as const) : ("medium" as const),
    requiresConfirmation: isBound || hasPublishedVersion,
    shortMessage: isBound
      ? `Bound to ${bindingName}`
      : `Published data key ${dataKey}`,
    longMessage: [bindingPart, publishedPart].filter(Boolean).join(" "),
    deleteMessage: [
      isBound
        ? `This field is bound to ${bindingName}. Deleting it removes this input from the Form but does not delete existing Record values.`
        : `This field has been published with data key ${dataKey}. Deleting it removes this input from future submissions but existing submission and Record snapshots remain.`,
      "Continue only if this field should no longer be collected through this Form.",
    ].join(" "),
  };
}

function describeCondition(
  condition: ConditionalLogic | undefined,
  fields: FieldSchema[]
) {
  if (!condition) return "";
  const source = fields.find((field) => field.id === condition.field);
  if (!source) return "Depends on a missing field";
  const operatorLabels: Record<ConditionalLogic["operator"], string> = {
    equals: "equals",
    not_equals: "does not equal",
    contains: "contains",
    not_empty: "is not empty",
  };
  if (condition.operator === "not_empty") {
    return `${source.label} ${operatorLabels[condition.operator]}`;
  }
  const option = source.options?.find(
    (item) => item.value === String(condition.value)
  );
  const valueLabel =
    source.type === "switch"
      ? condition.value
        ? "Enabled"
        : "Disabled"
      : option?.label || String(condition.value ?? "");
  return `${source.label} ${operatorLabels[condition.operator]} ${valueLabel}`;
}

function slugifyFieldLabel(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "field";
}

function slugifyOptionValue(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "option";
}
