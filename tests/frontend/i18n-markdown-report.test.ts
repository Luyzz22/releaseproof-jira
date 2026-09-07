import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { TranslationFunction } from "../../src/frontend/i18n/context";
import type { I18nKey } from "../../src/frontend/i18n/keys";
import type { SupportedLocale } from "../../src/frontend/i18n/locale";
import { buildMarkdownReport } from "../../src/frontend/utils/report";
import { config, issue, projectConfig, release } from "../fixtures/release";
import { readinessDto } from "../fixtures/readiness-dto";

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

function translator(locale: SupportedLocale): TranslationFunction {
  const messages = flatten(
    JSON.parse(
      readFileSync(resolve(process.cwd(), `locales/${locale}.json`), "utf8"),
    ) as unknown,
  );

  return (key: I18nKey, defaultValue?: string) =>
    messages[key] ?? defaultValue ?? key;
}

describe("locale-aware Markdown report", () => {
  it("renders the complete Markdown boundary in en-US", () => {
    const result = readinessDto(
      release([
        issue({
          hasAcceptanceCriteria: false,
          labels: ["release-blocker"],
          fixVersions: [],
        }),
      ]),
      projectConfig,
      "2026-07-11T09:00:00.000Z",
    );

    const markdown = buildMarkdownReport(result, "en-US", translator("en-US"));

    expect(markdown).toContain("- Status: Blocked");
    expect(markdown).toContain("- Readiness score: 45%");
    expect(markdown).toContain("- Ready: 0");
    expect(markdown).toContain("- Incomplete: 0");
    expect(markdown).toContain("- Blocked: 1");
    expect(markdown).toContain("- Scope mode: Explicit JQL scope");
    expect(markdown).toContain("## Evidence matrix");
    expect(markdown).toContain(
      "| Issue | Status | Score | Blockers | Missing evidence |",
    );
    expect(markdown).toContain("| DEMO-42 | Blocked | 45% | 1 | 3 |");
    expect(markdown).toContain("## Open findings");
    expect(markdown).toContain("Acceptance criteria present");
    expect(markdown).toContain(
      "No usable acceptance criteria were found in the configured field.",
    );
    expect(markdown).toContain("Correct release version");
    expect(markdown).toContain(
      "No Jira version is assigned to the issue; “Kundenrelease 2.4” is expected.",
    );
    expect(markdown).toContain("Remediation:");
    expect(markdown).toContain("_Generated at ");

    expect(markdown).not.toContain("Bereitschaftswert");
    expect(markdown).not.toContain("Nachweismatrix");
    expect(markdown).not.toContain("Offene Punkte");
    expect(markdown).not.toContain("Akzeptanzkriterien vorhanden");
    expect(markdown).not.toContain("Behebung:");
    expect(markdown).not.toContain("_Erzeugt am ");
    expect(markdown).not.toContain("evidence.");
    expect(markdown).not.toContain("report.markdown.");
    expect(markdown).not.toContain("releaseScope.");
  });

  it("preserves the established Markdown wording in de-DE", () => {
    const result = readinessDto(
      release([
        issue({
          hasAcceptanceCriteria: false,
          labels: ["release-blocker"],
          fixVersions: [],
        }),
      ]),
      projectConfig,
      "2026-07-11T09:00:00.000Z",
    );

    const markdown = buildMarkdownReport(result, "de-DE", translator("de-DE"));

    expect(markdown).toContain("- Status: Blockiert");
    expect(markdown).toContain("- Bereitschaftswert: 45%");
    expect(markdown).toContain("- Umfangsmodus: Expliziter JQL-Umfang");
    expect(markdown).toContain("## Nachweismatrix");
    expect(markdown).toContain("## Offene Punkte");
    expect(markdown).toContain("Akzeptanzkriterien vorhanden");
    expect(markdown).toContain(
      "Im konfigurierten Feld wurden keine verwertbaren Akzeptanzkriterien gefunden.",
    );
    expect(markdown).toContain("Behebung:");
    expect(markdown).toContain("_Erzeugt am ");
  });

  it("localizes VERSION_ONLY scope and NOT_APPLICABLE status", () => {
    const candidate = {
      ...release([]),
      releaseScopeMode: "VERSION_ONLY" as const,
    };
    delete candidate.releaseScopeJql;

    const result = readinessDto(
      candidate,
      config({ releaseScopeMode: "VERSION_ONLY" }),
      "2026-08-05T09:00:00.000Z",
    );

    const markdown = buildMarkdownReport(result, "en-US", translator("en-US"));

    expect(markdown).toContain("- Status: Not applicable");
    expect(markdown).toContain("- Scope mode: Jira version only");
    expect(markdown).toContain(
      "fixVersion of the selected version in project DEMO",
    );
    expect(markdown).toContain("No blocking or missing evidence was found.");
  });
});
