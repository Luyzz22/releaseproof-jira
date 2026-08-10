import type { ReleaseScopeMode } from "../../domain/models/readiness";

interface ReleaseScopeDescriptor {
  projectKey: string;
  releaseScopeMode: ReleaseScopeMode;
  releaseScopeJql?: string;
}

export function releaseScopeModeLabel(mode: ReleaseScopeMode): string {
  return mode === "JQL_SCOPE" ? "Expliziter JQL-Scope" : "Nur Jira-Version";
}

export function releaseScopeExplanation(
  release: ReleaseScopeDescriptor,
): string {
  return release.releaseScopeMode === "JQL_SCOPE"
    ? (release.releaseScopeJql ?? "Expliziter Projekt-Scope")
    : `fixVersion der ausgewählten Version im Projekt ${release.projectKey}`;
}
