import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IssueEvidenceDetail } from "../../src/frontend/pages/issue-evidence-detail";
import { ReleaseDashboard } from "../../src/frontend/pages/release-dashboard";
import { formatDateTime } from "../../src/frontend/utils/format";
import type { BootstrapData } from "../../src/shared/resolver-contract";
import { config, issue, release } from "../fixtures/release";
import { readinessDto } from "../fixtures/readiness-dto";

const bootstrapData: BootstrapData = {
  siteUrl: "https://demo.atlassian.net",
  project: { id: "10000", key: "DEMO", name: "Demoagentur" },
  statuses: [{ id: "31", name: "Fertig" }],
  issueTypes: [{ id: "10001", name: "Story", subtask: false }],
  fields: [],
  versions: [],
  config: config(),
  configRecoveryRequired: false,
};

function publicResult() {
  return readinessDto(release([issue({ summary: "PUBLIC_SUMMARY_SENTINEL" })]));
}

describe("Analyseansichten mit öffentlichem DTO", () => {
  it("rendert im Dashboard Key, Summary, Typ, Readiness-Status und Score", () => {
    const markup = renderToStaticMarkup(
      createElement(ReleaseDashboard, {
        data: bootstrapData,
        result: publicResult(),
        onDetail: () => undefined,
        onReport: () => undefined,
        onNewAnalysis: () => undefined,
      }),
    );

    expect(markup).toContain("DEMO-42");
    expect(markup).toContain("PUBLIC_SUMMARY_SENTINEL");
    expect(markup).toContain("Story");
    expect(markup).toContain("Bereit");
    expect(markup).toContain("100%");
    expect(markup).toContain("Expliziter JQL-Scope");
  });

  it("rendert im Evidence Detail öffentliche Issue-Metadaten und Evidence", () => {
    const result = publicResult();
    const markup = renderToStaticMarkup(
      createElement(IssueEvidenceDetail, {
        result,
        issueKey: "DEMO-42",
        siteUrl: bootstrapData.siteUrl,
        onBack: () => undefined,
      }),
    );

    expect(markup).toContain("DEMO-42: PUBLIC_SUMMARY_SENTINEL");
    expect(markup).toContain("Story");
    expect(markup).toContain("Fertig");
    expect(markup).toContain(
      formatDateTime(result.release.issues[0]?.updatedAt ?? ""),
    );
    expect(markup).toContain("Akzeptanzkriterien vorhanden");
  });

  it("stellt VERSION_ONLY weiterhin ohne JQL-Scope dar", () => {
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
      createElement(ReleaseDashboard, {
        data: bootstrapData,
        result,
        onDetail: () => undefined,
        onReport: () => undefined,
        onNewAnalysis: () => undefined,
      }),
    );

    expect(markup).toContain("Nur Jira-Version");
    expect(markup).toContain(
      "fixVersion der ausgewählten Version im Projekt DEMO",
    );
  });
});
