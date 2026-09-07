import type { TranslationFunction } from "../i18n/context";
import { I18N_KEYS } from "../i18n/keys";
import type { SupportedLocale } from "../i18n/locale";

export function formatDateTimeForLocale(
  value: string,
  locale: SupportedLocale,
  t: TranslationFunction,
): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? t(I18N_KEYS.formatDateUnavailable)
    : date.toLocaleString(locale);
}
