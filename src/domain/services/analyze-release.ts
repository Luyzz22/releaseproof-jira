import type {
  IssueReadinessResult,
  ReadinessStatus,
  ReleaseCandidate,
  ReleaseReadinessResult,
} from "../models/readiness";
import { readinessRules } from "../rules";
import type { ReadinessRule } from "../rules/types";
import {
  calculateIssueScore,
  DEFAULT_SCORING_WEIGHTS,
  statusFromEvidence,
  type ScoringWeights,
} from "./scoring";

export function analyzeIssue(
  issue: ReleaseCandidate["issues"][number],
  release: ReleaseCandidate,
  config: Parameters<ReadinessRule["evaluate"]>[0]["config"],
  rules: readonly ReadinessRule[] = readinessRules,
  weights: Readonly<ScoringWeights> = DEFAULT_SCORING_WEIGHTS,
): IssueReadinessResult {
  const evidence = rules.map((rule) =>
    rule.evaluate({ issue, config, release }),
  );
  return {
    issueKey: issue.key,
    status: statusFromEvidence(evidence),
    score: calculateIssueScore(evidence, weights),
    evidence,
    blockerCount: evidence.filter((item) => item.status === "BLOCKED").length,
    missingEvidenceCount: evidence.filter(
      (item) => item.status === "INCOMPLETE",
    ).length,
  };
}

function releaseStatus(
  results: readonly IssueReadinessResult[],
): ReadinessStatus {
  if (results.length === 0) return "NOT_APPLICABLE";
  if (results.some((result) => result.status === "BLOCKED")) return "BLOCKED";
  if (results.some((result) => result.status === "INCOMPLETE"))
    return "INCOMPLETE";
  return "READY";
}

export function analyzeRelease(
  release: ReleaseCandidate,
  config: Parameters<ReadinessRule["evaluate"]>[0]["config"],
  generatedAt: string,
  rules: readonly ReadinessRule[] = readinessRules,
  weights: Readonly<ScoringWeights> = DEFAULT_SCORING_WEIGHTS,
): ReleaseReadinessResult {
  const results = release.issues.map((issue) =>
    analyzeIssue(issue, release, config, rules, weights),
  );
  const score =
    results.length === 0
      ? 0
      : Math.round(
          results.reduce((sum, result) => sum + result.score, 0) /
            results.length,
        );

  return {
    release,
    status: releaseStatus(results),
    score,
    totalIssues: results.length,
    readyIssues: results.filter((result) => result.status === "READY").length,
    incompleteIssues: results.filter((result) => result.status === "INCOMPLETE")
      .length,
    blockedIssues: results.filter((result) => result.status === "BLOCKED")
      .length,
    results,
    generatedAt,
  };
}
