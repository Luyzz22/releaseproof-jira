import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReleaseProofErrorBoundary } from "../../src/frontend/components/error-boundary";
import type { TranslationFunction } from "../../src/frontend/i18n/context";
import type { SupportedLocale } from "../../src/frontend/i18n/locale";

function flattenTranslations(
  value: unknown,
  prefix = "",
): Record<string, string> {
  if (typeof value === "string") {
    return { [prefix]: value };
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>(
    (result, [key, child]) => ({
      ...result,
      ...flattenTranslations(
        child,
        prefix.length > 0 ? `${prefix}.${key}` : key,
      ),
    }),
    {},
  );
}

function translator(locale: SupportedLocale): TranslationFunction {
  const messages = flattenTranslations(
    JSON.parse(
      readFileSync(resolve(process.cwd(), "locales", `${locale}.json`), "utf8"),
    ) as unknown,
  );

  return (key, defaultValue) => messages[key] ?? defaultValue ?? key;
}

function renderBoundary(t: TranslationFunction, failed: boolean): string {
  const boundary = new ReleaseProofErrorBoundary({
    children: createElement("span", null, "BOUNDARY_CHILD_SENTINEL"),
    t,
  });

  boundary.state = { failed };
  return renderToStaticMarkup(boundary.render());
}

describe("ReleaseProofErrorBoundary i18n and failure containment", () => {
  it("renders safe fallback UI in en-US without a provider", () => {
    const markup = renderBoundary(translator("en-US"), true);

    for (const text of [
      "Safe recovery mode",
      "This view could not be displayed.",
      "No Jira content was logged. Reload the app to continue.",
      "Reload ReleaseProof",
    ]) {
      expect(markup).toContain(text);
    }

    expect(markup).not.toContain("Sicherer Wiederherstellungsmodus");
    expect(markup).not.toContain(
      "Diese Ansicht konnte nicht dargestellt werden.",
    );
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('class="state-icon" aria-hidden="true"');
  });

  it("preserves safe fallback UI in de-DE without a provider", () => {
    const markup = renderBoundary(translator("de-DE"), true);

    for (const text of [
      "Sicherer Wiederherstellungsmodus",
      "Diese Ansicht konnte nicht dargestellt werden.",
      "Es wurden keine Jira-Inhalte protokolliert. Laden Sie die App neu, um fortzufahren.",
      "ReleaseProof neu laden",
    ]) {
      expect(markup).toContain(text);
    }
  });

  it("uses safe English defaults when translation creation failed", () => {
    const fallbackTranslation: TranslationFunction = (key, defaultValue) =>
      defaultValue ?? key;
    const markup = renderBoundary(fallbackTranslation, true);

    for (const text of [
      "Safe recovery mode",
      "This view could not be displayed.",
      "No Jira content was logged. Reload the app to continue.",
      "Reload ReleaseProof",
    ]) {
      expect(markup).toContain(text);
    }

    for (const key of [
      "errorBoundary.eyebrow",
      "errorBoundary.title",
      "errorBoundary.description",
      "errorBoundary.reload",
    ]) {
      expect(markup).not.toContain(key);
    }
  });

  it("returns child content unchanged in the normal state", () => {
    const markup = renderBoundary(translator("en-US"), false);

    expect(markup).toBe("<span>BOUNDARY_CHILD_SENTINEL</span>");
    expect(ReleaseProofErrorBoundary.getDerivedStateFromError()).toEqual({
      failed: true,
    });
  });

  it("keeps the boundary outside the provider while wiring translate to both", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/frontend/main.tsx"),
      "utf8",
    );
    const boundaryOpen = source.indexOf("<ReleaseProofErrorBoundary");
    const providerOpen = source.indexOf("<I18nProvider", boundaryOpen);
    const app = source.indexOf("<App", providerOpen);
    const providerClose = source.indexOf("</I18nProvider>", app);
    const boundaryClose = source.indexOf(
      "</ReleaseProofErrorBoundary>",
      providerClose,
    );

    expect(source).toMatch(/<ReleaseProofErrorBoundary\s+t=\{translate\}>/);
    expect(source).toMatch(
      /<I18nProvider\s+locale=\{locale\}\s+t=\{translate\}>/,
    );
    expect(boundaryOpen).toBeGreaterThan(-1);
    expect(providerOpen).toBeGreaterThan(boundaryOpen);
    expect(app).toBeGreaterThan(providerOpen);
    expect(providerClose).toBeGreaterThan(app);
    expect(boundaryClose).toBeGreaterThan(providerClose);

    expect(source).toContain("view.getContext().catch(() => null)");
    expect(source).toContain(
      "resolveTranslationFunction(() => i18n.createTranslationFunction())",
    );
    expect(source).not.toContain("defaultValue ?? i18nKey");
    expect(source).toContain("document.documentElement.lang = locale");
  });

  it("preserves no-logging, reload, and provider-independence contracts", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/frontend/components/error-boundary.tsx"),
      "utf8",
    );

    expect(source).toContain("override componentDidCatch(): void");
    expect(source).toContain("Intentionally no logging");
    expect(source).not.toMatch(/console\.(?:log|error|warn)/);
    expect(source).not.toContain("JSON.stringify(error)");
    expect(source).not.toContain("error.stack");
    expect(source).toContain("onClick={() => window.location.reload()}");
    expect(source).toContain('role="alert"');
    expect(source).toContain('aria-hidden="true"');

    for (const forbidden of [
      "useI18n",
      "I18nProvider",
      "useContext",
      "contextType",
      "SupportedLocale",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
