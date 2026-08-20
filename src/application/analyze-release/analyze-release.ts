import { analyzeRelease as analyzeReleaseDomain } from "../../domain/services/analyze-release";
import { hasSupportedAcceptanceCriteriaField } from "../../shared/acceptance-criteria-field";
import { AppError } from "../../shared/errors";
import type { ReleaseReadinessResultDto } from "../../shared/release-readiness-dto";
import {
  hasOnlyKnownReleaseScopeJqlFields,
  validateReleaseScopeJql,
} from "../../shared/validation";
import type {
  Clock,
  JiraGateway,
  JiraJqlValidator,
  ProjectConfigRepository,
} from "../ports";
import { hasValidProjectConfigMetadataIds } from "../project-config-metadata";
import { toReleaseReadinessDto } from "./to-release-readiness-dto";

export async function analyzeRelease(
  jira: JiraGateway & JiraJqlValidator,
  repository: ProjectConfigRepository,
  clock: Clock,
  input: { projectId: string; projectKey: string; versionId: string },
): Promise<ReleaseReadinessResultDto> {
  const config = await repository.get(input.projectId);
  if (!config) {
    throw new AppError("CONFIG_REQUIRED", "Project configuration is required.");
  }
  if (
    config.projectId !== input.projectId ||
    config.projectKey !== input.projectKey
  ) {
    throw new AppError(
      "STORAGE_CORRUPT",
      "Project configuration does not match the Forge context.",
    );
  }
  const [fields, metadata] = await Promise.all([
    jira.listFields(input.projectId),
    jira.getProjectMetadata(input.projectId),
  ]);
  if (
    !hasSupportedAcceptanceCriteriaField(
      fields,
      config.acceptanceCriteriaFieldId,
    )
  ) {
    throw new AppError(
      "STORAGE_CORRUPT",
      "Stored acceptance criteria field is not a supported text field.",
    );
  }
  if (!hasValidProjectConfigMetadataIds(metadata, config)) {
    throw new AppError(
      "STORAGE_CORRUPT",
      "Stored configuration references unknown Jira project metadata.",
    );
  }
  if (config.releaseScopeMode === "JQL_SCOPE") {
    if (
      config.releaseScopeJql === undefined ||
      !hasOnlyKnownReleaseScopeJqlFields(config.releaseScopeJql, fields)
    ) {
      throw new AppError(
        "STORAGE_CORRUPT",
        "Stored JQL scope references an unknown Jira field.",
      );
    }
    if (!(await jira.validateJql(config.releaseScopeJql, fields))) {
      throw new AppError(
        "STORAGE_CORRUPT",
        "Stored JQL scope contains a Jira-invalid field, value, or operator.",
      );
    }
  }

  const version = await jira.getVersion(input.versionId);
  if (version.projectId !== input.projectId) {
    throw new AppError(
      "VERSION_NOT_FOUND",
      "Version does not belong to this project.",
    );
  }
  const analyzedAt = clock.now();
  const issues =
    config.releaseScopeMode === "VERSION_ONLY"
      ? await jira.listIssuesForVersion({
          projectKey: input.projectKey,
          versionId: input.versionId,
          acceptanceCriteriaFieldId: config.acceptanceCriteriaFieldId,
        })
      : await loadJqlScopeIssues(jira, config, input.projectKey);
  const included = new Set(config.includedIssueTypes);
  const release = {
    projectId: input.projectId,
    projectKey: input.projectKey,
    versionId: version.id,
    versionName: version.name,
    releaseScopeMode: config.releaseScopeMode,
    ...(config.releaseScopeJql === undefined
      ? {}
      : { releaseScopeJql: config.releaseScopeJql }),
    issues: issues.filter((issue) => included.has(issue.issueType.id)),
    analyzedAt,
  };
  const internalResult = analyzeReleaseDomain(release, config, analyzedAt);
  return toReleaseReadinessDto(internalResult);
}

async function loadJqlScopeIssues(
  jira: JiraGateway,
  config: NonNullable<Awaited<ReturnType<ProjectConfigRepository["get"]>>>,
  projectKey: string,
) {
  const releaseScopeJql = config.releaseScopeJql;
  if (releaseScopeJql === undefined) {
    throw new AppError(
      "STORAGE_CORRUPT",
      "JQL scope configuration is incomplete.",
    );
  }
  const validation = validateReleaseScopeJql(releaseScopeJql, projectKey);
  if (!validation.valid) {
    throw new AppError(
      "STORAGE_CORRUPT",
      "Stored JQL scope failed server validation.",
    );
  }
  return jira.listIssuesForJqlScope({
    projectKey,
    releaseScopeJql,
    acceptanceCriteriaFieldId: config.acceptanceCriteriaFieldId,
  });
}
