import { createContext, useContext, type ReactNode } from "react";
import type { I18nKey } from "./keys";
import type { SupportedLocale } from "./locale";

export type TranslationFunction = (
  i18nKey: I18nKey,
  defaultValue?: string,
) => string;

interface I18nContextValue {
  locale: SupportedLocale;
  t: TranslationFunction;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  t,
  children,
}: I18nContextValue & { children: ReactNode }) {
  return (
    <I18nContext.Provider value={{ locale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);

  if (!value) {
    throw new Error("ReleaseProof i18n context is unavailable.");
  }

  return value;
}
