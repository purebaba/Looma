export type FormSettings = {
  collectingEnabled: boolean;
  closedMessage: string;
  successTitle: string;
  successMessage: string;
  redirectUrl: string;
};

export const DEFAULT_FORM_SETTINGS: FormSettings = {
  collectingEnabled: true,
  closedMessage: "This form is not accepting responses right now.",
  successTitle: "Submission received",
  successMessage: "Your response has been saved.",
  redirectUrl: "",
};

function readString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

export function normalizeFormSettings(value: unknown): FormSettings {
  const settings =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};

  return {
    collectingEnabled:
      typeof settings.collectingEnabled === "boolean"
        ? settings.collectingEnabled
        : DEFAULT_FORM_SETTINGS.collectingEnabled,
    closedMessage: readString(
      settings.closedMessage,
      DEFAULT_FORM_SETTINGS.closedMessage
    ),
    successTitle: readString(
      settings.successTitle,
      DEFAULT_FORM_SETTINGS.successTitle
    ),
    successMessage: readString(
      settings.successMessage,
      DEFAULT_FORM_SETTINGS.successMessage
    ),
    redirectUrl: readString(settings.redirectUrl, DEFAULT_FORM_SETTINGS.redirectUrl),
  };
}

export function sanitizeRedirectUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const url = new URL(trimmed);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

export function sanitizeFormSettings(value: unknown): FormSettings {
  const settings = normalizeFormSettings(value);
  return {
    ...settings,
    closedMessage:
      settings.closedMessage.trim() || DEFAULT_FORM_SETTINGS.closedMessage,
    successTitle: settings.successTitle.trim() || DEFAULT_FORM_SETTINGS.successTitle,
    successMessage:
      settings.successMessage.trim() || DEFAULT_FORM_SETTINGS.successMessage,
    redirectUrl: sanitizeRedirectUrl(settings.redirectUrl),
  };
}
