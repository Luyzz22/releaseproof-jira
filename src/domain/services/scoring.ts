import type { EvidenceItem, ReadinessStatus } from "../models/readiness";

export interface ScoringWeights {
  blockedDeduction: number;
  incompleteDeduction: number;
}

export const DEFAULT_SCORING_WEIGHTS: Readonly<ScoringWeights> = {
  blockedDeduction: 25,
  incompleteDeduction: 10,
};

export function statusFromEvidence(
  evidence: readonly EvidenceItem[],
): ReadinessStatus {
  if (evidence.some((item) => item.status === "BLOCKED")) return "BLOCKED";
  if (evidence.some((item) => item.status === "INCOMPLETE"))
    return "INCOMPLETE";
  return "READY";
}

export function calculateIssueScore(
  evidence: readonly EvidenceItem[],
  weights: Readonly<ScoringWeights> = DEFAULT_SCORING_WEIGHTS,
): number {
  const deduction = evidence.reduce((total, item) => {
    if (item.status === "BLOCKED") return total + weights.blockedDeduction;
    if (item.status === "INCOMPLETE")
      return total + weights.incompleteDeduction;
    return total;
  }, 0);
  return Math.max(0, 100 - deduction);
}
