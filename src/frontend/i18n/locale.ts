export const SUPPORTED_LOCALES = ["en-US", "de-DE"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en-US";

export function normalizeSupportedLocale(locale: unknown): SupportedLocale {
  return locale === "de-DE" ? "de-DE" : DEFAULT_LOCALE;
}

export function readContextLocale(context: unknown): string | null {
  if (
    typeof context !== "object" ||
    context === null ||
    !("locale" in context)
  ) {
    return null;
  }

  const locale = context.locale;
  return typeof locale === "string" ? locale : null;
}
