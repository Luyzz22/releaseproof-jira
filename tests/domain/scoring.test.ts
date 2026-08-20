import { describe, expect, it } from "vitest";
import type { EvidenceItem } from "../../src/domain/models/readiness";
import {
  calculateIssueScore,
  statusFromEvidence,
} from "../../src/domain/services/scoring";

function evidence(status: EvidenceItem["status"]): EvidenceItem {
  return {
    ruleId: "test",
    issueKey: "DEMO-1",
    category: "DOCUMENTATION",
    status,
    title: "Test",
    explanation: "Synthetischer Test.",
    remediation: "Keine.",
    sourceField: "test",
  };
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
