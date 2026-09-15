import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EVIDENCE_OUTCOME_IDS,
  evidenceOutcome,
  type EvidenceOutcome,
} from "../../src/domain/models/evidence-outcome";
import { localizeEvidenceOutcome } from "../../src/frontend/i18n/evidence-presentation";
import type { TranslationFunction } from "../../src/frontend/i18n/context";
import type { I18nKey } from "../../src/frontend/i18n/keys";
import type { SupportedLocale } from "../../src/frontend/i18n/locale";

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
  const raw = JSON.parse(
    readFileSync(resolve(process.cwd(), `locales/${locale}.json`), "utf8"),
  ) as unknown;

  const messages = flatten(raw);

  return (key: I18nKey, defaultValue?: string) =>
    messages[key] ?? defaultValue ?? key;
}

const examples = [
  evidenceOutcome("acceptance-criteria-present/present", {}),
  evidenceOutcome("acceptance-criteria-present/missing", {}),

  evidenceOutcome("accepted-status/accepted", {
    statusName: "Ready for acceptance",
  }),
  evidenceOutcome("accepted-status/not-accepted", {
    statusName: "In Progress",
  }),
  evidenceOutcome("accepted-status/missing", {}),

  evidenceOutcome("approval-marker-present/disabled", {}),
  evidenceOutcome("approval-marker-present/present", {
    approvalMarker: "customer-approved",
  }),
  evidenceOutcome("approval-marker-present/missing", {
    approvalMarker: "customer-approved",
  }),

  evidenceOutcome("correct-fix-version/version-only", {}),
  evidenceOutcome("correct-fix-version/assigned", {
    versionName: "Release 2.4",
  }),
  evidenceOutcome("correct-fix-version/wrong-version", {
    assignedVersionNames: ["Release 2.2", "Release 2.3"],
    expectedVersionName: "Release 2.4",
  }),
  evidenceOutcome("correct-fix-version/missing-version", {
    expectedVersionName: "Release 2.4",
  }),

  evidenceOutcome("no-blocker-label/clear", {}),
  evidenceOutcome("no-blocker-label/blocked", {
    blockerLabels: ["release-blocker", "security-blocker"],
  }),

  evidenceOutcome("no-blocking-links/clear", {}),
  evidenceOutcome("no-blocking-links/blocked", {
    issueKeys: ["DEMO-7", "DEMO-8"],
  }),

  evidenceOutcome("no-open-subtasks/disabled", {}),
  evidenceOutcome("no-open-subtasks/clear", {}),
  evidenceOutcome("no-open-subtasks/blocked", {
    count: 2,
    issueKeys: ["DEMO-43", "DEMO-44"],
  }),
] satisfies readonly EvidenceOutcome[];

describe("locale-aware evidence presentation", () => {
  it("has one presentation fixture for every semantic outcome", () => {
    expect(examples.map((item) => item.outcomeId).sort()).toEqual(
      [...EVIDENCE_OUTCOME_IDS].sort(),
    );
  });

  it.each(["en-US", "de-DE"] as const)(
    "resolves every outcome for %s without leaking keys or placeholders",
    (locale) => {
      const t = translator(locale);

      for (const outcome of examples) {
        const text = localizeEvidenceOutcome(outcome, locale, t);

        expect(text.title).not.toMatch(/^evidence\./);
        expect(text.explanation).not.toMatch(/^evidence\./);
        expect(text.remediation).not.toMatch(/^evidence\./);

        expect(text.title).not.toMatch(/\{[A-Za-z]/);
        expect(text.explanation).not.toMatch(/\{[A-Za-z]/);
        expect(text.remediation).not.toMatch(/\{[A-Za-z]/);

        expect(text.title.length).toBeGreaterThan(0);
        expect(text.explanation.length).toBeGreaterThan(0);
        expect(text.remediation.length).toBeGreaterThan(0);
      }
    },
  );

  it("renders dynamic Jira facts in en-US", () => {
    const t = translator("en-US");

    expect(
      localizeEvidenceOutcome(
        evidenceOutcome("correct-fix-version/wrong-version", {
          assignedVersionNames: ["Release 2.2", "Release 2.3"],
          expectedVersionName: "Release 2.4",
        }),
        "en-US",
        t,
      ),
    ).toEqual({
      title: "Correct release version",
      explanation:
        "The issue is assigned to “Release 2.2”, “Release 2.3” instead of the expected version “Release 2.4”.",
      remediation:
        "Assign the analyzed version in the Jira “Fix Version/s” field.",
    });

    expect(
      localizeEvidenceOutcome(
        evidenceOutcome("no-open-subtasks/blocked", {
          count: 2,
          issueKeys: ["DEMO-43", "DEMO-44"],
        }),
        "en-US",
        t,
      ).explanation,
    ).toBe("2 open subtask(s): DEMO-43, DEMO-44.");
  });

  it("preserves the current German evidence wording where applicable", () => {
    const t = translator("de-DE");

    expect(
      localizeEvidenceOutcome(
        evidenceOutcome("accepted-status/accepted", {
          statusName: "Fertig",
        }),
        "de-DE",
        t,
      ),
    ).toEqual({
      title: "Abschlussstatus erreicht",
      explanation: "Der Status „Fertig“ ist als abgeschlossen konfiguriert.",
      remediation: "Keine Maßnahme erforderlich.",
    });

    expect(
      localizeEvidenceOutcome(
        evidenceOutcome("no-blocker-label/blocked", {
          blockerLabels: ["release-blocker"],
        }),
        "de-DE",
        t,
      ),
    ).toEqual({
      title: "Kein Blocker-Label",
      explanation: "Blockierendes Label vorhanden: release-blocker.",
      remediation:
        "Blocker fachlich auflösen und das Label anschließend entfernen.",
    });
  });
});
