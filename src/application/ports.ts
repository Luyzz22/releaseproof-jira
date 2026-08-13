import type { ProjectConfig, ReleaseIssue } from "../domain/models/readiness";

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraStatus {
  id: string;
  name: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  subtask: boolean;
}

export interface JiraField {
  id: string;
  name: string;
  custom: boolean;
  schemaType: string | null;
}

export interface JiraVersion {
  id: string;
  name: string;
  projectId: string;
  released: boolean;
  archived: boolean;
}

export interface ProjectMetadata {
  statuses: JiraStatus[];
  issueTypes: JiraIssueType[];
}

export interface JiraGateway {
  listProjects(): Promise<JiraProject[]>;
  getProject(projectIdOrKey: string): Promise<JiraProject>;
  getProjectMetadata(projectIdOrKey: string): Promise<ProjectMetadata>;
  listFields(projectId: string): Promise<JiraField[]>;
  listVersions(projectIdOrKey: string): Promise<JiraVersion[]>;
  getVersion(versionId: string): Promise<JiraVersion>;
  listIssuesForVersion(input: {
    projectKey: string;
    versionId: string;
    acceptanceCriteriaFieldId: string;
  }): Promise<ReleaseIssue[]>;
  listIssuesForJqlScope(input: {
    projectKey: string;
    releaseScopeJql: string;
    acceptanceCriteriaFieldId: string;
  }): Promise<ReleaseIssue[]>;
}

export interface JiraJqlValidator {
  validateJql(jql: string, fields: readonly JiraField[]): Promise<boolean>;
}

export interface ProjectConfigRepository {
  get(projectId: string): Promise<ProjectConfig | null>;
  save(config: ProjectConfig): Promise<void>;
}

export interface Clock {
  now(): string;
}

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
};
