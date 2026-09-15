import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IssueEvidenceDetail } from "../../src/frontend/pages/issue-evidence-detail";
import { ReleaseDashboard } from "../../src/frontend/pages/release-dashboard";
import {
  I18nProvider,
  type TranslationFunction,
} from "../../src/frontend/i18n/context";
import { formatDateTimeForLocale } from "../../src/frontend/utils/format";
import type { BootstrapData } from "../../src/shared/resolver-contract";
import { config, issue, release } from "../fixtures/release";
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

const germanMessages = flattenTranslations(
  JSON.parse(
    readFileSync(resolve(process.cwd(), "locales/de-DE.json"), "utf8"),
  ) as unknown,
);

const germanTranslation: TranslationFunction = (key, defaultValue) =>
  germanMessages[key] ?? defaultValue ?? key;

function withGermanI18n(element: React.ReactNode) {
  return createElement(I18nProvider, {
    locale: "de-DE",
    t: germanTranslation,
    children: element,
  });
}

const bootstrapData: BootstrapData = {
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

function publicResult() {
  return readinessDto(release([issue({ summary: "PUBLIC_SUMMARY_SENTINEL" })]));
}

describe("Analyseansichten mit öffentlichem DTO", () => {
  it("rendert im Dashboard Key, Summary, Typ, Status, Bewertung und deutsche Überschriften", () => {
    const markup = renderToStaticMarkup(
      withGermanI18n(
        createElement(ReleaseDashboard, {
          data: bootstrapData,
          result: publicResult(),
          onDetail: () => undefined,
          onReport: () => undefined,
          onNewAnalysis: () => undefined,
        }),
      ),
    );

    expect(markup).toContain("DEMO-42");
    expect(markup).toContain("PUBLIC_SUMMARY_SENTINEL");
    expect(markup).toContain("Story");
    expect(markup).toContain("Bereit");
    expect(markup).toContain("100%");
    expect(markup).toContain("Expliziter JQL-Umfang");
    expect(markup).toContain("Release-Bereitschaft");
    expect(markup).toContain("Bereitschaftswert");
    expect(markup).toContain("Nachweismatrix");
    expect(markup).toContain("Bewertung");
    expect(markup).toContain("Umfang:");
    expect(markup).not.toContain("Release Readiness");
    expect(markup).not.toContain("Evidence-Matrix");
    expect(markup).not.toContain(">Score<");
    expect(markup).not.toContain("Scope:");
  });

  it("rendert in den Nachweisdetails öffentliche Issue-Metadaten und Nachweise", () => {
    const result = publicResult();
    const markup = renderToStaticMarkup(
      withGermanI18n(
        createElement(IssueEvidenceDetail, {
          result,
          issueKey: "DEMO-42",
          siteUrl: bootstrapData.siteUrl,
          onBack: () => undefined,
        }),
      ),
    );

    expect(markup).toContain("Nachweisdetails");
    expect(markup).not.toContain("Evidence Detail");
    expect(markup).toContain("DEMO-42: PUBLIC_SUMMARY_SENTINEL");
    expect(markup).toContain("Story");
    expect(markup).toContain("Fertig");
    expect(markup).toContain(
      formatDateTimeForLocale(
        result.release.issues[0]?.updatedAt ?? "",
        "de-DE",
        germanTranslation,
      ),
    );
    expect(markup).toContain("Akzeptanzkriterien vorhanden");
    expect(markup).toContain("Prüfregel");
    expect(markup).toContain("Zurück zur Übersicht");
    expect(markup).not.toContain("Zurück zum Dashboard");
    expect(markup).not.toContain("Scope:");
  });

  it("stellt VERSION_ONLY weiterhin ohne JQL-Umfang dar", () => {
    const candidate = {
      ...release(),
      releaseScopeMode: "VERSION_ONLY" as const,
    };
    delete candidate.releaseScopeJql;
    const result = readinessDto(
      candidate,
      config({ releaseScopeMode: "VERSION_ONLY" }),
    );
    const markup = renderToStaticMarkup(
      withGermanI18n(
        createElement(ReleaseDashboard, {
          data: bootstrapData,
          result,
          onDetail: () => undefined,
          onReport: () => undefined,
          onNewAnalysis: () => undefined,
        }),
      ),
    );

    expect(markup).toContain("Nur Jira-Version");
    expect(markup).toContain(
      "fixVersion der ausgewählten Version im Projekt DEMO",
    );
  });
});
