import { useEffect, useMemo, useRef, useState } from "react";
import type { ReleaseReadinessResult } from "../../domain/models/readiness";
import { Panel } from "../components/panel";
import { StatusBadge } from "../components/status-badge";
import { formatDateTime } from "../utils/format";
import { readinessStatusLabel } from "../utils/readiness-status";
import {
  releaseScopeExplanation,
  releaseScopeModeLabel,
} from "../utils/release-scope";
import { buildMarkdownReport, getOpenFindings } from "../utils/report";

type CopyState = "idle" | "copied" | "failed";

export function ReportView({
  result,
  onBack,
}: {
  result: ReleaseReadinessResult;
  onBack: () => void;
}) {
  const report = useMemo(() => buildMarkdownReport(result), [result]);
  const findings = useMemo(() => getOpenFindings(result), [result]);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(report);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopyState("idle"), 2500);
  }

  const copyLabel =
    copyState === "copied"
      ? "Kopiert"
      : copyState === "failed"
        ? "Kopieren fehlgeschlagen"
        : "Markdown kopieren";

  return (
    <div className="report-stack">
      <header className="page-heading no-print">
        <div>
          <button className="back-button" type="button" onClick={onBack}>
            ← Zurück zum Dashboard
          </button>
          <p className="eyebrow">Übergabebericht</p>
          <h1>{result.release.versionName}</h1>
        </div>
        <div className="heading-actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void copy()}
          >
            {copyLabel}
          </button>
          <button
            className="button"
            type="button"
            onClick={() => window.print()}
          >
            Drucken
          </button>
          <span className="visually-hidden" role="status" aria-live="polite">
            {copyState === "copied"
              ? "Markdown-Bericht wurde in die Zwischenablage kopiert."
              : copyState === "failed"
                ? "Markdown-Bericht konnte nicht kopiert werden."
                : ""}
          </span>
        </div>
      </header>
      <Panel className="report-sheet" aria-label="Release-Readiness-Bericht">
        <div className="report-title">
          <div>
            <p className="eyebrow">Release Readiness Report</p>
            <h2 className="report-release-name">
              {result.release.versionName}
            </h2>
            <p>
              {result.release.projectKey} · {formatDateTime(result.generatedAt)}
            </p>
            <p className="scope-context">
              <strong>
                Scope: {releaseScopeModeLabel(result.release.releaseScopeMode)}
              </strong>
              <code>{releaseScopeExplanation(result.release)}</code>
            </p>
          </div>
          <div className="report-score">
            <StatusBadge status={result.status} />
            <strong>{result.score}%</strong>
            <span>Readiness</span>
          </div>
        </div>
        <div className="report-summary">
          <div>
            <span>Gesamt</span>
            <strong>{result.totalIssues}</strong>
          </div>
          <div>
            <span>{readinessStatusLabel("READY")}</span>
            <strong>{result.readyIssues}</strong>
          </div>
          <div>
            <span>{readinessStatusLabel("INCOMPLETE")}</span>
            <strong>{result.incompleteIssues}</strong>
          </div>
          <div>
            <span>{readinessStatusLabel("BLOCKED")}</span>
            <strong>{result.blockedIssues}</strong>
          </div>
        </div>
        <h2>Evidence-Matrix</h2>
        <div className="table-wrap">
          <table>
            <caption className="visually-hidden">
              Zusammenfassung der Readiness je Jira-Vorgang
            </caption>
            <thead>
              <tr>
                <th scope="col">Vorgang</th>
                <th scope="col">Status</th>
                <th scope="col">Score</th>
                <th scope="col">Blocker</th>
                <th scope="col">Fehlend</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((item) => (
                <tr key={item.issueKey}>
                  <th scope="row" className="row-header">
                    <strong>{item.issueKey}</strong>
                  </th>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>{item.score}%</td>
                  <td>{item.blockerCount}</td>
                  <td>{item.missingEvidenceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2>Blocker und fehlende Nachweise</h2>
        <div className="report-findings">
          {findings.length === 0 ? (
            <p>Keine offenen Nachweise gefunden.</p>
          ) : (
            findings.map(({ issueKey, evidence }) => (
              <div key={`${issueKey}-${evidence.ruleId}`}>
                <StatusBadge status={evidence.status} />
                <strong>
                  {issueKey} · {evidence.title}
                </strong>
                <p>{evidence.explanation}</p>
                <small>Behebung: {evidence.remediation}</small>
              </div>
            ))
          )}
        </div>
      </Panel>
      <Panel className="markdown-panel no-print">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Weitergabe</p>
            <h2>Markdown-Vorschau</h2>
          </div>
        </div>
        <pre tabIndex={0} aria-label="Markdown-Bericht">
          {report}
        </pre>
      </Panel>
    </div>
  );
}
