import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AppError, toSafeError } from "../../src/shared/errors";
import { formatDateTimeForLocale } from "../../src/frontend/utils/format";
import { buildJiraIssueUrl } from "../../src/frontend/utils/jira-url";
import {
  buildMarkdownReport,
  getOpenFindings,
} from "../../src/frontend/utils/report";
import type { TranslationFunction } from "../../src/frontend/i18n/context";
import { localizeEvidenceOutcome } from "../../src/frontend/i18n/evidence-presentation";
import type { I18nKey } from "../../src/frontend/i18n/keys";
import { issue, projectConfig, release } from "../fixtures/release";
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

const germanTranslation: TranslationFunction = (
  key: I18nKey,
  defaultValue?: string,
) => germanMessages[key] ?? defaultValue ?? key;

function buildGermanMarkdown(
  result: Parameters<typeof buildMarkdownReport>[0],
): string {
  return buildMarkdownReport(result, "de-DE", germanTranslation);
}

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
    expect(
      formatDateTimeForLocale("ungültig", "de-DE", germanTranslation),
    ).toBe("Zeitpunkt nicht verfügbar");
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
    const markdown = buildGermanMarkdown(result);

    expect(findings).toHaveLength(4);
    expect(markdown).toContain("- Status: Blockiert");
    expect(markdown).toContain("- Bereitschaftswert: 45%");
    expect(markdown).toContain("- Bereit: 0");
    expect(markdown).toContain("- Unvollständig: 0");
    expect(markdown).toContain("- Blockiert: 1");
    expect(markdown).toContain("- Umfangsmodus: Expliziter JQL-Umfang");
    expect(markdown).toContain("## Nachweismatrix");
    expect(markdown).toContain(
      "| Vorgang | Status | Bewertung | Blockierungen | Fehlende Nachweise |",
    );
    expect(markdown).not.toContain("Readiness-Score");
    expect(markdown).not.toContain("Evidence-Matrix");
    expect(markdown).not.toContain("Scope-Modus");
    expect(markdown).not.toContain("| Score |");
    expect(markdown).toContain("| DEMO-42 | Blockiert | 45% | 1 | 3 |");
    expect(markdown).toContain("· Blockiert ·");
    expect(markdown).toContain("· Unvollständig ·");
    expectNoRawReadinessStatusAtStatusPositions(markdown);
    expect(markdown).toContain("Expliziter JQL-Umfang");
    expect(markdown).toContain("Korrekte Release-Version");
    expect(markdown).toContain("keine Jira-Version");
    for (const finding of findings) {
      const localizedEvidence = localizeEvidenceOutcome(
        finding.evidence.outcome,
        "de-DE",
        germanTranslation,
      );
      expect(markdown).toContain(localizedEvidence.title);
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
    const markdown = buildGermanMarkdown(result);

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

    const emptyMarkdown = buildGermanMarkdown(
      readinessDto(
        { ...release([]), releaseScopeJql: "project = DEMO" },
        projectConfig,
        "2026-08-05T09:00:00.000Z",
      ),
    );
    expect(emptyMarkdown).toContain("- Status: Nicht anwendbar");
    expectNoRawReadinessStatusAtStatusPositions(emptyMarkdown);
  });

  it("redigiert interne Details bei überschrittenen Synchronlimits", () => {
    const safe = toSafeError(
      new AppError("RESULT_LIMIT_EXCEEDED", "Internal pagination detail"),
    );

    expect(safe).toEqual({
      code: "RESULT_LIMIT_EXCEEDED",
      message: "RESULT_LIMIT_EXCEEDED",
    });
    expect(safe.message).not.toContain("Internal pagination detail");
  });
});
