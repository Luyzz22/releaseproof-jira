import {
  evidenceOutcome,
  type EvidenceOutcome,
} from "../../domain/models/evidence-outcome";
import type { ReleaseReadinessResult } from "../../domain/models/readiness";
import type { ReleaseReadinessResultDto } from "../../shared/release-readiness-dto";

function copyEvidenceOutcome(outcome: EvidenceOutcome): EvidenceOutcome {
  switch (outcome.outcomeId) {
    case "acceptance-criteria-present/present":
      return evidenceOutcome("acceptance-criteria-present/present", {});
    case "acceptance-criteria-present/missing":
      return evidenceOutcome("acceptance-criteria-present/missing", {});

    case "accepted-status/accepted":
      return evidenceOutcome("accepted-status/accepted", {
        statusName: outcome.params.statusName,
      });
    case "accepted-status/not-accepted":
      return evidenceOutcome("accepted-status/not-accepted", {
        statusName: outcome.params.statusName,
      });
    case "accepted-status/missing":
      return evidenceOutcome("accepted-status/missing", {});

    case "approval-marker-present/disabled":
      return evidenceOutcome("approval-marker-present/disabled", {});
    case "approval-marker-present/present":
      return evidenceOutcome("approval-marker-present/present", {
        approvalMarker: outcome.params.approvalMarker,
      });
    case "approval-marker-present/missing":
      return evidenceOutcome("approval-marker-present/missing", {
        approvalMarker: outcome.params.approvalMarker,
      });

    case "correct-fix-version/version-only":
      return evidenceOutcome("correct-fix-version/version-only", {});
    case "correct-fix-version/assigned":
      return evidenceOutcome("correct-fix-version/assigned", {
        versionName: outcome.params.versionName,
      });
    case "correct-fix-version/wrong-version":
      return evidenceOutcome("correct-fix-version/wrong-version", {
        assignedVersionNames: [...outcome.params.assignedVersionNames],
        expectedVersionName: outcome.params.expectedVersionName,
      });
    case "correct-fix-version/missing-version":
      return evidenceOutcome("correct-fix-version/missing-version", {
        expectedVersionName: outcome.params.expectedVersionName,
      });

    case "no-blocker-label/clear":
      return evidenceOutcome("no-blocker-label/clear", {});
    case "no-blocker-label/blocked":
      return evidenceOutcome("no-blocker-label/blocked", {
        blockerLabels: [...outcome.params.blockerLabels],
      });

    case "no-blocking-links/clear":
      return evidenceOutcome("no-blocking-links/clear", {});
    case "no-blocking-links/blocked":
      return evidenceOutcome("no-blocking-links/blocked", {
        issueKeys: [...outcome.params.issueKeys],
      });

    case "no-open-subtasks/disabled":
      return evidenceOutcome("no-open-subtasks/disabled", {});
    case "no-open-subtasks/clear":
      return evidenceOutcome("no-open-subtasks/clear", {});
    case "no-open-subtasks/blocked":
      return evidenceOutcome("no-open-subtasks/blocked", {
        count: outcome.params.count,
        issueKeys: [...outcome.params.issueKeys],
      });

    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}

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
        outcome: copyEvidenceOutcome(evidence.outcome),
        sourceField: evidence.sourceField,
      })),
      blockerCount: issueResult.blockerCount,
      missingEvidenceCount: issueResult.missingEvidenceCount,
    })),
    generatedAt: result.generatedAt,
  };
}
