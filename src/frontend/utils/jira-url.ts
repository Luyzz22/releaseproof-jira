export function buildJiraIssueUrl(
  siteUrl: string,
  issueKey: string,
): string | null {
  try {
    const base = new URL(siteUrl);
    if (base.protocol !== "https:") return null;
    const issueUrl = new URL(`/browse/${encodeURIComponent(issueKey)}`, base);
    return issueUrl.origin === base.origin ? issueUrl.toString() : null;
  } catch {
    return null;
  }
}
