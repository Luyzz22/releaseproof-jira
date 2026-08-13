import type { ProjectConfig } from "../../domain/models/readiness";
import { AppError } from "../../shared/errors";
import type { ProjectConfigRepository, JiraGateway } from "../ports";

type BootstrapConfigState =
  | { config: ProjectConfig | null; configRecoveryRequired: false }
  | { config: null; configRecoveryRequired: true };

async function loadConfigForBootstrap(
  repository: ProjectConfigRepository,
  projectId: string,
): Promise<BootstrapConfigState> {
  try {
    return {
      config: await repository.get(projectId),
      configRecoveryRequired: false,
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "STORAGE_CORRUPT") {
      return { config: null, configRecoveryRequired: true };
    }
    throw error;
  }
}

export async function loadProjectData(
  jira: JiraGateway,
  repository: ProjectConfigRepository,
  projectId: string,
  projectKey: string,
) {
  const [project, metadata, fields, versions, configState] = await Promise.all([
    jira.getProject(projectKey, projectId),
    jira.getProjectMetadata(projectKey),
    jira.listFields(projectId),
    jira.listVersions(projectKey, projectId),
    loadConfigForBootstrap(repository, projectId),
  ]);

  return {
    project,
    statuses: metadata.statuses,
    issueTypes: metadata.issueTypes.filter((type) => !type.subtask),
    fields,
    versions: versions.filter((version) => !version.archived),
    ...configState,
  };
}
