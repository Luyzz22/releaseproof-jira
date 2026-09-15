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
import { IssueEvidenceDetail } from "../../src/frontend/pages/issue-evidence-detail";
import type { ReleaseReadinessResultDto } from "../../src/shared/release-readiness-dto";
import { issue, release } from "../fixtures/release";
import { readinessDto } from "../fixtures/readiness-dto";

const issueKey = "RUNTIME-42";
const updatedAt = "2026-08-05T09:00:00.000Z";
const sourceField = "customfield_RUNTIME_SENTINEL";

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

function resultWithStatus(
  statusName: string | null,
): ReleaseReadinessResultDto {
  const result = readinessDto(
    release([
      issue({
        key: issueKey,
        summary: "RUNTIME_SUMMARY_SENTINEL",
        issueType: { id: "10001", name: "RUNTIME_ISSUE_TYPE_SENTINEL" },
        status: { id: "31", name: "RUNTIME_STATUS_SENTINEL" },
        updatedAt,
      }),
    ]),
  );

  result.release.issues[0]!.statusName = statusName;
  result.results[0]!.evidence[0]!.sourceField = sourceField;
  return result;
}

function renderDetail(
  locale: SupportedLocale,
  result: ReleaseReadinessResultDto = resultWithStatus(
    "RUNTIME_STATUS_SENTINEL",
  ),
  selectedIssueKey = issueKey,
): string {
  return renderToStaticMarkup(
    createElement(I18nProvider, {
      locale,
      t: translator(locale),
      children: createElement(IssueEvidenceDetail, {
        result,
        issueKey: selectedIssueKey,
        siteUrl: "https://demo.atlassian.net",
        onBack: () => undefined,
      }),
    }),
  );
}

describe("IssueEvidenceDetail complete UI i18n", () => {
  it("renders all page chrome and semantic evidence in en-US", () => {
    const markup = renderDetail("en-US");

    for (const text of [
      "Back to overview",
      "Evidence details",
      "Updated",
      "Scope: Explicit JQL scope",
      "Assessment rule",
      "Result",
      "Remediation",
      "Jira source",
      "Open issue in Jira",
      "Acceptance criteria present",
      "The configured field contains acceptance criteria.",
    ]) {
      expect(markup).toContain(text);
    }

    for (const germanText of [
      "Zurück zur Übersicht",
      "Nachweisdetails",
      "Aktualisiert",
      "Umfang:",
      "Prüfregel",
      "Konkrete Behebung",
      "Jira-Quelle",
      "Vorgang in Jira öffnen",
    ]) {
      expect(markup).not.toContain(germanText);
    }

    expect(markup).not.toContain("issueEvidenceDetail.");
  });

  it("preserves all page chrome and semantic evidence in de-DE", () => {
    const markup = renderDetail("de-DE");

    for (const text of [
      "Zurück zur Übersicht",
      "Nachweisdetails",
      "Aktualisiert",
      "Umfang: Expliziter JQL-Umfang",
      "Prüfregel",
      "Ergebnis",
      "Konkrete Behebung",
      "Jira-Quelle",
      "Vorgang in Jira öffnen",
      "Akzeptanzkriterien vorhanden",
      "Das konfigurierte Feld enthält Akzeptanzkriterien.",
    ]) {
      expect(markup).toContain(text);
    }

    expect(markup).not.toContain("issueEvidenceDetail.");
  });

  it.each([
    ["en-US", "Status unavailable"],
    ["de-DE", "Status nicht verfügbar"],
  ] as const)("localizes a missing status in %s", (locale, expected) => {
    const markup = renderDetail(locale, resultWithStatus(null));

    expect(markup).toContain(expected);
    expect(markup).not.toContain("issueEvidenceDetail.statusUnavailable");
  });

  it.each(["en-US", "de-DE"] as const)(
    "keeps Jira runtime values byte-for-byte unchanged in %s",
    (locale) => {
      const markup = renderDetail(locale);

      for (const jiraText of [
        issueKey,
        "RUNTIME_SUMMARY_SENTINEL",
        "RUNTIME_ISSUE_TYPE_SENTINEL",
        "RUNTIME_STATUS_SENTINEL",
        sourceField,
        "project = DEMO AND key = DEMO-42",
      ]) {
        expect(markup).toContain(jiraText);
      }

      expect(markup).toContain(new Date(updatedAt).toLocaleString(locale));
    },
  );

  it.each([
    ["en-US", "Open issue in Jira"],
    ["de-DE", "Vorgang in Jira öffnen"],
  ] as const)(
    "preserves the secure Jira link while localizing its label in %s",
    (locale, label) => {
      const markup = renderDetail(locale);

      expect(markup).toContain(label);
      expect(markup).toContain(
        'href="https://demo.atlassian.net/browse/RUNTIME-42"',
      );
      expect(markup).toContain('target="_blank"');
      expect(markup).toContain('rel="noopener noreferrer"');
    },
  );

  it("preserves the null render for a missing issue", () => {
    expect(renderDetail("en-US", resultWithStatus(null), "MISSING-404")).toBe(
      "",
    );
  });
});
