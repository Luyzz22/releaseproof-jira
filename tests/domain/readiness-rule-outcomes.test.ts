import { describe, expect, it } from "vitest";
import {
  acceptanceCriteriaPresentRule,
  acceptedStatusRule,
  approvalMarkerPresentRule,
  correctFixVersionRule,
  noBlockerLabelRule,
  noBlockingLinksRule,
  noOpenSubtasksRule,
} from "../../src/domain/rules";
import { config, issue, release } from "../fixtures/release";

function context(
  issueOverrides: Parameters<typeof issue>[0] = {},
  configOverrides: Parameters<typeof config>[0] = {},
) {
  const candidate = release([issue(issueOverrides)]);

  return {
    issue: candidate.issues[0]!,
    release: candidate,
    config: config(configOverrides),
  };
}

describe("semantic readiness rule outcomes", () => {
  it("covers acceptance criteria outcomes", () => {
    expect(
      acceptanceCriteriaPresentRule.evaluate(
        context({ hasAcceptanceCriteria: true }),
      ).outcome,
    ).toEqual({
      outcomeId: "acceptance-criteria-present/present",
      params: {},
    });

    expect(
      acceptanceCriteriaPresentRule.evaluate(
        context({ hasAcceptanceCriteria: false }),
      ).outcome,
    ).toEqual({
      outcomeId: "acceptance-criteria-present/missing",
      params: {},
    });
  });

  it("covers accepted status outcomes", () => {
    expect(acceptedStatusRule.evaluate(context()).outcome).toEqual({
      outcomeId: "accepted-status/accepted",
      params: { statusName: "Fertig" },
    });

    expect(
      acceptedStatusRule.evaluate(
        context({ status: { id: "3", name: "In Arbeit" } }),
      ).outcome,
    ).toEqual({
      outcomeId: "accepted-status/not-accepted",
      params: { statusName: "In Arbeit" },
    });

    expect(
      acceptedStatusRule.evaluate(context({ status: null })).outcome,
    ).toEqual({
      outcomeId: "accepted-status/missing",
      params: {},
    });
  });

  it("covers approval marker outcomes", () => {
    expect(
      approvalMarkerPresentRule.evaluate(
        context({}, { requireApprovalMarker: false }),
      ).outcome,
    ).toEqual({
      outcomeId: "approval-marker-present/disabled",
      params: {},
    });

    expect(approvalMarkerPresentRule.evaluate(context()).outcome).toEqual({
      outcomeId: "approval-marker-present/present",
      params: { approvalMarker: "customer-approved" },
    });

    expect(
      approvalMarkerPresentRule.evaluate(context({ labels: [] })).outcome,
    ).toEqual({
      outcomeId: "approval-marker-present/missing",
      params: { approvalMarker: "customer-approved" },
    });
  });

  it("covers fix version outcomes with raw Jira facts", () => {
    expect(
      correctFixVersionRule.evaluate(
        context({ fixVersions: [] }, { releaseScopeMode: "VERSION_ONLY" }),
      ).outcome,
    ).toEqual({
      outcomeId: "correct-fix-version/version-only",
      params: {},
    });

    expect(correctFixVersionRule.evaluate(context()).outcome).toEqual({
      outcomeId: "correct-fix-version/assigned",
      params: { versionName: "Kundenrelease 2.4" },
    });

    expect(
      correctFixVersionRule.evaluate(
        context({
          fixVersions: [
            { id: "39998", name: "Release 2.2" },
            { id: "39999", name: "Release 2.3" },
          ],
        }),
      ).outcome,
    ).toEqual({
      outcomeId: "correct-fix-version/wrong-version",
      params: {
        assignedVersionNames: ["Release 2.2", "Release 2.3"],
        expectedVersionName: "Kundenrelease 2.4",
      },
    });

    expect(
      correctFixVersionRule.evaluate(context({ fixVersions: [] })).outcome,
    ).toEqual({
      outcomeId: "correct-fix-version/missing-version",
      params: {
        expectedVersionName: "Kundenrelease 2.4",
      },
    });
  });

  it("covers blocker label outcomes without exposing a raw labels key", () => {
    expect(noBlockerLabelRule.evaluate(context()).outcome).toEqual({
      outcomeId: "no-blocker-label/clear",
      params: {},
    });

    expect(
      noBlockerLabelRule.evaluate(context({ labels: ["Release-Blocker"] }))
        .outcome,
    ).toEqual({
      outcomeId: "no-blocker-label/blocked",
      params: {
        blockerLabels: ["Release-Blocker"],
      },
    });
  });

  it("covers blocking link outcomes", () => {
    expect(noBlockingLinksRule.evaluate(context()).outcome).toEqual({
      outcomeId: "no-blocking-links/clear",
      params: {},
    });

    expect(
      noBlockingLinksRule.evaluate(
        context({
          linkedIssues: [
            {
              id: "22001",
              key: "DEMO-7",
              relationship: "is blocked by",
              direction: "inward",
              isBlocking: true,
              status: { id: "3", name: "In Arbeit" },
              resolution: null,
            },
          ],
        }),
      ).outcome,
    ).toEqual({
      outcomeId: "no-blocking-links/blocked",
      params: {
        issueKeys: ["DEMO-7"],
      },
    });
  });

  it("covers open subtask outcomes", () => {
    expect(
      noOpenSubtasksRule.evaluate(context({}, { blockOnOpenSubtasks: false }))
        .outcome,
    ).toEqual({
      outcomeId: "no-open-subtasks/disabled",
      params: {},
    });

    expect(noOpenSubtasksRule.evaluate(context()).outcome).toEqual({
      outcomeId: "no-open-subtasks/clear",
      params: {},
    });

    expect(
      noOpenSubtasksRule.evaluate(
        context({
          subtasks: [
            {
              id: "21001",
              key: "DEMO-43",
              status: { id: "3", name: "In Arbeit" },
              resolution: null,
            },
            {
              id: "21002",
              key: "DEMO-44",
              status: null,
              resolution: null,
            },
          ],
        }),
      ).outcome,
    ).toEqual({
      outcomeId: "no-open-subtasks/blocked",
      params: {
        count: 2,
        issueKeys: ["DEMO-43", "DEMO-44"],
      },
    });
  });
});
