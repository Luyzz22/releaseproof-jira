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
import { IssueEvidenceDetail } from "../../src/frontend/pages/issue-evidence-detail";
import { issue, release } from "../fixtures/release";
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

function translator(locale: "en-US" | "de-DE"): TranslationFunction {
  const messages = flatten(
    JSON.parse(
      readFileSync(resolve(process.cwd(), `locales/${locale}.json`), "utf8"),
    ) as unknown,
  );

  return (key: I18nKey, defaultValue?: string) =>
    messages[key] ?? defaultValue ?? key;
}

function renderDetail(locale: "en-US" | "de-DE"): string {
  const result = readinessDto(
    release([
      issue({
        summary: "PUBLIC_SUMMARY_SENTINEL",
      }),
    ]),
  );

  return renderToStaticMarkup(
    createElement(I18nProvider, {
      locale,
      t: translator(locale),
      children: createElement(IssueEvidenceDetail, {
        result,
        issueKey: "DEMO-42",
        siteUrl: "https://demo.atlassian.net",
        onBack: () => undefined,
      }),
    }),
  );
}

describe("IssueEvidenceDetail evidence localization", () => {
  it("renders semantic evidence content in en-US", () => {
    const markup = renderDetail("en-US");

    expect(markup).toContain("Acceptance criteria present");
    expect(markup).toContain(
      "The configured field contains acceptance criteria.",
    );
    expect(markup).toContain("Completion status reached");
    expect(markup).toContain("The status “Fertig” is configured as completed.");
    expect(markup).toContain("Correct release version");
    expect(markup).toContain(
      "The issue is assigned to version “Kundenrelease 2.4”.",
    );
    expect(markup).toContain("No action required.");
    expect(markup).toContain("Explicit JQL scope");
    expect(markup).toContain(
      new Date("2026-07-10T07:45:00.000Z").toLocaleString("en-US"),
    );

    expect(markup).not.toContain("Expliziter JQL-Umfang");
    expect(markup).not.toContain("Akzeptanzkriterien vorhanden");
    expect(markup).not.toContain(
      "Das konfigurierte Feld enthält Akzeptanzkriterien.",
    );
    expect(markup).not.toContain("Keine Maßnahme erforderlich.");
  });

  it("preserves the current evidence wording in de-DE", () => {
    const markup = renderDetail("de-DE");

    expect(markup).toContain("Akzeptanzkriterien vorhanden");
    expect(markup).toContain(
      "Das konfigurierte Feld enthält Akzeptanzkriterien.",
    );
    expect(markup).toContain("Abschlussstatus erreicht");
    expect(markup).toContain(
      "Der Status „Fertig“ ist als abgeschlossen konfiguriert.",
    );
    expect(markup).toContain("Korrekte Release-Version");
    expect(markup).toContain(
      "Der Vorgang ist der Version „Kundenrelease 2.4“ zugeordnet.",
    );
    expect(markup).toContain("Keine Maßnahme erforderlich.");
    expect(markup).toContain("Expliziter JQL-Umfang");
    expect(markup).toContain(
      new Date("2026-07-10T07:45:00.000Z").toLocaleString("de-DE"),
    );
  });

  it("does not render evidence translation keys", () => {
    const englishMarkup = renderDetail("en-US");
    const germanMarkup = renderDetail("de-DE");

    expect(englishMarkup).not.toContain("evidence.title.");
    expect(englishMarkup).not.toContain("evidence.explanation.");
    expect(englishMarkup).not.toContain("evidence.remediation.");

    expect(germanMarkup).not.toContain("evidence.title.");
    expect(germanMarkup).not.toContain("evidence.explanation.");
    expect(germanMarkup).not.toContain("evidence.remediation.");
  });
});
