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

const englishMessages = flatten(
  JSON.parse(
    readFileSync(resolve(process.cwd(), "locales/en-US.json"), "utf8"),
  ) as unknown,
);

const englishTranslation: TranslationFunction = (
  key: I18nKey,
  defaultValue?: string,
) => englishMessages[key] ?? defaultValue ?? key;

function dataWithConfig(
  bootstrapConfig: NonNullable<BootstrapData["config"]>,
): BootstrapData {
  return {
    siteUrl: "https://demo.atlassian.net",
    project: {
      id: "10000",
      key: "DEMO",
      name: "Demo",
    },
    statuses: [],
    issueTypes: [],
    fields: [],
    versions: [
      {
        id: "30001",
        name: "Release 2.4",
        projectId: "10000",
        released: false,
        archived: false,
      },
    ],
    canConfigure: true,
    config: bootstrapConfig,
    configRecoveryRequired: false,
  };
}

function renderSelection(bootstrapData: BootstrapData): string {
  return renderToStaticMarkup(
    createElement(I18nProvider, {
      locale: "en-US",
      t: englishTranslation,
      children: createElement(ReleaseSelection, {
        data: bootstrapData,
        analyzing: false,
        onAnalyze: () => Promise.resolve(),
        onConfigure: () => undefined,
      }),
    }),
  );
}

describe("ReleaseSelection scope i18n", () => {
  it("renders JQL scope presentation in en-US", () => {
    const markup = renderSelection(dataWithConfig(config()));

    expect(markup).toContain("Scope: Explicit JQL scope");

    expect(markup).not.toContain("Umfang: Expliziter JQL-Umfang");
    expect(markup).not.toContain("releaseSelection.scopeLabel");
    expect(markup).not.toContain("releaseScope.mode.jqlScope");
  });

  it("renders VERSION_ONLY scope warning in en-US", () => {
    const markup = renderSelection(
      dataWithConfig(
        config({
          releaseScopeMode: "VERSION_ONLY",
        }),
      ),
    );

    expect(markup).toContain("Scope: Jira version only");
    expect(markup).toContain(
      "Missing version assignments cannot be detected with this scope.",
    );

    expect(markup).not.toContain(
      "Fehlende Versionszuordnungen können mit diesem Umfang nicht erkannt werden.",
    );
    expect(markup).not.toContain("releaseSelection.versionOnlyWarning");
  });
});
