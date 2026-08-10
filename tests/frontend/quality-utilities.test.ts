import { describe, expect, it } from "vitest";
import { AppError, toSafeError } from "../../src/shared/errors";
import { formatDateTime } from "../../src/frontend/utils/format";
import { buildJiraIssueUrl } from "../../src/frontend/utils/jira-url";
import {
  buildMarkdownReport,
  getOpenFindings,
} from "../../src/frontend/utils/report";
import { issue, projectConfig, release } from "../fixtures/release";
import { readinessDto } from "../fixtures/readiness-dto";

function expectNoRawReadinessStatusAtStatusPositions(markdown: string): void {
  expect(markdown).not.toMatch(
    /- Status: (?:READY|INCOMPLETE|BLOCKED|NOT_APPLICABLE)/,
  );
  expect(markdown).not.toMatch(
    /^- (?:READY|INCOMPLETE|BLOCKED|NOT_APPLICABLE):/m,
  );
  expect(markdown).not.toMatch(
    /\| (?:READY|INCOMPLETE|BLOCKED|NOT_APPLICABLE) \|/,
  );
  expect(markdown).not.toMatch(
    /· (?:READY|INCOMPLETE|BLOCKED|NOT_APPLICABLE) ·/,
  );
}

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
        hasAcceptanceCriteria: false,
        labels: ["release-blocker"],
        fixVersions: [],
      }),
    ]);
    const result = readinessDto(
      candidate,
      projectConfig,
      "2026-07-11T09:00:00.000Z",
    );
    const findings = getOpenFindings(result);
    const markdown = buildMarkdownReport(result);

    expect(findings).toHaveLength(4);
    expect(markdown).toContain("- Status: Blockiert");
    expect(markdown).toContain("- Bereit: 0");
    expect(markdown).toContain("- Unvollständig: 0");
    expect(markdown).toContain("- Blockiert: 1");
    expect(markdown).toContain("| DEMO-42 | Blockiert | 45% | 1 | 3 |");
    expect(markdown).toContain("· Blockiert ·");
    expect(markdown).toContain("· Unvollständig ·");
    expectNoRawReadinessStatusAtStatusPositions(markdown);
    expect(markdown).toContain("Expliziter JQL-Scope");
    expect(markdown).toContain("Korrekte Release-Version");
    expect(markdown).toContain("keine Jira-Version");
    for (const finding of findings) {
      expect(markdown).toContain(finding.evidence.title);
    }
  });

  it("lokalisiert Status in Zusammenfassung, Matrix und Findings", () => {
    const candidate = {
      ...release([
        issue(),
        issue({ key: "DEMO-43", hasAcceptanceCriteria: false }),
        issue({
          key: "DEMO-44",
          labels: ["release-blocker", "customer-approved"],
        }),
      ]),
      releaseScopeJql: "project = DEMO",
    };
    const result = readinessDto(
      candidate,
      projectConfig,
      "2026-08-05T09:00:00.000Z",
    );
    const markdown = buildMarkdownReport(result);

    expect(markdown).toContain("- Status: Blockiert");
    expect(markdown).toContain("- Bereit: 1");
    expect(markdown).toContain("- Unvollständig: 1");
    expect(markdown).toContain("- Blockiert: 1");
    expect(markdown).toContain("| DEMO-42 | Bereit | 100% | 0 | 0 |");
    expect(markdown).toContain("| DEMO-43 | Unvollständig | 90% | 0 | 1 |");
    expect(markdown).toContain("| DEMO-44 | Blockiert | 75% | 1 | 0 |");
    expect(markdown).toContain("· Unvollständig ·");
    expect(markdown).toContain("· Blockiert ·");
    expectNoRawReadinessStatusAtStatusPositions(markdown);

    const emptyMarkdown = buildMarkdownReport(
      readinessDto(
        { ...release([]), releaseScopeJql: "project = DEMO" },
        projectConfig,
        "2026-08-05T09:00:00.000Z",
      ),
    );
    expect(emptyMarkdown).toContain("- Status: Nicht anwendbar");
    expectNoRawReadinessStatusAtStatusPositions(emptyMarkdown);
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
