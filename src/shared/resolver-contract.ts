import type {
  JiraField,
  JiraIssueType,
  JiraProject,
  JiraStatus,
  JiraVersion,
} from "../application/ports";
import type {
  ProjectConfig,
  ReleaseReadinessResult,
} from "../domain/models/readiness";
import type { SafeError } from "./errors";
import type { ProjectConfigInput } from "./validation";

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; error: SafeError };

export interface BootstrapData {
  siteUrl: string;
  project: JiraProject;
  statuses: JiraStatus[];
  issueTypes: JiraIssueType[];
  fields: JiraField[];
  versions: JiraVersion[];
  config: ProjectConfig | null;
}

export type ResolverDefinitions = {
  getBootstrap: () => Promise<ApiResult<BootstrapData>>;
  saveProjectConfig: (
    input: ProjectConfigInput,
  ) => Promise<ApiResult<ProjectConfig>>;
  analyzeRelease: (input: {
    versionId: string;
  }) => Promise<ApiResult<ReleaseReadinessResult>>;
};
