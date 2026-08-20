import type { ProjectConfig } from "../../domain/models/readiness";
import type { ProjectConfigRepository } from "../ports";

export async function loadProjectConfig(
  repository: ProjectConfigRepository,
  projectId: string,
): Promise<ProjectConfig | null> {
  return repository.get(projectId);
}
