import type {
  ReleaseCandidate,
  ReleaseScopeMode,
} from "../../domain/models/readiness";

export function releaseScopeModeLabel(mode: ReleaseScopeMode): string {
  return mode === "JQL_SCOPE" ? "Expliziter JQL-Scope" : "Nur Jira-Version";
}

export function releaseScopeExplanation(
  release: Pick<
    ReleaseCandidate,
    "releaseScopeMode" | "releaseScopeJql" | "projectKey"
  >,
): string {
  return release.releaseScopeMode === "JQL_SCOPE"
    ? (release.releaseScopeJql ?? "Expliziter Projekt-Scope")
    : `fixVersion der ausgewählten Version im Projekt ${release.projectKey}`;
}
