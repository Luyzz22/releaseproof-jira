import { analyzeRelease as analyzeReleaseDomain } from "../../domain/services/analyze-release";
import { hasSupportedAcceptanceCriteriaField } from "../../shared/acceptance-criteria-field";
import { AppError } from "../../shared/errors";
import { validateReleaseScopeJql } from "../../shared/validation";
import type { Clock, JiraGateway, ProjectConfigRepository } from "../ports";

export async function analyzeRelease(
  jira: JiraGateway,
  repository: ProjectConfigRepository,
  clock: Clock,
  input: { projectId: string; projectKey: string; versionId: string },
) {
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
  const fields = await jira.listFields(input.projectId);
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
  return analyzeReleaseDomain(release, config, analyzedAt);
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
