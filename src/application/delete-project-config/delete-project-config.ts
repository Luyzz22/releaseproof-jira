import { AppError } from "../../shared/errors";
import type {
  JiraProjectPermissionReader,
  ProjectConfigRepository,
} from "../ports";

export interface DeleteProjectConfigResult {
  deleted: boolean;
}

export async function deleteProjectConfig(
  jira: JiraProjectPermissionReader,
  repository: ProjectConfigRepository,
  projectId: string,
): Promise<DeleteProjectConfigResult> {
  if ((await jira.canAdministerProject(projectId)) !== true) {
    throw new AppError(
      "PERMISSION_DENIED",
      "Project configuration deletion requires Jira project administration permission.",
    );
  }

  return { deleted: await repository.delete(projectId) };
}
