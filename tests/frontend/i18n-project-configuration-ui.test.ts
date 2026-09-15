import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { JiraField } from "../../src/application/ports";
import type { ProjectConfig } from "../../src/domain/models/readiness";
import {
  I18nProvider,
  type TranslationFunction,
} from "../../src/frontend/i18n/context";
import { I18N_KEYS } from "../../src/frontend/i18n/keys";
import type { SupportedLocale } from "../../src/frontend/i18n/locale";
import { ProjectConfiguration } from "../../src/frontend/pages/project-configuration";
import type { BootstrapData } from "../../src/shared/resolver-contract";
import { config } from "../fixtures/release";

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

const supportedField: JiraField = {
  id: "customfield_10042",
  name: "JIRA_FIELD_DO_NOT_TRANSLATE",
  custom: true,
  schemaType: "string",
};

const unsupportedField: JiraField = {
  id: "customfield_20000",
  name: "JIRA_NUMBER_FIELD_DO_NOT_TRANSLATE",
  custom: true,
  schemaType: "number",
};

function renderConfiguration(
  locale: SupportedLocale,
  options: {
    canConfigure?: boolean;
    saving?: boolean;
    existingConfig?: ProjectConfig | null;
    fields?: JiraField[];
  } = {},
): string {
  const data: BootstrapData = {
    siteUrl: "https://demo.atlassian.net",
    project: {
      id: "10000",
      key: "DEMO",
      name: "JIRA_PROJECT_DO_NOT_TRANSLATE",
    },
    statuses: [{ id: "31", name: "JIRA_STATUS_DO_NOT_TRANSLATE" }],
    issueTypes: [
      { id: "10001", name: "JIRA_ISSUE_TYPE_DO_NOT_TRANSLATE", subtask: false },
    ],
    fields: options.fields ?? [supportedField],
    versions: [],
    canConfigure: options.canConfigure ?? true,
    config:
      options.existingConfig === undefined
        ? config({ acceptanceCriteriaFieldId: supportedField.id })
        : options.existingConfig,
    configRecoveryRequired: false,
  };

  return renderToStaticMarkup(
    createElement(I18nProvider, {
      locale,
      t: translator(locale),
      children: createElement(ProjectConfiguration, {
        data,
        saving: options.saving ?? false,
        onSave: () => Promise.resolve(),
      }),
    }),
  );
}

describe("ProjectConfiguration complete UI i18n", () => {
  it("renders every major section and helper in en-US", () => {
    const markup = renderConfiguration("en-US");

    for (const text of [
      "Project configuration",
      "Readiness criteria for DEMO",
      "Workflow and scope",
      "Release scope",
      "Relevant issue types",
      "Accepted statuses",
      "Acceptance criteria",
      "Approval marker",
      "Blocking labels",
      "Open subtasks",
      "Save configuration",
      "Configure once which Jira evidence is required for customer acceptance.",
      "Unresolved subtasks set the issue to “Blocked”.",
    ]) {
      expect(markup).toContain(text);
    }
    expect(markup.toLowerCase()).toContain("blocking links");

    for (const jiraText of [
      "DEMO",
      "JIRA_STATUS_DO_NOT_TRANSLATE",
      "JIRA_ISSUE_TYPE_DO_NOT_TRANSLATE",
      "JIRA_FIELD_DO_NOT_TRANSLATE",
      "project = DEMO AND key = DEMO-42",
      "customer-approved",
      "release-blocker, security-blocker",
    ]) {
      expect(markup).toContain(jiraText);
    }

    expect(markup).not.toContain("projectConfiguration.");
    for (const germanText of [
      "Projektkonfiguration",
      "Bereitschaftskriterien für",
      "Arbeitsablauf und Umfang",
      "Release-Umfang",
      "Relevante Vorgangstypen",
      "Abgeschlossene Status",
      "Feld für Akzeptanzkriterien",
      "Freigabemarkierung verlangen",
      "Blockierungs-Labels",
      "Offene Unteraufgaben blockieren",
      "Konfiguration speichern",
    ]) {
      expect(markup).not.toContain(germanText);
    }
  });

  it("preserves the established de-DE wording", () => {
    const markup = renderConfiguration("de-DE");

    for (const text of [
      "Projektkonfiguration",
      "Bereitschaftskriterien für DEMO",
      "Arbeitsablauf und Umfang",
      "Release-Umfang",
      "Relevante Vorgangstypen",
      "Abgeschlossene Status",
      "Nachweise und Blockierungen",
      "Feld für Akzeptanzkriterien",
      "Offene Unteraufgaben blockieren",
      "Konfiguration speichern",
    ]) {
      expect(markup).toContain(text);
    }
  });

  it("localizes the read-only permission state without exposing a save action", () => {
    const markup = renderConfiguration("en-US", { canConfigure: false });

    expect(markup).toContain(
      "Only Jira project administrators can change this configuration.",
    );
    expect(markup).toContain(
      "You can view the currently saved criteria and run release analyses.",
    );
    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain("Save configuration");
    expect(markup).not.toContain(
      "Nur Jira-Projektadministratoren können diese Konfiguration ändern.",
    );
  });

  it("localizes the unsupported-field recovery state", () => {
    const markup = renderConfiguration("en-US", {
      fields: [supportedField, unsupportedField],
      existingConfig: config({
        acceptanceCriteriaFieldId: unsupportedField.id,
      }),
    });

    expect(markup).toContain(
      "The previously configured acceptance criteria field is not supported.",
    );
    expect(markup).toContain(
      "Select a supported text field and save the project configuration again.",
    );
    expect(markup).not.toContain("JIRA_NUMBER_FIELD_DO_NOT_TRANSLATE</option>");
  });

  it("localizes the saving action without changing its disabled behavior", () => {
    const markup = renderConfiguration("en-US", { saving: true });

    expect(markup).toContain("Saving …");
    expect(markup).toContain('type="submit" disabled=""');
  });

  it.each([
    [
      "en-US",
      "Select a supported text field for acceptance criteria.",
      "Check the project configuration.",
    ],
    [
      "de-DE",
      "Bitte wählen Sie ein unterstütztes Textfeld für Akzeptanzkriterien aus.",
      "Bitte prüfen Sie die Projektkonfiguration.",
    ],
  ] as const)(
    "provides localized page-owned validation failures for %s",
    (locale, unsupportedFieldMessage, fallbackMessage) => {
      const t = translator(locale);

      expect(t(I18N_KEYS.projectConfigurationValidationUnsupportedField)).toBe(
        unsupportedFieldMessage,
      );
      expect(t(I18N_KEYS.projectConfigurationValidationFallback)).toBe(
        fallbackMessage,
      );
    },
  );
});
