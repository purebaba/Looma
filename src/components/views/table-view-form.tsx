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
import type { TableViewConfig } from "@/lib/views/table-view";

type FieldOption = {
  id: string;
  name: string;
  slug: string;
  type: string;
};

export function TableViewForm({
  entityId,
  viewId,
  fields,
  initialName,
  initialDescription,
  initialConfig,
  initialIsDefault = false,
  mode = "update",
}: {
  entityId: string;
  viewId?: string | null;
  fields: FieldOption[];
  initialName: string;
  initialDescription?: string | null;
  initialConfig: TableViewConfig;
  initialIsDefault?: boolean;
  mode?: "create" | "update";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription || "");
  const [isDefault, setIsDefault] = useState(initialIsDefault);
  const [columns, setColumns] = useState(initialConfig.columns);
  const [searchFieldIds, setSearchFieldIds] = useState(
    initialConfig.searchFieldIds || []
  );
  const [filterFieldIds, setFilterFieldIds] = useState(
    initialConfig.filterFieldIds || []
  );
  const [sortFieldId, setSortFieldId] = useState(initialConfig.sort?.fieldId || "");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    initialConfig.sort?.direction || "asc"
  );
  const [isSaving, setIsSaving] = useState(false);

  function updateColumn(
    fieldId: string,
    patch: Partial<(typeof columns)[number]>
  ) {
    setColumns((current) =>
      current.map((column) =>
        column.fieldId === fieldId ? { ...column, ...patch } : column
      )
    );
  }

  function moveColumn(fieldId: string, direction: -1 | 1) {
    setColumns((current) => {
      const sorted = [...current].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((column) => column.fieldId === fieldId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) return current;
      const [column] = sorted.splice(index, 1);
      sorted.splice(targetIndex, 0, column);
      return sorted.map((item, order) => ({ ...item, order }));
    });
  }

  function toggleSearchField(fieldId: string, checked: boolean) {
    setSearchFieldIds((current) =>
      checked
        ? Array.from(new Set([...current, fieldId]))
        : current.filter((item) => item !== fieldId)
    );
  }

  function toggleFilterField(fieldId: string, checked: boolean) {
    setFilterFieldIds((current) =>
      checked
        ? Array.from(new Set([...current, fieldId]))
        : current.filter((item) => item !== fieldId)
    );
  }

  async function saveView() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/entities/${entityId}/views/table`, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viewId,
          name,
          description,
          isDefault,
          config: {
            columns,
            searchFieldIds,
            filterFieldIds,
            sort: sortFieldId
              ? { fieldId: sortFieldId, direction: sortDirection }
              : null,
          },
        }),
      });

      if (!response.ok) throw new Error("Save failed");
      toast({
        title: "Table view saved",
        description: "The app runtime list will use this configuration.",
      });
      router.refresh();
    } catch {
      toast({
        title: "Save failed",
        description: "Check the view configuration and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>View details</CardTitle>
          <CardDescription>
            Configure how this entity appears in the App Runtime list.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="view-name">Name</Label>
            <Input
              id="view-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="view-description">Description</Label>
            <Textarea
              id="view-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(event) => setIsDefault(event.target.checked)}
            />
            Default view
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Columns</CardTitle>
          <CardDescription>
            Choose visible fields and their order in the runtime table.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {sortedColumns.map((column, index) => {
            const field = fields.find((item) => item.id === column.fieldId);
            if (!field) return null;
            return (
              <div
                key={column.fieldId}
                className="grid gap-3 rounded-md border p-3 xl:grid-cols-[32px_120px_1fr_160px_140px_140px]"
              >
                <div className="flex items-center text-muted-foreground">
                  <GripVertical className="size-4" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={column.visible}
                    onChange={(event) =>
                      updateColumn(column.fieldId, { visible: event.target.checked })
                    }
                  />
                  Visible
                </label>
                <div className="grid gap-2">
                  <Label htmlFor={`column-label-${column.fieldId}`}>Label</Label>
                  <Input
                    id={`column-label-${column.fieldId}`}
                    value={column.label}
                    onChange={(event) =>
                      updateColumn(column.fieldId, { label: event.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {field.slug} · {field.type}
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={index === 0}
                    onClick={() => moveColumn(column.fieldId, -1)}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={index === sortedColumns.length - 1}
                    onClick={() => moveColumn(column.fieldId, 1)}
                  >
                    Down
                  </Button>
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={searchFieldIds.includes(column.fieldId)}
                    onChange={(event) =>
                      toggleSearchField(column.fieldId, event.target.checked)
                    }
                  />
                  Searchable
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filterFieldIds.includes(column.fieldId)}
                    onChange={(event) =>
                      toggleFilterField(column.fieldId, event.target.checked)
                    }
                  />
                  Filterable
                </label>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default sort</CardTitle>
          <CardDescription>
            The runtime list uses this sort until users choose another column.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="sort-field">Field</Label>
            <select
              id="sort-field"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={sortFieldId}
              onChange={(event) => setSortFieldId(event.target.value)}
            >
              <option value="">Created time</option>
              {fields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sort-direction">Direction</Label>
            <select
              id="sort-direction"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={sortDirection}
              onChange={(event) =>
                setSortDirection(event.target.value === "desc" ? "desc" : "asc")
              }
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveView} disabled={isSaving}>
          <Save className="size-4" />
          {isSaving ? "Saving..." : "Save table view"}
        </Button>
      </div>
    </div>
  );
}
