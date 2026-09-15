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
import { ReleaseDashboard } from "../../src/frontend/pages/release-dashboard";
import type { ReleaseReadinessResultDto } from "../../src/shared/release-readiness-dto";
import type { BootstrapData } from "../../src/shared/resolver-contract";
import { config, issue, release } from "../fixtures/release";
import { readinessDto } from "../fixtures/readiness-dto";

const data: BootstrapData = {
  siteUrl: "https://demo.atlassian.net",
  project: { id: "10000", key: "DEMO", name: "Demoagentur" },
  statuses: [{ id: "31", name: "Fertig" }],
  issueTypes: [{ id: "10001", name: "Story", subtask: false }],
  fields: [],
  versions: [],
  canConfigure: true,
  config: config(),
  configRecoveryRequired: false,
};

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

function renderDashboard(
  locale: SupportedLocale,
  result: ReleaseReadinessResultDto,
): string {
  return renderToStaticMarkup(
    createElement(I18nProvider, {
      locale,
      t: translator(locale),
      children: createElement(ReleaseDashboard, {
        data,
        result,
        onDetail: () => undefined,
        onReport: () => undefined,
        onNewAnalysis: () => undefined,
      }),
    }),
  );
}

const generatedAt = "2026-08-05T09:00:00.000Z";

const dashboardResult = readinessDto(
  release([
    issue({
      hasAcceptanceCriteria: false,
      summary: "JIRA_SUMMARY_DO_NOT_TRANSLATE",
      issueType: { id: "10001", name: "Jira Story Type" },
      status: { id: "21", name: "Jira In Progress" },
    }),
  ]),
  config(),
  generatedAt,
);

describe("ReleaseDashboard complete UI i18n", () => {
  it("renders every dashboard-owned label in en-US without leaking German or keys", () => {
    const markup = renderDashboard("en-US", dashboardResult);

    for (const text of [
      "Release readiness",
      "Analyzed at",
      "issues",
      "Scope",
      "New analysis",
      "Open report",
      "Readiness score",
      "Priorities",
      "Top issues",
      "Evidence matrix",
      "Issues in release",
      "Issue",
      "Type",
      "Status",
      "Blockers",
      "Missing evidence",
      "Score",
      "Actions",
      "Details",
    ]) {
      expect(markup).toContain(text);
    }

    expect(markup).toContain("Acceptance criteria present");
    expect(markup).toContain(new Date(generatedAt).toLocaleString("en-US"));
    expect(markup).toContain("Explicit JQL scope");

    for (const jiraText of [
      "DEMO",
      "Kundenrelease 2.4",
      "JIRA_SUMMARY_DO_NOT_TRANSLATE",
      "Jira Story Type",
      "project = DEMO AND key = DEMO-42",
    ]) {
      expect(markup).toContain(jiraText);
    }

    expect(markup).not.toContain("releaseDashboard.");
    for (const germanText of [
      "Release-Bereitschaft",
      "Analysiert am",
      "Vorgänge",
      "Umfang:",
      "Neue Analyse",
      "Bericht öffnen",
      "Bereitschaftswert",
      "Prioritäten",
      "Wichtigste Probleme",
      "Nachweismatrix",
      "Blockierungen",
      "Fehlend",
      "Bewertung",
      "Aktionen",
    ]) {
      expect(markup).not.toContain(germanText);
    }
  });

  it("preserves the established dashboard wording in de-DE", () => {
    const markup = renderDashboard("de-DE", dashboardResult);

    for (const text of [
      "Release-Bereitschaft",
      "Analysiert am",
      "Umfang",
      "Bereitschaftswert",
      "Prioritäten",
      "Wichtigste Probleme",
      "Nachweismatrix",
      "Bewertung",
      "Details",
    ]) {
      expect(markup).toContain(text);
    }
  });

  it.each([
    [
      "en-US",
      "Empty release",
      "No matching issues found",
      "The configured scope contains no issues of the selected issue types. The score and status are therefore not interpreted as an assessment of release readiness.",
    ],
    [
      "de-DE",
      "Leeres Release",
      "Keine passenden Vorgänge gefunden",
      "Der konfigurierte Umfang enthält keine Vorgänge der ausgewählten Vorgangstypen. Bewertung und Status werden deshalb nicht als Aussage zur Release-Bereitschaft interpretiert.",
    ],
  ] as const)(
    "localizes the zero-issue state for %s",
    (locale, eyebrow, title, description) => {
      const markup = renderDashboard(locale, readinessDto(release([])));

      expect(markup).toContain(eyebrow);
      expect(markup).toContain(title);
      expect(markup).toContain(description);
      expect(markup).not.toContain("releaseDashboard.");
    },
  );
});
