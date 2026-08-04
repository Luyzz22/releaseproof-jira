import { describe, expect, it } from "vitest";
import { analyzeRelease } from "../../src/domain/services/analyze-release";
import { AppError, toSafeError } from "../../src/shared/errors";
import { formatDateTime } from "../../src/frontend/utils/format";
import { buildJiraIssueUrl } from "../../src/frontend/utils/jira-url";
import {
  buildMarkdownReport,
  getOpenFindings,
} from "../../src/frontend/utils/report";
import { issue, projectConfig, release } from "../fixtures/release";

describe("sichere Frontend-Grenzen", () => {
  it("erzeugt Jira-Links ausschließlich über HTTPS und denselben Origin", () => {
    expect(buildJiraIssueUrl("https://demo.atlassian.net", "DEMO-42")).toBe(
      "https://demo.atlassian.net/browse/DEMO-42",
    );
    expect(
      buildJiraIssueUrl("http://demo.atlassian.net", "DEMO-42"),
    ).toBeNull();
    expect(buildJiraIssueUrl("kein-url", "DEMO-42")).toBeNull();
  });

  it("zeigt bei ungültigen Zeitstempeln einen stabilen Fallback", () => {
    expect(formatDateTime("ungültig")).toBe("Zeitpunkt nicht verfügbar");
  });

  it("erzeugt Findings und Markdown aus derselben kanonischen Ableitung", () => {
    const candidate = release([
      issue({
        acceptanceCriteria: null,
        labels: ["release-blocker"],
        fixVersions: [],
      }),
    ]);
    const result = analyzeRelease(
      candidate,
      projectConfig,
      "2026-07-11T09:00:00.000Z",
    );
    const findings = getOpenFindings(result);
    const markdown = buildMarkdownReport(result);

    expect(findings).toHaveLength(4);
    expect(markdown).toContain("| DEMO-42 | BLOCKED | 45% | 1 | 3 |");
    expect(markdown).toContain("Expliziter JQL-Scope");
    expect(markdown).toContain("Korrekte Release-Version");
    expect(markdown).toContain("keine Jira-Version");
    for (const finding of findings) {
      expect(markdown).toContain(finding.evidence.title);
    }
  });

  it("übersetzt überschrittene Synchronlimits in eine sichere Nutzerantwort", () => {
    expect(
      toSafeError(
        new AppError("RESULT_LIMIT_EXCEEDED", "Internal pagination detail"),
      ),
    ).toEqual({
      code: "RESULT_LIMIT_EXCEEDED",
      message:
        "Die Datenmenge ist für eine synchrone Analyse zu groß. Bitte verkleinern Sie den Release-Scope.",
    });
  });
});
