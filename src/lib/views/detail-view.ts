import type { detailViews, entityFields } from "@/lib/db/schema";

export type DetailViewField = {
  fieldId: string;
  label: string;
  visible: boolean;
  editable: boolean;
  order: number;
  section?: string;
};

export type DetailViewConfig = {
  fields: DetailViewField[];
};

type EntityField = typeof entityFields.$inferSelect;
type DetailView = typeof detailViews.$inferSelect;

export function defaultDetailViewConfig(fields: EntityField[]): DetailViewConfig {
  return {
    fields: fields.map((field, index) => ({
      fieldId: field.id,
      label: field.name,
      visible: true,
      editable: true,
      order: index,
      section: "Details",
    })),
  };
}

export function normalizeDetailViewConfig(
  config: unknown,
  fields: EntityField[]
): DetailViewConfig {
  const fallback = defaultDetailViewConfig(fields);
  if (!config || typeof config !== "object") return fallback;
  const raw = config as Partial<DetailViewConfig>;
  const knownFieldIds = new Set(fields.map((field) => field.id));
  const configuredFields = Array.isArray(raw.fields)
    ? raw.fields
        .filter((field) => knownFieldIds.has(String(field.fieldId)))
        .map((item, index) => {
          const field = fields.find((candidate) => candidate.id === item.fieldId);
          return {
            fieldId: String(item.fieldId),
            label: String(item.label || field?.name || "Field"),
            visible: Boolean(item.visible),
            editable: Boolean(item.editable),
            order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
            section: item.section ? String(item.section) : "Details",
          };
        })
    : [];
  const configuredFieldIds = new Set(
    configuredFields.map((field) => field.fieldId)
  );
  const missingFields = fields
    .filter((field) => !configuredFieldIds.has(field.id))
    .map((field, index) => ({
      fieldId: field.id,
      label: field.name,
      visible: true,
      editable: true,
      order: configuredFields.length + index,
      section: "Details",
    }));

  return {
    fields: [...configuredFields, ...missingFields].sort(
      (a, b) => a.order - b.order
    ),
  };
}

export function resolveDetailView(
  view: DetailView | null | undefined,
  fields: EntityField[]
) {
  return {
    id: view?.id ?? null,
    name: view?.name || "Default detail",
    description: view?.description || null,
    config: normalizeDetailViewConfig(view?.config, fields),
  };
}
