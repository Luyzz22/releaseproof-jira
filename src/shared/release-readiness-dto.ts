import type { EvidenceOutcome } from "../domain/models/evidence-outcome";
import type {
  EvidenceCategory,
  ReadinessStatus,
  ReleaseScopeMode,
} from "../domain/models/readiness";

export interface ReleaseIssueSummaryDto {
  key: string;
  summary: string;
  issueTypeName: string;
  statusName: string | null;
  updatedAt: string;
}

export interface ReleaseSummaryDto {
  projectKey: string;
  versionName: string;
  releaseScopeMode: ReleaseScopeMode;
  releaseScopeJql?: string;
  issues: ReleaseIssueSummaryDto[];
}

export interface EvidenceItemDto {
  ruleId: string;
  issueKey: string;
  category: EvidenceCategory;
  status: ReadinessStatus;
  outcome: EvidenceOutcome;
  sourceField: string;
}

export interface IssueReadinessResultDto {
  issueKey: string;
  status: ReadinessStatus;
  score: number;
  evidence: EvidenceItemDto[];
  blockerCount: number;
  missingEvidenceCount: number;
}

export interface ReleaseReadinessResultDto {
  release: ReleaseSummaryDto;
  status: ReadinessStatus;
  score: number;
  totalIssues: number;
  readyIssues: number;
  incompleteIssues: number;
  blockedIssues: number;
  results: IssueReadinessResultDto[];
  generatedAt: string;
}
