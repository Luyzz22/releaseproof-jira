import type { ReleaseReadinessResultDto } from "../../shared/release-readiness-dto";
import { Panel } from "../components/panel";
import { StatusBadge } from "../components/status-badge";
import { useI18n } from "../i18n/context";
import { localizeEvidenceOutcome } from "../i18n/evidence-presentation";
import { I18N_KEYS } from "../i18n/keys";
import { formatDateTimeForLocale } from "../utils/format";
import { buildJiraIssueUrl } from "../utils/jira-url";
import {
  releaseScopeExplanationForLocale,
  releaseScopeModeLabelForLocale,
} from "../utils/release-scope";

export function IssueEvidenceDetail({
  result,
  issueKey,
  siteUrl,
  onBack,
}: {
  result: ReleaseReadinessResultDto;
  issueKey: string;
  siteUrl: string;
  onBack: () => void;
}) {
  const { locale, t } = useI18n();
  const issue = result.release.issues.find((item) => item.key === issueKey);
  const readiness = result.results.find((item) => item.issueKey === issueKey);
  if (!issue || !readiness) return null;
  const jiraIssueUrl = buildJiraIssueUrl(siteUrl, issue.key);
  return (
    <div className="detail-stack">
      <button className="back-button" type="button" onClick={onBack}>
        ← {t(I18N_KEYS.issueEvidenceDetailBackToOverview)}
      </button>
      <header className="page-heading">
        <div>
          <p className="eyebrow">{t(I18N_KEYS.issueEvidenceDetailEyebrow)}</p>
          <h1>
            {issue.key}: {issue.summary}
          </h1>
          <p>
            {issue.issueTypeName} ·{" "}
            {issue.statusName ??
              t(I18N_KEYS.issueEvidenceDetailStatusUnavailable)}{" "}
            · {t(I18N_KEYS.issueEvidenceDetailUpdatedLead)}{" "}
            {formatDateTimeForLocale(issue.updatedAt, locale, t)}
          </p>
          <p className="scope-context">
            <strong>
              {t(I18N_KEYS.issueEvidenceDetailScopeLabel)}:{" "}
              {releaseScopeModeLabelForLocale(
                result.release.releaseScopeMode,
                t,
              )}
            </strong>
            <code>{releaseScopeExplanationForLocale(result.release, t)}</code>
          </p>
        </div>
        <div className="detail-score">
          <StatusBadge status={readiness.status} />
          <strong>{readiness.score}%</strong>
        </div>
      </header>
      <div className="evidence-list">
        {readiness.evidence.map((item, index) => {
          const localizedEvidence = localizeEvidenceOutcome(
            item.outcome,
            locale,
            t,
          );

          return (
            <Panel key={item.ruleId} className="evidence-card">
              <div className="evidence-index">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="evidence-main">
                <div className="evidence-heading">
                  <div>
                    <p className="eyebrow">
                      {t(I18N_KEYS.issueEvidenceDetailRuleEyebrow)}
                    </p>
                    <h2>{localizedEvidence.title}</h2>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="evidence-grid">
                  <div>
                    <span>{t(I18N_KEYS.issueEvidenceDetailResultLabel)}</span>
                    <p>{localizedEvidence.explanation}</p>
                  </div>
                  <div>
                    <span>
                      {t(I18N_KEYS.issueEvidenceDetailRemediationLabel)}
                    </span>
                    <p>{localizedEvidence.remediation}</p>
                  </div>
                  <div>
                    <span>
                      {t(I18N_KEYS.issueEvidenceDetailJiraSourceLabel)}
                    </span>
                    <code>{item.sourceField}</code>
                  </div>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
      {jiraIssueUrl ? (
        <a
          className="button jira-link"
          href={jiraIssueUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t(I18N_KEYS.issueEvidenceDetailOpenInJira)}
          <span aria-hidden="true"> ↗</span>
        </a>
      ) : null}
    </div>
  );
}
