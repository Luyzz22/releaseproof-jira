import type {
  EvidenceItemDto,
  ReleaseReadinessResultDto,
} from "../../shared/release-readiness-dto";
import type { TranslationFunction } from "../i18n/context";
import { localizeEvidenceOutcome } from "../i18n/evidence-presentation";
import { I18N_KEYS } from "../i18n/keys";
import type { SupportedLocale } from "../i18n/locale";
import { readinessStatusKey } from "../i18n/readiness-status-keys";
import { formatDateTimeForLocale } from "./format";
import {
  releaseScopeExplanationForLocale,
  releaseScopeModeLabelForLocale,
} from "./release-scope";

export interface OpenFinding {
  issueKey: string;
  evidence: EvidenceItemDto;
}

export function getOpenFindings(
  result: ReleaseReadinessResultDto,
): OpenFinding[] {
  return result.results.flatMap((item) =>
    item.evidence
      .filter(
        (evidence) =>
          evidence.status === "BLOCKED" || evidence.status === "INCOMPLETE",
      )
      .map((evidence) => ({ issueKey: item.issueKey, evidence })),
  );
}

export function buildMarkdownReport(
  result: ReleaseReadinessResultDto,
  locale: SupportedLocale,
  t: TranslationFunction,
): string {
  const releaseScopeModeLabel = releaseScopeModeLabelForLocale(
    result.release.releaseScopeMode,
    t,
  );
  const releaseScopeExplanation = releaseScopeExplanationForLocale(
    result.release,
    t,
  );

  const lines = [
    `# ReleaseProof: ${result.release.versionName}`,
    "",
    `- ${t(I18N_KEYS.reportMarkdownStatus)}: ${t(
      readinessStatusKey(result.status),
    )}`,
    `- ${t(I18N_KEYS.reportMarkdownReadinessScore)}: ${result.score}%`,
    `- ${t(I18N_KEYS.reportMarkdownScopeMode)}: ${releaseScopeModeLabel}`,
    `- ${t(I18N_KEYS.reportMarkdownScopeDefinition)}: ${JSON.stringify(
      releaseScopeExplanation,
    )}`,
    `- ${t(I18N_KEYS.reportMarkdownIssues)}: ${result.totalIssues}`,
    `- ${t(readinessStatusKey("READY"))}: ${result.readyIssues}`,
    `- ${t(readinessStatusKey("INCOMPLETE"))}: ${result.incompleteIssues}`,
    `- ${t(readinessStatusKey("BLOCKED"))}: ${result.blockedIssues}`,
    "",
    `## ${t(I18N_KEYS.reportMarkdownEvidenceMatrix)}`,
    "",
    `| ${t(I18N_KEYS.reportMarkdownTableIssue)} | ${t(
      I18N_KEYS.reportMarkdownTableStatus,
    )} | ${t(I18N_KEYS.reportMarkdownTableScore)} | ${t(
      I18N_KEYS.reportMarkdownTableBlockers,
    )} | ${t(I18N_KEYS.reportMarkdownTableMissingEvidence)} |`,
    "| --- | --- | ---: | ---: | ---: |",
  ];

  result.results.forEach((item) =>
    lines.push(
      `| ${item.issueKey} | ${t(readinessStatusKey(item.status))} | ${
        item.score
      }% | ${item.blockerCount} | ${item.missingEvidenceCount} |`,
    ),
  );

  const findings = getOpenFindings(result);

  lines.push("", `## ${t(I18N_KEYS.reportMarkdownOpenFindings)}`, "");

  if (findings.length === 0) {
    lines.push(t(I18N_KEYS.reportMarkdownNoOpenFindings));
  } else {
    findings.forEach(({ issueKey, evidence }) => {
      const localizedEvidence = localizeEvidenceOutcome(
        evidence.outcome,
        locale,
        t,
      );

      lines.push(
        `- **${issueKey} · ${t(
          readinessStatusKey(evidence.status),
        )} · ${localizedEvidence.title}:** ${
          localizedEvidence.explanation
        } ${t(I18N_KEYS.reportMarkdownRemediationLead)} ${
          localizedEvidence.remediation
        }`,
      );
    });
  }

  lines.push(
    "",
    `_${t(I18N_KEYS.reportMarkdownGeneratedAtLead)} ${formatDateTimeForLocale(
      result.generatedAt,
      locale,
      t,
    )}._`,
  );

  return lines.join("\n");
}
