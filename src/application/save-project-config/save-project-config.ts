import type { ProjectConfig } from "../../domain/models/readiness";
import { AppError } from "../../shared/errors";
import type { ProjectConfigInput } from "../../shared/validation";
import type { Clock, ProjectConfigRepository } from "../ports";

export async function saveProjectConfig(
  repository: ProjectConfigRepository,
  clock: Clock,
  input: ProjectConfigInput,
): Promise<ProjectConfig> {
  let existing: ProjectConfig | null;
  try {
    existing = await repository.get(input.projectId);
  } catch (error) {
    if (error instanceof AppError && error.code === "STORAGE_CORRUPT") {
      existing = null;
    } else {
      throw error;
    }
  }
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
