import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  I18nProvider,
  type TranslationFunction,
} from "../../src/frontend/i18n/context";
import type { SupportedLocale } from "../../src/frontend/i18n/locale";
import { ReportView } from "../../src/frontend/pages/report-view";
import { issue, release } from "../fixtures/release";
import { readinessDto } from "../fixtures/readiness-dto";

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

function messages(locale: SupportedLocale): Record<string, string> {
  return flattenTranslations(
    JSON.parse(
      readFileSync(resolve(process.cwd(), "locales", `${locale}.json`), "utf8"),
    ) as unknown,
  );
}

function translator(locale: SupportedLocale): TranslationFunction {
  const translations = messages(locale);

  return (key, defaultValue) => translations[key] ?? defaultValue ?? key;
}

function renderReport(locale: SupportedLocale): string {
  const result = readinessDto(
    release([
      issue({
        key: "RUNTIME-42",
        summary: "RUNTIME_SUMMARY_SENTINEL",
        issueType: { id: "10001", name: "RUNTIME_ISSUE_TYPE_SENTINEL" },
        status: { id: "31", name: "RUNTIME_STATUS_SENTINEL" },
      }),
    ]),
  );

  result.release.projectKey = "RUNTIME_PROJECT_SENTINEL";
  result.release.versionName = "RUNTIME_VERSION_SENTINEL";
  result.release.releaseScopeJql =
    "project = RUNTIME_PROJECT_SENTINEL AND label = RUNTIME_SCOPE_SENTINEL";

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

describe("ReportView complete UI i18n", () => {
  it("renders all visible and assistive ReportView chrome in en-US", () => {
    const markup = renderReport("en-US");

    for (const text of [
      "Back to overview",
      "Handoff report",
      "Copy Markdown",
      "Print",
      'aria-label="Release readiness report"',
      "Release readiness report",
      "Scope:",
      "Readiness",
      "Total",
      "Evidence matrix",
      "Release readiness summary for each Jira issue",
      "Issue",
      "Status",
      "Score",
      "Blockers",
      "Missing",
      "Sharing",
      "Markdown preview",
      'aria-label="Markdown report"',
    ]) {
      expect(markup).toContain(text);
    }

    expect(markup).toContain('role="status" aria-live="polite"');
    expect(markup).toContain('<caption class="visually-hidden">');
    expect(markup).toContain('<th scope="row" class="row-header">');
    expect(markup).not.toContain("reportView.");

    for (const germanText of [
      "Zurück zur Übersicht",
      "Übergabebericht",
      "Markdown kopieren",
      "Drucken",
      "Bericht zur Release-Bereitschaft",
      "Umfang:",
      "Bereitschaft",
      "Gesamt",
      "Nachweismatrix",
      "Vorgang",
      "Bewertung",
      "Blockierungen",
      "Fehlend",
      "Weitergabe",
      "Markdown-Vorschau",
    ]) {
      expect(markup).not.toContain(germanText);
    }
  });

  it("preserves all visible and assistive ReportView chrome in de-DE", () => {
    const markup = renderReport("de-DE");

    for (const text of [
      "Zurück zur Übersicht",
      "Übergabebericht",
      "Markdown kopieren",
      "Drucken",
      'aria-label="Bericht zur Release-Bereitschaft"',
      "Bericht zur Release-Bereitschaft",
      "Umfang:",
      "Bereitschaft",
      "Gesamt",
      "Nachweismatrix",
      "Zusammenfassung der Release-Bereitschaft je Jira-Vorgang",
      "Vorgang",
      "Status",
      "Bewertung",
      "Blockierungen",
      "Fehlend",
      "Weitergabe",
      "Markdown-Vorschau",
      'aria-label="Markdown-Bericht"',
    ]) {
      expect(markup).toContain(text);
    }

    expect(markup).toContain('role="status" aria-live="polite"');
    expect(markup).not.toContain("reportView.");
  });

  it.each(["en-US", "de-DE"] as const)(
    "keeps Jira and runtime values byte-for-byte unchanged in %s",
    (locale) => {
      const markup = renderReport(locale);

      for (const runtimeText of [
        "RUNTIME_PROJECT_SENTINEL",
        "RUNTIME_VERSION_SENTINEL",
        "RUNTIME-42",
        "RUNTIME_SCOPE_SENTINEL",
      ]) {
        expect(markup).toContain(runtimeText);
      }
    },
  );

  it("localizes every copy state through canonical ReportView resources", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/frontend/pages/report-view.tsx"),
      "utf8",
    );
    const english = messages("en-US");
    const german = messages("de-DE");

    expect(english).toMatchObject({
      "reportView.copy.idle": "Copy Markdown",
      "reportView.copy.copied": "Copied",
      "reportView.copy.failed": "Copy failed",
      "reportView.copy.statusCopied":
        "Markdown report copied to the clipboard.",
      "reportView.copy.statusFailed": "Markdown report could not be copied.",
    });
    expect(german).toMatchObject({
      "reportView.copy.idle": "Markdown kopieren",
      "reportView.copy.copied": "Kopiert",
      "reportView.copy.failed": "Kopieren fehlgeschlagen",
      "reportView.copy.statusCopied":
        "Markdown-Bericht wurde in die Zwischenablage kopiert.",
      "reportView.copy.statusFailed":
        "Markdown-Bericht konnte nicht kopiert werden.",
    });

    for (const key of [
      "reportViewCopyIdle",
      "reportViewCopyCopied",
      "reportViewCopyFailed",
      "reportViewCopyStatusCopied",
      "reportViewCopyStatusFailed",
    ]) {
      expect(source).toContain(`I18N_KEYS.${key}`);
    }
  });

  it("preserves clipboard and print behavior", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/frontend/pages/report-view.tsx"),
      "utf8",
    );

    expect(source).toContain("await navigator.clipboard.writeText(report)");
    expect(source).toContain('setCopyState("copied")');
    expect(source).toContain('setCopyState("failed")');
    expect(source).toContain(
      'window.setTimeout(() => setCopyState("idle"), 2500)',
    );
    expect(source).toContain("onClick={() => window.print()}");
  });
});
