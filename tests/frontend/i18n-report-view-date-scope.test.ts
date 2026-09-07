import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  I18nProvider,
  type TranslationFunction,
} from "../../src/frontend/i18n/context";
import type { I18nKey } from "../../src/frontend/i18n/keys";
import type { SupportedLocale } from "../../src/frontend/i18n/locale";
import { ReportView } from "../../src/frontend/pages/report-view";
import { issue, projectConfig, release } from "../fixtures/release";
import { readinessDto } from "../fixtures/readiness-dto";

function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") {
    return { [prefix]: value };
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>(
    (result, [key, child]) => ({
      ...result,
      ...flatten(child, prefix.length > 0 ? `${prefix}.${key}` : key),
    }),
    {},
  );
}

function translator(locale: SupportedLocale): TranslationFunction {
  const messages = flatten(
    JSON.parse(
      readFileSync(resolve(process.cwd(), `locales/${locale}.json`), "utf8"),
    ) as unknown,
  );

  return (key: I18nKey, defaultValue?: string) =>
    messages[key] ?? defaultValue ?? key;
}

function renderReport(locale: SupportedLocale, generatedAt: string): string {
  const result = readinessDto(release([issue()]), projectConfig, generatedAt);

  return renderToStaticMarkup(
    createElement(I18nProvider, {
      locale,
      t: translator(locale),
      children: createElement(ReportView, {
        result,
        onBack: () => undefined,
      }),
    }),
  );
}

describe("ReportView date and release scope i18n", () => {
  it("renders date and scope in en-US", () => {
    const generatedAt = "2026-08-05T09:00:00.000Z";
    const markup = renderReport("en-US", generatedAt);

    expect(markup).toContain(new Date(generatedAt).toLocaleString("en-US"));
    expect(markup).toContain("Explicit JQL scope");

    expect(markup).not.toContain("Expliziter JQL-Umfang");
    expect(markup).not.toContain("releaseScope.mode.");
    expect(markup).not.toContain("releaseScope.explanation.");
    expect(markup).not.toContain("format.dateUnavailable");
  });

  it("preserves date and scope presentation in de-DE", () => {
    const generatedAt = "2026-08-05T09:00:00.000Z";
    const markup = renderReport("de-DE", generatedAt);

    expect(markup).toContain(new Date(generatedAt).toLocaleString("de-DE"));
    expect(markup).toContain("Expliziter JQL-Umfang");
  });
});
