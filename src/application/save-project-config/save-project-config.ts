import type { ProjectConfig } from "../../domain/models/readiness";
import type { ProjectConfigInput } from "../../shared/validation";
import type { Clock, ProjectConfigRepository } from "../ports";

export async function saveProjectConfig(
  repository: ProjectConfigRepository,
  clock: Clock,
  input: ProjectConfigInput,
): Promise<ProjectConfig> {
  const existing = await repository.get(input.projectId);
  const now = clock.now();
  const { releaseScopeJql, ...requiredInput } = input;
  const config: ProjectConfig = {
    ...requiredInput,
    ...(releaseScopeJql === undefined ? {} : { releaseScopeJql }),
    acceptedStatusIds: [...new Set(input.acceptedStatusIds)],
    blockerLabels: [
      ...new Set(input.blockerLabels.map((label) => label.trim())),
    ],
    includedIssueTypes: [...new Set(input.includedIssueTypes)],
    approvalMarker: input.approvalMarker.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await repository.save(config);
  return config;
}
