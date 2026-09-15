import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  I18nProvider,
  type TranslationFunction,
} from "../../src/frontend/i18n/context";
import { EmptyState } from "../../src/frontend/pages/empty-state";
import type { BootstrapData } from "../../src/shared/resolver-contract";

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

const germanMessages = flattenTranslations(
  JSON.parse(
    readFileSync(resolve(process.cwd(), "locales/de-DE.json"), "utf8"),
  ) as unknown,
);

const germanTranslation: TranslationFunction = (key, defaultValue) =>
  germanMessages[key] ?? defaultValue ?? key;

const recoveryData = {
  siteUrl: "https://demo.atlassian.net",
  project: { id: "10000", key: "DEMO", name: "Demoagentur" },
  statuses: [{ id: "31", name: "Fertig" }],
  issueTypes: [{ id: "10001", name: "Story", subtask: false }],
  fields: [
    {
      id: "customfield_10042",
      name: "Akzeptanzkriterien",
      custom: true,
      schemaType: "string",
    },
  ],
  versions: [
    {
      id: "30001",
      name: "Kundenrelease 2.4",
      projectId: "10000",
      released: false,
      archived: false,
    },
  ],
  config: null,
  canConfigure: true,
  configRecoveryRequired: true,
} satisfies BootstrapData & { configRecoveryRequired: boolean };

function renderEmptyState(data: BootstrapData): string {
  return renderToStaticMarkup(
    createElement(I18nProvider, {
      locale: "de-DE",
      t: germanTranslation,
      children: createElement(EmptyState, {
        data,
        onConfigure: () => undefined,
      }),
    }),
  );
}

describe("Recovery Empty State", () => {
  it("zeigt Nicht-Administratoren keinen Konfigurations-Save-Pfad", () => {
    const markup = renderEmptyState({
      ...recoveryData,
      canConfigure: false,
      configRecoveryRequired: false,
    });

    expect(markup).toContain("Projektadministration erforderlich");
    expect(markup).toContain("Jira-Projektadministrator");
    expect(markup).not.toContain("Projekt jetzt konfigurieren");
  });

  it("verwendet im Erstzustand ausschließlich deutsche Bereitschaftsterminologie", () => {
    const markup = renderEmptyState({
      ...recoveryData,
      configRecoveryRequired: false,
    });

    expect(markup).toContain("Bereitschaftskonfiguration");
    expect(markup).not.toContain("Readiness-Konfiguration");
  });

  it("erklärt die beschädigte Konfiguration und bietet die Neukonfiguration an", () => {
    const markup = renderEmptyState(recoveryData);

    expect(markup).toContain(
      "Die gespeicherte Projektkonfiguration ist beschädigt oder nicht mehr kompatibel.",
    );
    expect(markup).toContain("Projektkonfiguration öffnen");
  });
});
