import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { i18n, view } from "@forge/bridge";
import { App } from "./App";
import { ReleaseProofErrorBoundary } from "./components/error-boundary";
import { I18nProvider } from "./i18n/context";
import { resolveTranslationFunction } from "./i18n/emergency-translation";
import {
  DEFAULT_LOCALE,
  normalizeSupportedLocale,
  readContextLocale,
} from "./i18n/locale";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("ReleaseProof root element is missing.");

const reactRoot = createRoot(root);

void view.theme.enable().catch(() => undefined);

async function bootstrap(): Promise<void> {
  const [context, translationResolution] = await Promise.all([
    view.getContext().catch(() => null),
    resolveTranslationFunction(() => i18n.createTranslationFunction()),
  ]);

  const contextLocale = normalizeSupportedLocale(readContextLocale(context));
  const locale =
    translationResolution.source === "emergency"
      ? DEFAULT_LOCALE
      : contextLocale;
  const translate = translationResolution.t;

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
