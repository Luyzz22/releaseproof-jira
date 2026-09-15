import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  I18nProvider,
  type TranslationFunction,
} from "../../src/frontend/i18n/context";
import { I18N_KEYS } from "../../src/frontend/i18n/keys";
import { ReleaseDashboard } from "../../src/frontend/pages/release-dashboard";
import type { BootstrapData } from "../../src/shared/resolver-contract";
import { config, issue, release } from "../fixtures/release";
import { readinessDto } from "../fixtures/readiness-dto";

const data: BootstrapData = {
  siteUrl: "https://demo.atlassian.net",
  project: { id: "10000", key: "DEMO", name: "Demo" },
  statuses: [{ id: "31", name: "Done" }],
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

const englishMessages = flattenTranslations(
  JSON.parse(
    readFileSync(resolve(process.cwd(), "locales/en-US.json"), "utf8"),
  ) as unknown,
);

const englishTranslation: TranslationFunction = (key, defaultValue) =>
  englishMessages[key] ?? defaultValue ?? key;

describe("ReleaseDashboard readiness status i18n", () => {
  it("renders readiness status, date and scope in en-US", () => {
    const generatedAt = "2026-08-05T09:00:00.000Z";

    const result = readinessDto(
      release([
        issue(),
        issue({
          key: "DEMO-43",
          hasAcceptanceCriteria: false,
        }),
      ]),
      config(),
      generatedAt,
    );

    const markup = renderToStaticMarkup(
      createElement(I18nProvider, {
        locale: "en-US",
        t: englishTranslation,
        children: createElement(ReleaseDashboard, {
          data,
          result,
          onDetail: () => undefined,
          onReport: () => undefined,
          onNewAnalysis: () => undefined,
        }),
      }),
    );

    expect(markup).toContain("Ready");
    expect(markup).toContain("Incomplete");
    expect(markup).toContain("Blocked");

    expect(markup).toContain("Explicit JQL scope");
    expect(markup).toContain(new Date(generatedAt).toLocaleString("en-US"));

    expect(markup).toContain(
      englishMessages[I18N_KEYS.evidenceTitleAcceptanceCriteriaPresent],
    );
    expect(markup).not.toContain("Akzeptanzkriterien vorhanden");
    expect(markup).not.toContain(
      I18N_KEYS.evidenceTitleAcceptanceCriteriaPresent,
    );

    expect(markup).not.toContain(">Bereit<");
    expect(markup).not.toContain(">Unvollständig<");
    expect(markup).not.toContain(">Blockiert<");
    expect(markup).not.toContain("Expliziter JQL-Umfang");

    expect(markup).not.toContain("releaseScope.mode.");
    expect(markup).not.toContain("releaseScope.explanation.");
    expect(markup).not.toContain("format.dateUnavailable");
  });
});
