import type { ReleaseScopeMode } from "../../domain/models/readiness";

interface ReleaseScopeDescriptor {
  projectKey: string;
  releaseScopeMode: ReleaseScopeMode;
  releaseScopeJql?: string;
}

export function releaseScopeModeLabel(mode: ReleaseScopeMode): string {
  return mode === "JQL_SCOPE" ? "Expliziter JQL-Umfang" : "Nur Jira-Version";
}

export function releaseScopeExplanation(
  release: ReleaseScopeDescriptor,
): string {
  return release.releaseScopeMode === "JQL_SCOPE"
    ? (release.releaseScopeJql ?? "Expliziter Projektumfang")
    : `fixVersion der ausgewählten Version im Projekt ${release.projectKey}`;
}
