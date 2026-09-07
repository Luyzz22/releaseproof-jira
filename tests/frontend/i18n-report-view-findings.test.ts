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

function translator(locale: "en-US" | "de-DE"): TranslationFunction {
  const messages = flatten(
    JSON.parse(
      readFileSync(resolve(process.cwd(), `locales/${locale}.json`), "utf8"),
    ) as unknown,
  );

  return (key: I18nKey, defaultValue?: string) =>
    messages[key] ?? defaultValue ?? key;
}

function renderReport(locale: "en-US" | "de-DE"): string {
  const result = readinessDto(
    release([
      issue(),
      issue({
        key: "DEMO-43",
        hasAcceptanceCriteria: false,
      }),
      issue({
        key: "DEMO-44",
        labels: ["release-blocker"],
      }),
    ]),
    projectConfig,
    "2026-08-05T09:00:00.000Z",
  );

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

function beforeMarkdownPreview(markup: string): string {
  const marker = '<section class="panel markdown-panel no-print">';

  const index = markup.indexOf(marker);

  if (index < 0) {
    throw new Error(
      "Markdown preview boundary is missing from ReportView markup.",
    );
  }

  return markup.slice(0, index);
}

describe("ReportView findings i18n boundary", () => {
  it("renders visible findings in en-US", () => {
    const markup = renderReport("en-US");
    const visibleReport = beforeMarkdownPreview(markup);

    expect(visibleReport).toContain("Blockers and missing evidence");
    expect(visibleReport).toContain("Acceptance criteria present");
    expect(visibleReport).toContain(
      "No usable acceptance criteria were found in the configured field.",
    );
    expect(visibleReport).toContain("No blocker label");
    expect(visibleReport).toContain("Blocking label present: release-blocker.");
    expect(visibleReport).toContain("Remediation:");

    expect(visibleReport).not.toContain("Blockierungen und fehlende Nachweise");
    expect(visibleReport).not.toContain("Akzeptanzkriterien vorhanden");
    expect(visibleReport).not.toContain("Blockierendes Label vorhanden:");
    expect(visibleReport).not.toContain("Behebung:");

    expect(visibleReport).not.toContain("evidence.title.");
    expect(visibleReport).not.toContain("evidence.explanation.");
    expect(visibleReport).not.toContain("evidence.remediation.");
    expect(visibleReport).not.toContain("report.findings.");
  });

  it("preserves current visible findings wording in de-DE", () => {
    const visibleReport = beforeMarkdownPreview(renderReport("de-DE"));

    expect(visibleReport).toContain("Blockierungen und fehlende Nachweise");
    expect(visibleReport).toContain("Akzeptanzkriterien vorhanden");
    expect(visibleReport).toContain(
      "Im konfigurierten Feld wurden keine verwertbaren Akzeptanzkriterien gefunden.",
    );
    expect(visibleReport).toContain("Kein Blocker-Label");
    expect(visibleReport).toContain(
      "Blockierendes Label vorhanden: release-blocker.",
    );
    expect(visibleReport).toContain("Behebung:");
  });

  it("renders the Markdown preview in the active en-US locale", () => {
    const markup = renderReport("en-US");
    const visibleReport = beforeMarkdownPreview(markup);
    const markdownPreview = markup.slice(visibleReport.length);

    expect(visibleReport).not.toContain("Akzeptanzkriterien vorhanden");

    expect(markdownPreview).toContain("## Open findings");
    expect(markdownPreview).toContain("Acceptance criteria present");
    expect(markdownPreview).toContain("Remediation:");
    expect(markdownPreview).toContain("Readiness score");
    expect(markdownPreview).toContain("Generated at");

    expect(markdownPreview).not.toContain("## Offene Punkte");
    expect(markdownPreview).not.toContain("Akzeptanzkriterien vorhanden");
    expect(markdownPreview).not.toContain("Behebung:");
  });
});
