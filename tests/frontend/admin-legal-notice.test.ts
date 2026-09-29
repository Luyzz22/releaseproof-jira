import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminLegalNotice } from "../../src/frontend/components/admin-legal-notice";
import {
  I18nProvider,
  type TranslationFunction,
} from "../../src/frontend/i18n/context";
import type { SupportedLocale } from "../../src/frontend/i18n/locale";

function flattenTranslations(
  value: unknown,
  prefix = "",
): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
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

function render(locale: SupportedLocale, visible: boolean): string {
  return renderToStaticMarkup(
    createElement(I18nProvider, {
      locale,
      t: translator(locale),
      children: createElement(AdminLegalNotice, { visible }),
    }),
  );
}

describe("project-admin legal and security notice channel", () => {
  it("renders the active privacy notice in English for project admins", () => {
    const markup = render("en-US", true);

    expect(markup).toContain("Legal &amp; security notice");
    expect(markup).toContain("Privacy information updated");
    expect(markup).toContain("29 September 2026");
    expect(markup).toContain(
      "free-text ReleaseProof configuration is intended only for non-personal values",
    );
    expect(markup).toContain('href="https://releaseproof.de/legal/privacy"');
    expect(markup).toContain("Open privacy notice");
    expect(markup).not.toContain("adminNotice.");
  });

  it("renders the equivalent German notice", () => {
    const markup = render("de-DE", true);

    expect(markup).toContain("Rechtlicher und sicherheitsbezogener Hinweis");
    expect(markup).toContain("Datenschutzhinweis aktualisiert");
    expect(markup).toContain("29. September 2026");
    expect(markup).toContain(
      "ausschließlich für nicht personenbezogene Werte vorgesehen",
    );
    expect(markup).toContain("Datenschutzhinweise öffnen");
    expect(markup).not.toContain("adminNotice.");
  });

  it("does not expose the admin notice to non-admin users", () => {
    expect(render("en-US", false)).toBe("");
    expect(render("de-DE", false)).toBe("");
  });
});
