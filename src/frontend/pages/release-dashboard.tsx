import { useMemo } from "react";
import type { BootstrapData } from "../../shared/resolver-contract";
import type { ReleaseReadinessResult } from "../../domain/models/readiness";
import { Metric } from "../components/metric";
import { Panel } from "../components/panel";
import { StatusBadge } from "../components/status-badge";
import { formatDateTime } from "../utils/format";
import {
  releaseScopeExplanation,
  releaseScopeModeLabel,
} from "../utils/release-scope";

export function ReleaseDashboard({
  data,
  result,
  onDetail,
  onReport,
  onNewAnalysis,
}: {
  data: BootstrapData;
  result: ReleaseReadinessResult;
  onDetail: (issueKey: string) => void;
  onReport: () => void;
  onNewAnalysis: () => void;
}) {
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
          <h1>Release Readiness</h1>
          <p>
            Analysiert am {formatDateTime(result.generatedAt)} ·{" "}
            {result.totalIssues} Vorgänge
          </p>
          <p className="scope-context">
            <strong>
              Scope: {releaseScopeModeLabel(result.release.releaseScopeMode)}
            </strong>
            <code>{releaseScopeExplanation(result.release)}</code>
          </p>
        </div>
        <div className="heading-actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onNewAnalysis}
          >
            Neue Analyse
          </button>
          <button className="button" type="button" onClick={onReport}>
            Bericht öffnen
          </button>
        </div>
      </header>
      {result.totalIssues === 0 ? (
        <Panel className="state-card">
          <div className="state-icon">0</div>
          <div>
            <p className="eyebrow">Leeres Release</p>
            <h2>Keine passenden Vorgänge gefunden</h2>
            <p>
              Der konfigurierte Scope enthält keine Vorgänge der ausgewählten
              Issue-Typen. Score und Status werden deshalb nicht als
              Readiness-Aussage interpretiert.
            </p>
          </div>
        </Panel>
      ) : (
        <>
          <div className="metric-grid">
            <Metric
              label="Readiness-Score"
              value={`${result.score}%`}
              tone="score"
            />
            <Metric label="Ready" value={result.readyIssues} tone="ready" />
            <Metric
              label="Unvollständig"
              value={result.incompleteIssues}
              tone="incomplete"
            />
            <Metric
              label="Blockiert"
              value={result.blockedIssues}
              tone="blocked"
            />
          </div>
          {priorities.length > 0 ? (
            <Panel>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Prioritäten</p>
                  <h2>Wichtigste Probleme</h2>
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
                  return (
                    <button
                      type="button"
                      key={item.issueKey}
                      onClick={() => onDetail(item.issueKey)}
                    >
                      <StatusBadge status={item.status} />
                      <strong>{item.issueKey}</strong>
                      <span>{first?.title}</span>
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
                <p className="eyebrow">Evidence-Matrix</p>
                <h2>Vorgänge im Release</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <caption className="visually-hidden">
                  Evidence-Matrix aller analysierten Vorgänge
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Vorgang</th>
                    <th scope="col">Typ</th>
                    <th scope="col">Status</th>
                    <th scope="col">Blocker</th>
                    <th scope="col">Fehlend</th>
                    <th scope="col">Score</th>
                    <th scope="col" aria-label="Aktionen" />
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
                        <td>{source?.issueType.name}</td>
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
                            Details →
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
