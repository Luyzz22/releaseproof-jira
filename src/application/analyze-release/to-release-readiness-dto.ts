import type { ReleaseReadinessResult } from "../../domain/models/readiness";
import type { ReleaseReadinessResultDto } from "../../shared/release-readiness-dto";

export function toReleaseReadinessDto(
  result: ReleaseReadinessResult,
): ReleaseReadinessResultDto {
  const release = {
    projectKey: result.release.projectKey,
    versionName: result.release.versionName,
    releaseScopeMode: result.release.releaseScopeMode,
    issues: result.release.issues.map((issue) => ({
      key: issue.key,
      summary: issue.summary,
      issueTypeName: issue.issueType.name,
      statusName: issue.status?.name ?? null,
      updatedAt: issue.updatedAt,
    })),
    ...(result.release.releaseScopeJql !== undefined
      ? { releaseScopeJql: result.release.releaseScopeJql }
      : {}),
  };

  return {
    release,
    status: result.status,
    score: result.score,
    totalIssues: result.totalIssues,
    readyIssues: result.readyIssues,
    incompleteIssues: result.incompleteIssues,
    blockedIssues: result.blockedIssues,
    results: result.results.map((issueResult) => ({
      issueKey: issueResult.issueKey,
      status: issueResult.status,
      score: issueResult.score,
      evidence: issueResult.evidence.map((evidence) => ({
        ruleId: evidence.ruleId,
        issueKey: evidence.issueKey,
        category: evidence.category,
        status: evidence.status,
        title: evidence.title,
        explanation: evidence.explanation,
        remediation: evidence.remediation,
        sourceField: evidence.sourceField,
      })),
      blockerCount: issueResult.blockerCount,
      missingEvidenceCount: issueResult.missingEvidenceCount,
    })),
    generatedAt: result.generatedAt,
  };
}
