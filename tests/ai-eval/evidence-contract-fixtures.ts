import {
  EVIDENCE_OUTCOME_IDS,
  EVIDENCE_RULE_IDS,
  type EvidenceOutcomeId,
  type EvidenceRuleId,
} from "../../src/domain/models/evidence-outcome";
import {
  EVIDENCE_CONTRACT_OUTCOME_RULES,
  EVIDENCE_CONTRACT_OUTCOME_STATUSES,
  EVIDENCE_CONTRACT_STATUS_COUNTS,
  parseEvidenceContractV1,
  type EvidenceContractReleaseV1,
  type SummaryEvidenceContractV1,
} from "../../src/shared/evidence-contract-v1";

const defaults = {
  "acceptance-criteria-present": "acceptance-criteria-present/present",
  "accepted-status": "accepted-status/accepted",
  "approval-marker-present": "approval-marker-present/present",
  "correct-fix-version": "correct-fix-version/assigned",
  "no-blocker-label": "no-blocker-label/clear",
  "no-blocking-links": "no-blocking-links/clear",
  "no-open-subtasks": "no-open-subtasks/clear",
} satisfies Record<EvidenceRuleId, EvidenceOutcomeId>;

// Authored synthetic transport facts, not a readiness engine or score calculator.
export function syntheticSummary(
  release: EvidenceContractReleaseV1,
  observed?: Readonly<{ outcomeId: EvidenceOutcomeId; count: number }>,
): SummaryEvidenceContractV1 {
  const contract = parseEvidenceContractV1({
    schemaVersion: 1,
    contract: "releaseproof-evidence",
    profile: "SUMMARY_MINIMIZED",
    dataBoundary: "MINIMIZED",
    authority: { humanReviewRequired: true, releaseAuthorization: "NONE" },
    release,
    rules: EVIDENCE_RULE_IDS.map((ruleId) => {
      const replacement =
        observed &&
        EVIDENCE_CONTRACT_OUTCOME_RULES[observed.outcomeId] === ruleId
          ? observed
          : undefined;
      const statuses = {
        ready: 0,
        incomplete: 0,
        blocked: 0,
        notApplicable: 0,
      };
      const outcomes = EVIDENCE_OUTCOME_IDS.filter(
        (id) => EVIDENCE_CONTRACT_OUTCOME_RULES[id] === ruleId,
      ).map((outcomeId) => {
        const count =
          replacement?.outcomeId === outcomeId
            ? replacement.count
            : outcomeId === defaults[ruleId]
              ? release.totalIssues - (replacement?.count ?? 0)
              : 0;
        statuses[
          EVIDENCE_CONTRACT_STATUS_COUNTS[
            EVIDENCE_CONTRACT_OUTCOME_STATUSES[outcomeId]
          ]
        ] += count;
        return { outcomeId, count };
      });
      return { ruleId, ...statuses, outcomes };
    }),
  });
  if (contract.profile !== "SUMMARY_MINIMIZED")
    throw new Error("Invalid synthetic summary profile");
  return contract;
}

export function findingSummary(
  outcomeId: EvidenceOutcomeId,
): SummaryEvidenceContractV1 {
  const status = EVIDENCE_CONTRACT_OUTCOME_STATUSES[outcomeId];
  return syntheticSummary(
    {
      releaseScopeMode:
        outcomeId === "correct-fix-version/version-only"
          ? "VERSION_ONLY"
          : "JQL_SCOPE",
      status: status === "NOT_APPLICABLE" ? "READY" : status,
      score: 82,
      totalIssues: 1,
      readyIssues: status === "READY" || status === "NOT_APPLICABLE" ? 1 : 0,
      incompleteIssues: status === "INCOMPLETE" ? 1 : 0,
      blockedIssues: status === "BLOCKED" ? 1 : 0,
    },
    { outcomeId, count: 1 },
  );
}
