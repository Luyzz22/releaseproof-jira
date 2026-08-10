import type { ProjectMetadata } from "./ports";

interface ProjectConfigMetadataIds {
  acceptedStatusIds: readonly string[];
  includedIssueTypes: readonly string[];
}

export function hasValidProjectConfigMetadataIds(
  metadata: ProjectMetadata,
  config: ProjectConfigMetadataIds,
): boolean {
  const statusIds = new Set(metadata.statuses.map((status) => status.id));
  const issueTypeIds = new Set(
    metadata.issueTypes.filter((type) => !type.subtask).map((type) => type.id),
  );

  return (
    config.acceptedStatusIds.every((id) => statusIds.has(id)) &&
    config.includedIssueTypes.every((id) => issueTypeIds.has(id))
  );
}
