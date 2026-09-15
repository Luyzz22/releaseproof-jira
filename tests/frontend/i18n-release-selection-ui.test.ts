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
import { ReleaseSelection } from "../../src/frontend/pages/release-selection";
import type { BootstrapData } from "../../src/shared/resolver-contract";
import { config } from "../fixtures/release";

const data: BootstrapData = {
  siteUrl: "https://demo.atlassian.net",
  project: {
    id: "10000",
    key: "RAW_PROJECT_KEY",
    name: "JIRA_PROJECT_NAME_DO_NOT_TRANSLATE",
  },
  statuses: [],
  issueTypes: [],
  fields: [],
  versions: [
    {
      id: "30001",
      name: "JIRA_VERSION_NAME_DO_NOT_TRANSLATE",
      projectId: "10000",
      released: false,
      archived: false,
    },
  ],
  canConfigure: true,
  config: config({
    projectKey: "RAW_PROJECT_KEY",
    releaseScopeJql: "project = RAW_PROJECT_KEY AND key = RAW_PROJECT_KEY-42",
  }),
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

function renderSelection(
  locale: SupportedLocale,
  bootstrapData: BootstrapData = data,
  analyzing = false,
): string {
  return renderToStaticMarkup(
    createElement(I18nProvider, {
      locale,
      t: translator(locale),
      children: createElement(ReleaseSelection, {
        data: bootstrapData,
        analyzing,
        onAnalyze: () => Promise.resolve(),
        onConfigure: () => undefined,
      }),
    }),
  );
}

describe("ReleaseSelection complete UI i18n", () => {
  it("renders every page-owned area in en-US without translating Jira data or leaking keys", () => {
    const markup = renderSelection("en-US");

    for (const text of [
      "New analysis",
      "Is this release ready for customer acceptance?",
      "ReleaseProof checks documentation, completion status, subtasks, dependencies, labels, and approvals without storing Jira content.",
      "Jira version",
      "Analyze readiness",
      "Edit project configuration",
      "Assessment scope",
      "Deterministic rules",
      "Every result can be traced to a specific rule and Jira source.",
      "No external transfer",
      "Processing and configuration remain within Atlassian Forge.",
      "Actionable remediation",
      "Missing evidence is flagged with a concrete remediation action.",
      "Scope: Explicit JQL scope",
    ]) {
      expect(markup).toContain(text);
    }

    for (const jiraText of [
      "RAW_PROJECT_KEY",
      "JIRA_PROJECT_NAME_DO_NOT_TRANSLATE",
      "JIRA_VERSION_NAME_DO_NOT_TRANSLATE",
      "project = RAW_PROJECT_KEY AND key = RAW_PROJECT_KEY-42",
    ]) {
      expect(markup).toContain(jiraText);
    }

    expect(markup).not.toContain("releaseSelection.");
    for (const germanText of [
      "Neue Analyse",
      "Ist das Release bereit",
      "Jira-Version",
      "Bereitschaft analysieren",
      "Projektkonfiguration bearbeiten",
      "Prüfumfang",
      "Deterministische Regeln",
      "Keine externe Übertragung",
      "Konkrete Behebung",
    ]) {
      expect(markup).not.toContain(germanText);
    }
  });

  it("preserves the established complete page wording in de-DE", () => {
    const markup = renderSelection("de-DE");

    for (const text of [
      "Neue Analyse",
      "Ist das Release bereit für die Kundenabnahme?",
      "ReleaseProof prüft Dokumentation, Abschlussstatus, Unteraufgaben, Abhängigkeiten, Labels und Freigaben – ohne Jira-Inhalte zu speichern.",
      "Jira-Version",
      "Bereitschaft analysieren",
      "Projektkonfiguration bearbeiten",
      "Prüfumfang",
      "Deterministische Regeln",
      "Keine externe Übertragung",
      "Konkrete Behebung",
      "Umfang: Expliziter JQL-Umfang",
    ]) {
      expect(markup).toContain(text);
    }

    expect(markup).not.toContain("releaseSelection.");
  });

  it.each([
    ["en-US", "released"],
    ["de-DE", "veröffentlicht"],
  ] as const)("localizes the released suffix in %s", (locale, suffix) => {
    const markup = renderSelection(locale, {
      ...data,
      versions: [{ ...data.versions[0]!, released: true }],
    });

    expect(markup).toContain(`JIRA_VERSION_NAME_DO_NOT_TRANSLATE · ${suffix}`);
  });

  it.each([
    ["en-US", "Analyzing release…"],
    ["de-DE", "Release wird analysiert …"],
  ] as const)("localizes the analyzing state in %s", (locale, expected) => {
    expect(renderSelection(locale, data, true)).toContain(expected);
  });

  it.each([
    [
      "en-US",
      "No version available",
      "Create a version in the Jira project first or check your permissions.",
    ],
    [
      "de-DE",
      "Keine Version verfügbar",
      "Legen Sie im Jira-Projekt zuerst eine Version an oder prüfen Sie Ihre Berechtigung.",
    ],
  ] as const)(
    "localizes the zero-version state in %s",
    (locale, title, description) => {
      const markup = renderSelection(locale, { ...data, versions: [] });

      expect(markup).toContain(title);
      expect(markup).toContain(description);
      expect(markup).not.toContain("releaseSelection.");
    },
  );

  it.each([
    ["en-US", true, "Edit project configuration", "View project configuration"],
    [
      "en-US",
      false,
      "View project configuration",
      "Edit project configuration",
    ],
    [
      "de-DE",
      true,
      "Projektkonfiguration bearbeiten",
      "Projektkonfiguration ansehen",
    ],
    [
      "de-DE",
      false,
      "Projektkonfiguration ansehen",
      "Projektkonfiguration bearbeiten",
    ],
  ] as const)(
    "localizes the configuration action in %s when canConfigure is %s",
    (locale, canConfigure, expected, unexpected) => {
      const markup = renderSelection(locale, { ...data, canConfigure });

      expect(markup).toContain(expected);
      expect(markup).not.toContain(unexpected);
    },
  );

  it("uses the translation key in the page-local version validation branch", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/frontend/pages/release-selection.tsx"),
      "utf8",
    );

    expect(source).toContain(
      "t(I18N_KEYS.releaseSelectionValidationVersionRequired)",
    );
    expect(source).not.toContain("Bitte wählen Sie eine Jira-Version.");
  });
});
