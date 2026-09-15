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
import { ReleaseSelection } from "../../src/frontend/pages/release-selection";
import type { BootstrapData } from "../../src/shared/resolver-contract";
import { config } from "../fixtures/release";

const data: BootstrapData = {
  siteUrl: "https://demo.atlassian.net",
  project: {
    id: "10000",
    key: "DEMO",
    name: "Demoagentur",
  },
  statuses: [{ id: "31", name: "Fertig" }],
  issueTypes: [
    {
      id: "10001",
      name: "Story",
      subtask: false,
    },
  ],
  fields: [],
  canConfigure: true,
  versions: [
    {
      id: "30001",
      name: "Kundenrelease 2.4",
      projectId: "10000",
      released: false,
      archived: false,
    },
  ],
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

const germanMessages = flattenTranslations(
  JSON.parse(
    readFileSync(resolve(process.cwd(), "locales/de-DE.json"), "utf8"),
  ) as unknown,
);

const germanTranslation: TranslationFunction = (
  key: I18nKey,
  defaultValue?: string,
) => germanMessages[key] ?? defaultValue ?? key;

function renderGerman(bootstrapData: BootstrapData): string {
  return renderToStaticMarkup(
    createElement(I18nProvider, {
      locale: "de-DE",
      t: germanTranslation,
      children: createElement(ReleaseSelection, {
        data: bootstrapData,
        analyzing: false,
        onAnalyze: () => Promise.resolve(),
        onConfigure: () => undefined,
      }),
    }),
  );
}

describe("Release-Auswahl", () => {
  it("kennzeichnet Konfiguration für Nicht-Administratoren als Ansicht", () => {
    const markup = renderGerman({
      ...data,
      canConfigure: false,
    });

    expect(markup).toContain("Projektkonfiguration ansehen");
    expect(markup).not.toContain("Projektkonfiguration bearbeiten");
  });

  it("verwendet vollständig deutsche Analyseterminologie", () => {
    const markup = renderGerman(data);

    expect(markup).toContain("Unteraufgaben");
    expect(markup).toContain("Umfang: Expliziter JQL-Umfang");
    expect(markup).toContain("Bereitschaft analysieren");
    expect(markup).not.toContain("Subtasks");
    expect(markup).not.toContain("Scope:");
    expect(markup).not.toContain("Readiness analysieren");
  });
});
