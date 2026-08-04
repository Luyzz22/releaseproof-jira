import type {
  EvidenceItem,
  ReleaseReadinessResult,
} from "../../domain/models/readiness";
import { formatDateTime } from "./format";
import {
  releaseScopeExplanation,
  releaseScopeModeLabel,
} from "./release-scope";

export interface OpenFinding {
  issueKey: string;
  evidence: EvidenceItem;
}

export function getOpenFindings(result: ReleaseReadinessResult): OpenFinding[] {
  return result.results.flatMap((item) =>
    item.evidence
      .filter(
        (evidence) =>
          evidence.status === "BLOCKED" || evidence.status === "INCOMPLETE",
      )
      .map((evidence) => ({ issueKey: item.issueKey, evidence })),
  );
}

export function buildMarkdownReport(result: ReleaseReadinessResult): string {
  const lines = [
    `# ReleaseProof: ${result.release.versionName}`,
    "",
    `- Status: ${result.status}`,
    `- Readiness-Score: ${result.score}%`,
    `- Scope-Modus: ${releaseScopeModeLabel(result.release.releaseScopeMode)}`,
    `- Scope-Definition: ${JSON.stringify(releaseScopeExplanation(result.release))}`,
    `- Vorgänge: ${result.totalIssues}`,
    `- READY: ${result.readyIssues}`,
    `- INCOMPLETE: ${result.incompleteIssues}`,
    `- BLOCKED: ${result.blockedIssues}`,
    "",
    "## Evidence-Matrix",
    "",
    "| Vorgang | Status | Score | Blocker | Fehlende Nachweise |",
    "| --- | --- | ---: | ---: | ---: |",
  ];
  result.results.forEach((item) =>
    lines.push(
      `| ${item.issueKey} | ${item.status} | ${item.score}% | ${item.blockerCount} | ${item.missingEvidenceCount} |`,
    ),
  );

  const findings = getOpenFindings(result);
  lines.push("", "## Offene Punkte", "");
  if (findings.length === 0) {
    lines.push("Keine blockierenden oder fehlenden Nachweise gefunden.");
  } else {
    findings.forEach(({ issueKey, evidence }) =>
      lines.push(
        `- **${issueKey} · ${evidence.status} · ${evidence.title}:** ${evidence.explanation} Behebung: ${evidence.remediation}`,
      ),
    );
  }
  lines.push("", `_Erzeugt am ${formatDateTime(result.generatedAt)}._`);
  return lines.join("\n");
}
