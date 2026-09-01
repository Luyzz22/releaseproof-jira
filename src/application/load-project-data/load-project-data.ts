import type { ProjectConfig } from "../../domain/models/readiness";
import { AppError } from "../../shared/errors";
import type {
  JiraGateway,
  JiraProjectPermissionReader,
  ProjectConfigRepository,
} from "../ports";

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

async function loadCanConfigureForBootstrap(
  jira: JiraProjectPermissionReader,
  projectId: string,
): Promise<boolean> {
  try {
    return await jira.canAdministerProject(projectId);
  } catch {
    return false;
  }
}

export async function loadProjectData(
  jira: JiraGateway & JiraProjectPermissionReader,
  repository: ProjectConfigRepository,
  projectId: string,
  projectKey: string,
) {
  const [project, metadata, fields, versions, configState, canConfigure] =
    await Promise.all([
      jira.getProject(projectKey, projectId),
      jira.getProjectMetadata(projectKey),
      jira.listFields(projectId),
      jira.listVersions(projectKey, projectId),
      loadConfigForBootstrap(repository, projectId),
      loadCanConfigureForBootstrap(jira, projectId),
    ]);

  return {
    project,
    statuses: metadata.statuses,
    issueTypes: metadata.issueTypes.filter((type) => !type.subtask),
    fields,
    versions: versions.filter((version) => !version.archived),
    canConfigure,
    ...configState,
  };
}
