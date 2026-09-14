import enUsResource from "../../../locales/en-US.json";
import type { TranslationFunction } from "./context";

const UNKNOWN_TRANSLATION_FALLBACK = "Content unavailable.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flattenTranslationResource(
  value: unknown,
  prefix: string,
  translations: Record<string, string>,
): void {
  if (typeof value === "string") {
    if (prefix.length > 0) translations[prefix] = value;
    return;
  }

  if (!isRecord(value)) return;

  for (const [key, child] of Object.entries(value)) {
    flattenTranslationResource(
      child,
      prefix.length > 0 ? `${prefix}.${key}` : key,
      translations,
    );
  }
}

function bundledEnglishTranslations(): Readonly<Record<string, string>> {
  const translations: Record<string, string> = {};
  flattenTranslationResource(enUsResource, "", translations);
  return Object.freeze(translations);
}

const EN_US_TRANSLATIONS = bundledEnglishTranslations();

export const emergencyTranslation: TranslationFunction = (
  i18nKey,
  defaultValue,
) =>
  EN_US_TRANSLATIONS[i18nKey] ?? defaultValue ?? UNKNOWN_TRANSLATION_FALLBACK;

export interface TranslationResolution {
  t: TranslationFunction;
  source: "forge" | "emergency";
}

export async function resolveTranslationFunction(
  createTranslationFunction: () => Promise<TranslationFunction>,
): Promise<TranslationResolution> {
  try {
    return {
      t: await createTranslationFunction(),
      source: "forge",
    };
  } catch {
    return {
      t: emergencyTranslation,
      source: "emergency",
    };
  }
}
