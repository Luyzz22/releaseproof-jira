import type { ReleaseReadinessResult } from "../../domain/models/readiness";
import { Panel } from "../components/panel";
import { StatusBadge } from "../components/status-badge";
import { formatDateTime } from "../utils/format";
import { buildJiraIssueUrl } from "../utils/jira-url";
import {
  releaseScopeExplanation,
  releaseScopeModeLabel,
} from "../utils/release-scope";

export function IssueEvidenceDetail({
  result,
  issueKey,
  siteUrl,
  onBack,
}: {
  result: ReleaseReadinessResult;
  issueKey: string;
  siteUrl: string;
  onBack: () => void;
}) {
  const issue = result.release.issues.find((item) => item.key === issueKey);
  const readiness = result.results.find((item) => item.issueKey === issueKey);
  if (!issue || !readiness) return null;
  const jiraIssueUrl = buildJiraIssueUrl(siteUrl, issue.key);
  return (
    <div className="detail-stack">
      <button className="back-button" type="button" onClick={onBack}>
        ← Zurück zum Dashboard
      </button>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Evidence Detail</p>
          <h1>
            {issue.key}: {issue.summary}
          </h1>
          <p>
            {issue.issueType.name} ·{" "}
            {issue.status?.name ?? "Status nicht verfügbar"} · Aktualisiert{" "}
            {formatDateTime(issue.updatedAt)}
          </p>
          <p className="scope-context">
            <strong>
              Scope: {releaseScopeModeLabel(result.release.releaseScopeMode)}
            </strong>
            <code>{releaseScopeExplanation(result.release)}</code>
          </p>
        </div>
        <div className="detail-score">
          <StatusBadge status={readiness.status} />
          <strong>{readiness.score}%</strong>
        </div>
      </header>
      <div className="evidence-list">
        {readiness.evidence.map((item, index) => (
          <Panel key={item.ruleId} className="evidence-card">
            <div className="evidence-index">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className="evidence-main">
              <div className="evidence-heading">
                <div>
                  <p className="eyebrow">{item.ruleId}</p>
                  <h2>{item.title}</h2>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className="evidence-grid">
                <div>
                  <span>Ergebnis</span>
                  <p>{item.explanation}</p>
                </div>
                <div>
                  <span>Konkrete Behebung</span>
                  <p>{item.remediation}</p>
                </div>
                <div>
                  <span>Jira-Quelle</span>
                  <code>{item.sourceField}</code>
                </div>
              </div>
            </div>
          </Panel>
        ))}
      </div>
      {jiraIssueUrl ? (
        <a
          className="button jira-link"
          href={jiraIssueUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Vorgang in Jira öffnen
          <span aria-hidden="true"> ↗</span>
        </a>
      ) : null}
    </div>
  );
}
