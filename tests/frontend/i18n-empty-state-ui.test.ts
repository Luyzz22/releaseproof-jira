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
import { EmptyState } from "../../src/frontend/pages/empty-state";
import type { BootstrapData } from "../../src/shared/resolver-contract";

const projectName = "RUNTIME_PROJECT_SENTINEL";

const baseData: BootstrapData = {
  siteUrl: "https://demo.atlassian.net",
  project: { id: "10000", key: "DEMO", name: projectName },
  statuses: [{ id: "31", name: "Fertig" }],
  issueTypes: [{ id: "10001", name: "Story", subtask: false }],
  fields: [],
  versions: [],
  config: null,
  canConfigure: false,
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

function renderEmptyState(
  locale: SupportedLocale,
  canConfigure: boolean,
  configRecoveryRequired: boolean,
): string {
  return renderToStaticMarkup(
    createElement(I18nProvider, {
      locale,
      t: translator(locale),
      children: createElement(EmptyState, {
        data: { ...baseData, canConfigure, configRecoveryRequired },
        onConfigure: () => undefined,
      }),
    }),
  );
}

function visibleText(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const presentationCases = [
  {
    name: "admin required without recovery in en-US",
    locale: "en-US",
    canConfigure: false,
    recoveryRequired: false,
    eyebrow: "Project administration required",
    title: "ReleaseProof must first be configured by a project administrator.",
    description:
      "No readiness configuration has been saved for RUNTIME_PROJECT_SENTINEL. Ask a Jira project administrator to configure ReleaseProof once.",
    action: null,
    emphasizesProject: true,
  },
  {
    name: "admin required without recovery in de-DE",
    locale: "de-DE",
    canConfigure: false,
    recoveryRequired: false,
    eyebrow: "Projektadministration erforderlich",
    title:
      "ReleaseProof muss zuerst durch einen Projektadministrator konfiguriert werden.",
    description:
      "Für RUNTIME_PROJECT_SENTINEL ist noch keine Bereitschaftskonfiguration hinterlegt. Bitten Sie einen Jira-Projektadministrator, ReleaseProof einmalig zu konfigurieren.",
    action: null,
    emphasizesProject: true,
  },
  {
    name: "admin required with recovery in en-US",
    locale: "en-US",
    canConfigure: false,
    recoveryRequired: true,
    eyebrow: "Project administration required",
    title: "The project configuration must be repaired by an administrator.",
    description:
      "The saved project configuration is corrupted or no longer compatible. A Jira project administrator must save a new valid configuration.",
    action: null,
    emphasizesProject: false,
  },
  {
    name: "admin required with recovery in de-DE",
    locale: "de-DE",
    canConfigure: false,
    recoveryRequired: true,
    eyebrow: "Projektadministration erforderlich",
    title:
      "Die Projektkonfiguration muss durch einen Administrator repariert werden.",
    description:
      "Die gespeicherte Projektkonfiguration ist beschädigt oder nicht mehr kompatibel. Ein Jira-Projektadministrator muss eine neue gültige Konfiguration speichern.",
    action: null,
    emphasizesProject: false,
  },
  {
    name: "configurable without recovery in en-US",
    locale: "en-US",
    canConfigure: true,
    recoveryRequired: false,
    eyebrow: "Welcome to ReleaseProof",
    title: "Make release evidence visible before the customer asks.",
    description:
      "No readiness configuration has been saved for RUNTIME_PROJECT_SENTINEL. Define the criteria once for this project; Jira content is not stored permanently.",
    action: "Configure project now",
    emphasizesProject: true,
  },
  {
    name: "configurable without recovery in de-DE",
    locale: "de-DE",
    canConfigure: true,
    recoveryRequired: false,
    eyebrow: "Willkommen bei ReleaseProof",
    title: "Release-Nachweise sichtbar machen, bevor der Kunde fragt.",
    description:
      "Für RUNTIME_PROJECT_SENTINEL ist noch keine Bereitschaftskonfiguration hinterlegt. Definieren Sie die Kriterien einmal projektbezogen; Jira-Inhalte werden nicht dauerhaft gespeichert.",
    action: "Projekt jetzt konfigurieren",
    emphasizesProject: true,
  },
  {
    name: "configurable with recovery in en-US",
    locale: "en-US",
    canConfigure: true,
    recoveryRequired: true,
    eyebrow: "Repair project configuration",
    title: "Replace the project configuration safely.",
    description:
      "The saved project configuration is corrupted or no longer compatible. Save a new valid configuration to use ReleaseProof again.",
    action: "Open project configuration",
    emphasizesProject: false,
  },
  {
    name: "configurable with recovery in de-DE",
    locale: "de-DE",
    canConfigure: true,
    recoveryRequired: true,
    eyebrow: "Projektkonfiguration reparieren",
    title: "Projektkonfiguration sicher ersetzen.",
    description:
      "Die gespeicherte Projektkonfiguration ist beschädigt oder nicht mehr kompatibel. Speichern Sie eine neue gültige Konfiguration, um ReleaseProof wieder zu verwenden.",
    action: "Projektkonfiguration öffnen",
    emphasizesProject: false,
  },
] as const;

describe("EmptyState complete UI i18n", () => {
  it.each(presentationCases)(
    "renders $name",
    ({
      locale,
      canConfigure,
      recoveryRequired,
      eyebrow,
      title,
      description,
      action,
      emphasizesProject,
    }) => {
      const markup = renderEmptyState(locale, canConfigure, recoveryRequired);
      const text = visibleText(markup);

      expect(text).toContain(eyebrow);
      expect(text).toContain(title);
      expect(text).toContain(description);
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).not.toContain("emptyState.");

      if (emphasizesProject) {
        expect(markup).toContain(`<strong>${projectName}</strong>`);
      } else {
        expect(markup).not.toContain(projectName);
      }

      if (action === null) {
        expect(markup).not.toContain("<button");
      } else {
        expect(markup).toContain("<button");
        expect(markup).toContain(`>${action}</button>`);
      }
    },
  );
});
