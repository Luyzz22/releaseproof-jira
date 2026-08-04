import type { ProjectConfigRepository, JiraGateway } from "../ports";

export async function loadProjectData(
  jira: JiraGateway,
  repository: ProjectConfigRepository,
  projectId: string,
  projectKey: string,
) {
  const [project, metadata, fields, versions, config] = await Promise.all([
    jira.getProject(projectKey),
    jira.getProjectMetadata(projectKey),
    jira.listFields(projectId),
    jira.listVersions(projectKey),
    repository.get(projectId),
  ]);

  return {
    project,
    statuses: metadata.statuses,
    issueTypes: metadata.issueTypes.filter((type) => !type.subtask),
    fields,
    versions: versions.filter((version) => !version.archived),
    config,
  };
}
