import { useEffect, useMemo, useRef, useState } from "react";
import type { ReleaseReadinessResultDto } from "../../shared/release-readiness-dto";
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
import { buildMarkdownReport, getOpenFindings } from "../utils/report";

type CopyState = "idle" | "copied" | "failed";

export function ReportView({
  result,
  onBack,
}: {
  result: ReleaseReadinessResultDto;
  onBack: () => void;
}) {
  const { locale, t } = useI18n();
  const report = useMemo(
    () => buildMarkdownReport(result, locale, t),
    [locale, result, t],
  );
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
      ? t(I18N_KEYS.reportViewCopyCopied)
      : copyState === "failed"
        ? t(I18N_KEYS.reportViewCopyFailed)
        : t(I18N_KEYS.reportViewCopyIdle);

  return (
    <div className="report-stack">
      <header className="page-heading no-print">
        <div>
          <button className="back-button" type="button" onClick={onBack}>
            ← {t(I18N_KEYS.reportViewBackToOverview)}
          </button>
          <p className="eyebrow">{t(I18N_KEYS.reportViewHandoffEyebrow)}</p>
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
            {t(I18N_KEYS.reportViewPrint)}
          </button>
          <span className="visually-hidden" role="status" aria-live="polite">
            {copyState === "copied"
              ? t(I18N_KEYS.reportViewCopyStatusCopied)
              : copyState === "failed"
                ? t(I18N_KEYS.reportViewCopyStatusFailed)
                : ""}
          </span>
        </div>
      </header>
      <Panel
        className="report-sheet"
        aria-label={t(I18N_KEYS.reportViewSheetAriaLabel)}
      >
        <div className="report-title">
          <div>
            <p className="eyebrow">{t(I18N_KEYS.reportViewReportEyebrow)}</p>
            <h2 className="report-release-name">
              {result.release.versionName}
            </h2>
            <p>
              {result.release.projectKey} ·{" "}
              {formatDateTimeForLocale(result.generatedAt, locale, t)}
            </p>
            <p className="scope-context">
              <strong>
                {t(I18N_KEYS.reportViewScopeLabel)}:{" "}
                {releaseScopeModeLabelForLocale(
                  result.release.releaseScopeMode,
                  t,
                )}
              </strong>
              <code>{releaseScopeExplanationForLocale(result.release, t)}</code>
            </p>
          </div>
          <div className="report-score">
            <StatusBadge status={result.status} />
            <strong>{result.score}%</strong>
            <span>{t(I18N_KEYS.reportViewReadinessLabel)}</span>
          </div>
        </div>
        <div className="report-summary">
          <div>
            <span>{t(I18N_KEYS.reportViewSummaryTotal)}</span>
            <strong>{result.totalIssues}</strong>
          </div>
          <div>
            <span>{t(readinessStatusKey("READY"))}</span>
            <strong>{result.readyIssues}</strong>
          </div>
          <div>
            <span>{t(readinessStatusKey("INCOMPLETE"))}</span>
            <strong>{result.incompleteIssues}</strong>
          </div>
          <div>
            <span>{t(readinessStatusKey("BLOCKED"))}</span>
            <strong>{result.blockedIssues}</strong>
          </div>
        </div>
        <h2>{t(I18N_KEYS.reportViewMatrixHeading)}</h2>
        <div className="table-wrap">
          <table>
            <caption className="visually-hidden">
              {t(I18N_KEYS.reportViewMatrixCaption)}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t(I18N_KEYS.reportViewMatrixTableIssue)}</th>
                <th scope="col">{t(I18N_KEYS.reportViewMatrixTableStatus)}</th>
                <th scope="col">{t(I18N_KEYS.reportViewMatrixTableScore)}</th>
                <th scope="col">
                  {t(I18N_KEYS.reportViewMatrixTableBlockers)}
                </th>
                <th scope="col">{t(I18N_KEYS.reportViewMatrixTableMissing)}</th>
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
        <h2>{t(I18N_KEYS.reportFindingsHeading)}</h2>
        <div className="report-findings">
          {findings.length === 0 ? (
            <p>{t(I18N_KEYS.reportFindingsEmpty)}</p>
          ) : (
            findings.map(({ issueKey, evidence }) => {
              const localizedEvidence = localizeEvidenceOutcome(
                evidence.outcome,
                locale,
                t,
              );

              return (
                <div key={`${issueKey}-${evidence.ruleId}`}>
                  <StatusBadge status={evidence.status} />
                  <strong>
                    {issueKey} · {localizedEvidence.title}
                  </strong>
                  <p>{localizedEvidence.explanation}</p>
                  <small>
                    {t(I18N_KEYS.reportFindingsRemediationLead)}{" "}
                    {localizedEvidence.remediation}
                  </small>
                </div>
              );
            })
          )}
        </div>
      </Panel>
      <Panel className="markdown-panel no-print">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t(I18N_KEYS.reportViewSharingEyebrow)}</p>
            <h2>{t(I18N_KEYS.reportViewMarkdownPreviewHeading)}</h2>
          </div>
        </div>
        <pre
          tabIndex={0}
          aria-label={t(I18N_KEYS.reportViewMarkdownPreviewAriaLabel)}
        >
          {report}
        </pre>
      </Panel>
    </div>
  );
}
