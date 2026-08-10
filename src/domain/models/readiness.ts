export const READINESS_STATUSES = [
  "READY",
  "INCOMPLETE",
  "BLOCKED",
  "NOT_APPLICABLE",
] as const;

export type ReadinessStatus = (typeof READINESS_STATUSES)[number];

export const RELEASE_SCOPE_MODES = ["VERSION_ONLY", "JQL_SCOPE"] as const;

export type ReleaseScopeMode = (typeof RELEASE_SCOPE_MODES)[number];

export interface ProjectConfig {
  projectId: string;
  projectKey: string;
  releaseScopeMode: ReleaseScopeMode;
  releaseScopeJql?: string;
  acceptedStatusIds: string[];
  acceptanceCriteriaFieldId: string;
  blockerLabels: string[];
  includedIssueTypes: string[];
  requireApprovalMarker: boolean;
  approvalMarker: string;
  blockOnOpenSubtasks: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IssueTypeRef {
  id: string;
  name: string;
}

export interface StatusRef {
  id: string;
  name: string;
}

export interface VersionRef {
  id: string;
  name: string;
}

export interface SubtaskRef {
  id: string;
  key: string;
  status: StatusRef | null;
  resolution: { id: string; name: string } | null;
}

export interface LinkedIssueRef {
  id: string;
  key: string;
  relationship: string;
  direction: "inward" | "outward";
  isBlocking: boolean;
  status: StatusRef | null;
  resolution: { id: string; name: string } | null;
}

export interface ReleaseIssue {
  id: string;
  key: string;
  summary: string;
  issueType: IssueTypeRef;
  status: StatusRef | null;
  hasAcceptanceCriteria: boolean;
  labels: string[];
  fixVersions: VersionRef[];
  subtasks: SubtaskRef[];
  linkedIssues: LinkedIssueRef[];
  resolution: { id: string; name: string } | null;
  updatedAt: string;
}

export interface ReleaseCandidate {
  projectId: string;
  projectKey: string;
  versionId: string;
  versionName: string;
  releaseScopeMode: ReleaseScopeMode;
  releaseScopeJql?: string;
  issues: ReleaseIssue[];
  analyzedAt: string;
}

export type EvidenceCategory =
  | "DOCUMENTATION"
  | "WORKFLOW"
  | "DEPENDENCY"
  | "RELEASE"
  | "BLOCKER"
  | "APPROVAL";

export interface EvidenceItem {
  ruleId: string;
  issueKey: string;
  category: EvidenceCategory;
  status: ReadinessStatus;
  title: string;
  explanation: string;
  remediation: string;
  sourceField: string;
}

export interface IssueReadinessResult {
  issueKey: string;
  status: ReadinessStatus;
  score: number;
  evidence: EvidenceItem[];
  blockerCount: number;
  missingEvidenceCount: number;
}

export interface ReleaseReadinessResult {
  release: ReleaseCandidate;
  status: ReadinessStatus;
  score: number;
  totalIssues: number;
  readyIssues: number;
  incompleteIssues: number;
  blockedIssues: number;
  results: IssueReadinessResult[];
  generatedAt: string;
}
