import {
  aggregateEvidenceFindingsV1,
  compareEvidenceFindingsV1,
  EvidenceContractV1Error,
  parseEvidenceContractV1,
  type EvidenceContractV1,
  type SummaryEvidenceContractV1,
  type TraceableEvidenceContractV1,
} from "../../shared/evidence-contract-v1";
import type { ReleaseReadinessResultDto } from "../../shared/release-readiness-dto";

export function buildEvidenceContractV1(
  source: ReleaseReadinessResultDto,
  profile: "SUMMARY_MINIMIZED",
): SummaryEvidenceContractV1;
export function buildEvidenceContractV1(
  source: ReleaseReadinessResultDto,
  profile: "TRACEABLE_INTERNAL",
): TraceableEvidenceContractV1;
export function buildEvidenceContractV1(
  source: ReleaseReadinessResultDto,
  profile: EvidenceContractV1["profile"],
): EvidenceContractV1;

/** R&D only. Input is the application-owned DTO; untrusted contracts use the parser. */
export function buildEvidenceContractV1(
  source: ReleaseReadinessResultDto,
  profile: EvidenceContractV1["profile"],
): EvidenceContractV1 {
  if (profile !== "SUMMARY_MINIMIZED" && profile !== "TRACEABLE_INTERNAL") {
    throw new EvidenceContractV1Error();
  }
  const issues = source.results
    .map((issue) => ({
      issueKey: issue.issueKey,
      status: issue.status,
      score: issue.score,
      blockerCount: issue.blockerCount,
      missingEvidenceCount: issue.missingEvidenceCount,
      findings: issue.evidence
        .map((finding) => ({
          ruleId: finding.ruleId,
          category: finding.category,
          status: finding.status,
          outcomeId: finding.outcome.outcomeId,
        }))
        .sort(compareEvidenceFindingsV1),
    }))
    .sort((left, right) =>
      left.issueKey < right.issueKey
        ? -1
        : left.issueKey > right.issueKey
          ? 1
          : 0,
    );

  // Validate the complete trace before minimization so invalid findings cannot
  // disappear into a summary. No source object/array is sorted or frozen.
  const trace = parseEvidenceContractV1({
    schemaVersion: 1,
    contract: "releaseproof-evidence",
    profile: "TRACEABLE_INTERNAL",
    dataBoundary: "INTERNAL_ONLY",
    authority: { humanReviewRequired: true, releaseAuthorization: "NONE" },
    release: {
      releaseScopeMode: source.release.releaseScopeMode,
      status: source.status,
      score: source.score,
      totalIssues: source.totalIssues,
      readyIssues: source.readyIssues,
      incompleteIssues: source.incompleteIssues,
      blockedIssues: source.blockedIssues,
    },
    rules: aggregateEvidenceFindingsV1(
      issues.flatMap((issue) => issue.findings),
    ),
    issues,
  });
  if (profile === "TRACEABLE_INTERNAL") return trace;
  return parseEvidenceContractV1({
    schemaVersion: 1,
    contract: "releaseproof-evidence",
    profile,
    dataBoundary: "MINIMIZED",
    authority: { humanReviewRequired: true, releaseAuthorization: "NONE" },
    release: trace.release,
    rules: trace.rules,
  });
}
