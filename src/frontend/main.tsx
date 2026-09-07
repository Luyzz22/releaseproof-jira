import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { i18n, view } from "@forge/bridge";
import { App } from "./App";
import { ReleaseProofErrorBoundary } from "./components/error-boundary";
import { I18nProvider, type TranslationFunction } from "./i18n/context";
import { normalizeSupportedLocale, readContextLocale } from "./i18n/locale";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("ReleaseProof root element is missing.");

const reactRoot = createRoot(root);

void view.theme.enable().catch(() => undefined);

const fallbackTranslation: TranslationFunction = (i18nKey, defaultValue) =>
  defaultValue ?? i18nKey;

async function bootstrap(): Promise<void> {
  const [context, translate] = await Promise.all([
    view.getContext().catch(() => null),
    i18n.createTranslationFunction().catch(() => fallbackTranslation),
  ]);

  const locale = normalizeSupportedLocale(readContextLocale(context));

  document.documentElement.lang = locale;

  reactRoot.render(
    <StrictMode>
      <ReleaseProofErrorBoundary t={translate}>
        <I18nProvider locale={locale} t={translate}>
          <App />
        </I18nProvider>
      </ReleaseProofErrorBoundary>
    </StrictMode>,
  );
}

void bootstrap();
