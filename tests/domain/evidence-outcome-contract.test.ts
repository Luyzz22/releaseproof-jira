import { describe, expect, it } from "vitest";
import {
  EVIDENCE_OUTCOME_IDS,
  EVIDENCE_RULE_IDS,
  evidenceOutcome,
  type EvidenceOutcome,
} from "../../src/domain/models/evidence-outcome";

const examples = [
  {
    outcomeId: "acceptance-criteria-present/present",
    params: {},
  },
  {
    outcomeId: "acceptance-criteria-present/missing",
    params: {},
  },

  {
    outcomeId: "accepted-status/accepted",
    params: { statusName: "Done" },
  },
  {
    outcomeId: "accepted-status/not-accepted",
    params: { statusName: "In Progress" },
  },
  {
    outcomeId: "accepted-status/missing",
    params: {},
  },

  {
    outcomeId: "approval-marker-present/disabled",
    params: {},
  },
  {
    outcomeId: "approval-marker-present/present",
    params: { approvalMarker: "customer-approved" },
  },
  {
    outcomeId: "approval-marker-present/missing",
    params: { approvalMarker: "customer-approved" },
  },

  {
    outcomeId: "correct-fix-version/version-only",
    params: {},
  },
  {
    outcomeId: "correct-fix-version/assigned",
    params: { versionName: "Release 2.4" },
  },
  {
    outcomeId: "correct-fix-version/wrong-version",
    params: {
      assignedVersionNames: ["Release 2.3"],
      expectedVersionName: "Release 2.4",
    },
  },
  {
    outcomeId: "correct-fix-version/missing-version",
    params: { expectedVersionName: "Release 2.4" },
  },

  {
    outcomeId: "no-blocker-label/clear",
    params: {},
  },
  {
    outcomeId: "no-blocker-label/blocked",
    params: { blockerLabels: ["release-blocker"] },
  },

  {
    outcomeId: "no-blocking-links/clear",
    params: {},
  },
  {
    outcomeId: "no-blocking-links/blocked",
    params: { issueKeys: ["DEMO-7"] },
  },

  {
    outcomeId: "no-open-subtasks/disabled",
    params: {},
  },
  {
    outcomeId: "no-open-subtasks/clear",
    params: {},
  },
  {
    outcomeId: "no-open-subtasks/blocked",
    params: {
      count: 2,
      issueKeys: ["DEMO-43", "DEMO-44"],
    },
  },
] satisfies readonly EvidenceOutcome[];

const forbiddenPublicParamKeys = new Set([
  "id",
  "projectId",
  "versionId",
  "analyzedAt",
  "description",
  "acceptanceCriteria",
  "hasAcceptanceCriteria",
  "labels",
  "fixVersions",
  "subtasks",
  "linkedIssues",
  "resolution",
  "issueType",
]);

describe("language-neutral evidence outcome contract", () => {
  it("keeps every semantic outcome ID unique", () => {
    expect(new Set(EVIDENCE_OUTCOME_IDS).size).toBe(
      EVIDENCE_OUTCOME_IDS.length,
    );
  });

  it("defines one valid descriptor example for every outcome ID", () => {
    expect(examples.map((item) => item.outcomeId).sort()).toEqual(
      [...EVIDENCE_OUTCOME_IDS].sort(),
    );
  });

  it("covers exactly the seven existing readiness rule families", () => {
    const ruleIds = new Set(
      EVIDENCE_OUTCOME_IDS.map((outcomeId) => outcomeId.split("/")[0]),
    );

    expect([...ruleIds].sort()).toEqual([...EVIDENCE_RULE_IDS].sort());
  });

  it("does not reuse forbidden internal DTO keys as outcome params", () => {
    for (const example of examples) {
      for (const key of Object.keys(example.params)) {
        expect(
          forbiddenPublicParamKeys.has(key),
          `forbidden outcome param key: ${key}`,
        ).toBe(false);
      }
    }
  });

  it("keeps dynamic Jira facts separate from localized prose", () => {
    expect(
      evidenceOutcome("accepted-status/accepted", {
        statusName: "Abnahmebereit",
      }),
    ).toEqual({
      outcomeId: "accepted-status/accepted",
      params: {
        statusName: "Abnahmebereit",
      },
    });

    expect(
      evidenceOutcome("no-open-subtasks/blocked", {
        count: 2,
        issueKeys: ["DEMO-43", "DEMO-44"],
      }),
    ).toEqual({
      outcomeId: "no-open-subtasks/blocked",
      params: {
        count: 2,
        issueKeys: ["DEMO-43", "DEMO-44"],
      },
    });
  });
});
