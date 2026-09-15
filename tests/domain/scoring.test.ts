import { describe, expect, it } from "vitest";
import { evidenceOutcome } from "../../src/domain/models/evidence-outcome";
import type { EvidenceItem } from "../../src/domain/models/readiness";
import {
  calculateIssueScore,
  statusFromEvidence,
} from "../../src/domain/services/scoring";

function evidence(status: EvidenceItem["status"]): EvidenceItem {
  switch (status) {
    case "READY":
      return {
        ruleId: "acceptance-criteria-present",
        issueKey: "DEMO-1",
        category: "DOCUMENTATION",
        status,
        outcome: evidenceOutcome("acceptance-criteria-present/present", {}),
        sourceField: "test",
      };

    case "INCOMPLETE":
      return {
        ruleId: "acceptance-criteria-present",
        issueKey: "DEMO-1",
        category: "DOCUMENTATION",
        status,
        outcome: evidenceOutcome("acceptance-criteria-present/missing", {}),
        sourceField: "test",
      };

    case "BLOCKED":
      return {
        ruleId: "no-blocker-label",
        issueKey: "DEMO-1",
        category: "BLOCKER",
        status,
        outcome: evidenceOutcome("no-blocker-label/blocked", {
          blockerLabels: ["test-blocker"],
        }),
        sourceField: "test",
      };

    case "NOT_APPLICABLE":
      return {
        ruleId: "no-open-subtasks",
        issueKey: "DEMO-1",
        category: "DEPENDENCY",
        status,
        outcome: evidenceOutcome("no-open-subtasks/disabled", {}),
        sourceField: "test",
      };

    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

describe("Score-Berechnung", () => {
  it("zieht 25 für Blocker und 10 für unvollständige Evidence ab", () => {
    expect(
      calculateIssueScore([evidence("BLOCKED"), evidence("INCOMPLETE")]),
    ).toBe(65);
  });

  it("fällt nie unter null und unterstützt spätere Gewichte", () => {
    expect(
      calculateIssueScore(
        Array.from({ length: 10 }, () => evidence("BLOCKED")),
      ),
    ).toBe(0);
    expect(
      calculateIssueScore([evidence("BLOCKED")], {
        blockedDeduction: 40,
        incompleteDeduction: 5,
      }),
    ).toBe(60);
  });

  it("priorisiert BLOCKED vor INCOMPLETE", () => {
    expect(
      statusFromEvidence([evidence("INCOMPLETE"), evidence("BLOCKED")]),
    ).toBe("BLOCKED");
    expect(
      statusFromEvidence([evidence("READY"), evidence("NOT_APPLICABLE")]),
    ).toBe("READY");
  });
});
