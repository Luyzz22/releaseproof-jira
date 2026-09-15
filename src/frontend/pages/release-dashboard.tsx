import { useMemo } from "react";
import type { BootstrapData } from "../../shared/resolver-contract";
import type { ReleaseReadinessResultDto } from "../../shared/release-readiness-dto";
import { Metric } from "../components/metric";
import { Panel } from "../components/panel";
import { StatusBadge } from "../components/status-badge";
import { formatDateTimeForLocale } from "../utils/format";
import { useI18n } from "../i18n/context";
import { localizeEvidenceOutcome } from "../i18n/evidence-presentation";
import { I18N_KEYS } from "../i18n/keys";
import { readinessStatusKey } from "../i18n/readiness-status-keys";
import {
  releaseScopeExplanationForLocale,
  releaseScopeModeLabelForLocale,
} from "../utils/release-scope";

export function ReleaseDashboard({
  data,
  result,
  onDetail,
  onReport,
  onNewAnalysis,
}: {
  data: BootstrapData;
  result: ReleaseReadinessResultDto;
  onDetail: (issueKey: string) => void;
  onReport: () => void;
  onNewAnalysis: () => void;
}) {
  const { locale, t } = useI18n();
  const issueByKey = useMemo(
    () => new Map(result.release.issues.map((item) => [item.key, item])),
    [result.release.issues],
  );
  const priorities = useMemo(
    () =>
      result.results
        .filter(
          (item) => item.status === "BLOCKED" || item.status === "INCOMPLETE",
        )
        .sort((a, b) => b.blockerCount - a.blockerCount || a.score - b.score)
        .slice(0, 4),
    [result.results],
  );

  return (
    <div className="dashboard-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            {data.project.key} · {result.release.versionName}
          </p>
          <h1>{t(I18N_KEYS.releaseDashboardTitle)}</h1>
          <p>
            {t(I18N_KEYS.releaseDashboardAnalyzedAtLead)}{" "}
            {formatDateTimeForLocale(result.generatedAt, locale, t)} ·{" "}
            {result.totalIssues} {t(I18N_KEYS.releaseDashboardIssuesLabel)}
          </p>
          <p className="scope-context">
            <strong>
              {t(I18N_KEYS.releaseDashboardScopeLabel)}:{" "}
              {releaseScopeModeLabelForLocale(
                result.release.releaseScopeMode,
                t,
              )}
            </strong>
            <code>{releaseScopeExplanationForLocale(result.release, t)}</code>
          </p>
        </div>
        <div className="heading-actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onNewAnalysis}
          >
            {t(I18N_KEYS.releaseDashboardNewAnalysis)}
          </button>
          <button className="button" type="button" onClick={onReport}>
            {t(I18N_KEYS.releaseDashboardOpenReport)}
          </button>
        </div>
      </header>
      {result.totalIssues === 0 ? (
        <Panel className="state-card">
          <div className="state-icon">0</div>
          <div>
            <p className="eyebrow">
              {t(I18N_KEYS.releaseDashboardEmptyEyebrow)}
            </p>
            <h2>{t(I18N_KEYS.releaseDashboardEmptyTitle)}</h2>
            <p>{t(I18N_KEYS.releaseDashboardEmptyDescription)}</p>
          </div>
        </Panel>
      ) : (
        <>
          <div className="metric-grid">
            <Metric
              label={t(I18N_KEYS.releaseDashboardReadinessScore)}
              value={`${result.score}%`}
              tone="score"
            />
            <Metric
              label={t(readinessStatusKey("READY"))}
              value={result.readyIssues}
              tone="ready"
            />
            <Metric
              label={t(readinessStatusKey("INCOMPLETE"))}
              value={result.incompleteIssues}
              tone="incomplete"
            />
            <Metric
              label={t(readinessStatusKey("BLOCKED"))}
              value={result.blockedIssues}
              tone="blocked"
            />
          </div>
          {priorities.length > 0 ? (
            <Panel>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">
                    {t(I18N_KEYS.releaseDashboardPrioritiesEyebrow)}
                  </p>
                  <h2>{t(I18N_KEYS.releaseDashboardPrioritiesTitle)}</h2>
                </div>
                <StatusBadge status={result.status} />
              </div>
              <div className="priority-list">
                {priorities.map((item) => {
                  const first =
                    item.evidence.find(
                      (evidence) => evidence.status === "BLOCKED",
                    ) ??
                    item.evidence.find(
                      (evidence) => evidence.status === "INCOMPLETE",
                    );

                  const localizedFirst = first
                    ? localizeEvidenceOutcome(first.outcome, locale, t)
                    : null;

                  return (
                    <button
                      type="button"
                      key={item.issueKey}
                      onClick={() => onDetail(item.issueKey)}
                    >
                      <StatusBadge status={item.status} />
                      <strong>{item.issueKey}</strong>
                      <span>{localizedFirst?.title}</span>
                      <b>{item.score}%</b>
                    </button>
                  );
                })}
              </div>
            </Panel>
          ) : null}
          <Panel className="table-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">
                  {t(I18N_KEYS.releaseDashboardMatrixEyebrow)}
                </p>
                <h2>{t(I18N_KEYS.releaseDashboardMatrixTitle)}</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <caption className="visually-hidden">
                  {t(I18N_KEYS.releaseDashboardMatrixCaption)}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">
                      {t(I18N_KEYS.releaseDashboardTableIssue)}
                    </th>
                    <th scope="col">
                      {t(I18N_KEYS.releaseDashboardTableType)}
                    </th>
                    <th scope="col">
                      {t(I18N_KEYS.releaseDashboardTableStatus)}
                    </th>
                    <th scope="col">
                      {t(I18N_KEYS.releaseDashboardTableBlockers)}
                    </th>
                    <th scope="col">
                      {t(I18N_KEYS.releaseDashboardTableMissingEvidence)}
                    </th>
                    <th scope="col">
                      {t(I18N_KEYS.releaseDashboardTableScore)}
                    </th>
                    <th
                      scope="col"
                      aria-label={t(I18N_KEYS.releaseDashboardTableActions)}
                    />
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((item) => {
                    const source = issueByKey.get(item.issueKey);
                    return (
                      <tr key={item.issueKey}>
                        <th scope="row" className="row-header">
                          <strong>{item.issueKey}</strong>
                          <span className="cell-subtitle">
                            {source?.summary}
                          </span>
                        </th>
                        <td>{source?.issueTypeName}</td>
                        <td>
                          <StatusBadge status={item.status} />
                        </td>
                        <td>{item.blockerCount}</td>
                        <td>{item.missingEvidenceCount}</td>
                        <td>
                          <strong>{item.score}%</strong>
                        </td>
                        <td>
                          <button
                            className="row-action"
                            type="button"
                            onClick={() => onDetail(item.issueKey)}
                          >
                            {t(I18N_KEYS.releaseDashboardTableDetails)} →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
