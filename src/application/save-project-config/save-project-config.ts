import type { ProjectConfig } from "../../domain/models/readiness";
import { hasSupportedAcceptanceCriteriaField } from "../../shared/acceptance-criteria-field";
import { AppError } from "../../shared/errors";
import {
  hasOnlyKnownReleaseScopeJqlFields,
  type ProjectConfigInput,
} from "../../shared/validation";
import type {
  Clock,
  JiraGateway,
  JiraJqlValidator,
  ProjectConfigRepository,
} from "../ports";
import { hasValidProjectConfigMetadataIds } from "../project-config-metadata";

export async function saveProjectConfig(
  jira: Pick<JiraGateway, "listFields" | "getProjectMetadata"> &
    JiraJqlValidator,
  repository: ProjectConfigRepository,
  clock: Clock,
  input: ProjectConfigInput,
): Promise<ProjectConfig> {
  const [fields, metadata] = await Promise.all([
    jira.listFields(input.projectId),
    jira.getProjectMetadata(input.projectId),
  ]);

  if (
    !hasSupportedAcceptanceCriteriaField(
      fields,
      input.acceptanceCriteriaFieldId,
    )
  ) {
    throw new AppError(
      "INVALID_INPUT",
      "Acceptance criteria field is not a supported text field.",
    );
  }
  if (!hasValidProjectConfigMetadataIds(metadata, input)) {
    throw new AppError(
      "INVALID_INPUT",
      "Project configuration references unknown Jira metadata.",
    );
  }
  if (input.releaseScopeMode === "JQL_SCOPE") {
    if (
      input.releaseScopeJql === undefined ||
      !hasOnlyKnownReleaseScopeJqlFields(input.releaseScopeJql, fields)
    ) {
      throw new AppError(
        "INVALID_INPUT",
        "Release scope references an unknown Jira field.",
      );
    }
    if (!(await jira.validateJql(input.releaseScopeJql))) {
      throw new AppError(
        "INVALID_INPUT",
        "Release scope contains a Jira-invalid field, value, or operator.",
      );
    }
  }

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
