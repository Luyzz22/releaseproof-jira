import type {
  ProjectConfig,
  ReleaseCandidate,
  ReleaseIssue,
} from "../../src/domain/models/readiness";

export const projectConfig: ProjectConfig = {
  projectId: "10000",
  projectKey: "DEMO",
  releaseScopeMode: "JQL_SCOPE",
  releaseScopeJql: "project = DEMO AND key = DEMO-42",
  acceptedStatusIds: ["31"],
  acceptanceCriteriaFieldId: "customfield_10042",
  blockerLabels: ["release-blocker", "security-blocker"],
  includedIssueTypes: ["10001", "10002"],
  requireApprovalMarker: true,
  approvalMarker: "customer-approved",
  blockOnOpenSubtasks: true,
  createdAt: "2026-07-10T08:00:00.000Z",
  updatedAt: "2026-07-10T08:00:00.000Z",
};

export function config(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  const value = structuredClone({ ...projectConfig, ...overrides });
  if (
    value.releaseScopeMode === "VERSION_ONLY" &&
    overrides.releaseScopeJql === undefined
  ) {
    delete value.releaseScopeJql;
  }
  return value;
}

export const readyIssue: ReleaseIssue = {
  id: "20001",
  key: "DEMO-42",
  summary: "Export für Kundenabnahme bereitstellen",
  issueType: { id: "10001", name: "Story" },
  status: { id: "31", name: "Fertig" },
  description: "Der Export ist implementiert und geprüft.",
  acceptanceCriteria:
    "Given ein freigegebenes Release, when exportiert, then entsteht Markdown.",
  labels: ["customer-approved"],
  fixVersions: [{ id: "30001", name: "Kundenrelease 2.4" }],
  subtasks: [],
  linkedIssues: [],
  resolution: { id: "1", name: "Erledigt" },
  updatedAt: "2026-07-10T07:45:00.000Z",
};

export function issue(overrides: Partial<ReleaseIssue> = {}): ReleaseIssue {
  return structuredClone({ ...readyIssue, ...overrides });
}

export function release(issues: ReleaseIssue[] = [issue()]): ReleaseCandidate {
  return {
    projectId: "10000",
    projectKey: "DEMO",
    versionId: "30001",
    versionName: "Kundenrelease 2.4",
    releaseScopeMode: "JQL_SCOPE",
    releaseScopeJql: "project = DEMO AND key = DEMO-42",
    issues,
    analyzedAt: "2026-07-11T09:00:00.000Z",
  };
}
