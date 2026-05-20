import type { entityFields, tableViews } from "@/lib/db/schema";

export type TableViewColumn = {
  fieldId: string;
  label: string;
  visible: boolean;
  order: number;
  width?: number;
};

export type TableViewSort = {
  fieldId: string;
  direction: "asc" | "desc";
};

export type TableViewConfig = {
  columns: TableViewColumn[];
  searchFieldIds?: string[];
  sort?: TableViewSort | null;
};

type EntityField = typeof entityFields.$inferSelect;
type TableView = typeof tableViews.$inferSelect;

export function defaultTableViewConfig(fields: EntityField[]): TableViewConfig {
  return {
    columns: fields.map((field, index) => ({
      fieldId: field.id,
      label: field.name,
      visible: index < 6,
      order: index,
    })),
    searchFieldIds: fields
      .filter((field) => ["text", "textarea", "email", "phone", "select"].includes(field.type))
      .slice(0, 4)
      .map((field) => field.id),
    sort: fields[0] ? { fieldId: fields[0].id, direction: "asc" } : null,
  };
}

export function normalizeTableViewConfig(
  config: unknown,
  fields: EntityField[]
): TableViewConfig {
  const fallback = defaultTableViewConfig(fields);
  if (!config || typeof config !== "object") return fallback;
  const raw = config as Partial<TableViewConfig>;
  const knownFieldIds = new Set(fields.map((field) => field.id));
  const columns = Array.isArray(raw.columns)
    ? raw.columns
        .filter((column) => knownFieldIds.has(String(column.fieldId)))
        .map((column, index) => {
          const field = fields.find((item) => item.id === column.fieldId);
          return {
            fieldId: String(column.fieldId),
            label: String(column.label || field?.name || "Field"),
            visible: Boolean(column.visible),
            order: Number.isFinite(Number(column.order)) ? Number(column.order) : index,
            width: column.width ? Number(column.width) : undefined,
          };
        })
    : [];
  const configuredFieldIds = new Set(columns.map((column) => column.fieldId));
  const missingColumns = fields
    .filter((field) => !configuredFieldIds.has(field.id))
    .map((field, index) => ({
      fieldId: field.id,
      label: field.name,
      visible: false,
      order: columns.length + index,
    }));
  const searchFieldIds = Array.isArray(raw.searchFieldIds)
    ? raw.searchFieldIds.filter((fieldId) => knownFieldIds.has(String(fieldId))).map(String)
    : fallback.searchFieldIds;
  const sort: TableViewSort | null | undefined =
    raw.sort && knownFieldIds.has(String(raw.sort.fieldId))
      ? {
          fieldId: String(raw.sort.fieldId),
          direction: raw.sort.direction === "desc" ? "desc" : "asc",
        }
      : fallback.sort;

  return {
    columns: [...columns, ...missingColumns].sort((a, b) => a.order - b.order),
    searchFieldIds,
    sort,
  };
}

export function resolveTableView(
  view: TableView | null | undefined,
  fields: EntityField[]
) {
  return {
    id: view?.id ?? null,
    name: view?.name || "Default table",
    description: view?.description || null,
    config: normalizeTableViewConfig(view?.config, fields),
  };
}
