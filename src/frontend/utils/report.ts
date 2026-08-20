import type {
  EvidenceItemDto,
  ReleaseReadinessResultDto,
} from "../../shared/release-readiness-dto";
import { formatDateTime } from "./format";
import { readinessStatusLabel } from "./readiness-status";
import {
  releaseScopeExplanation,
  releaseScopeModeLabel,
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

export function buildMarkdownReport(result: ReleaseReadinessResultDto): string {
  const lines = [
    `# ReleaseProof: ${result.release.versionName}`,
    "",
    `- Status: ${readinessStatusLabel(result.status)}`,
    `- Bereitschaftswert: ${result.score}%`,
    `- Umfangsmodus: ${releaseScopeModeLabel(result.release.releaseScopeMode)}`,
    `- Umfangsdefinition: ${JSON.stringify(releaseScopeExplanation(result.release))}`,
    `- Vorgänge: ${result.totalIssues}`,
    `- ${readinessStatusLabel("READY")}: ${result.readyIssues}`,
    `- ${readinessStatusLabel("INCOMPLETE")}: ${result.incompleteIssues}`,
    `- ${readinessStatusLabel("BLOCKED")}: ${result.blockedIssues}`,
    "",
    "## Nachweismatrix",
    "",
    "| Vorgang | Status | Bewertung | Blockierungen | Fehlende Nachweise |",
    "| --- | --- | ---: | ---: | ---: |",
  ];
  result.results.forEach((item) =>
    lines.push(
      `| ${item.issueKey} | ${readinessStatusLabel(item.status)} | ${item.score}% | ${item.blockerCount} | ${item.missingEvidenceCount} |`,
    ),
  );

  const findings = getOpenFindings(result);
  lines.push("", "## Offene Punkte", "");
  if (findings.length === 0) {
    lines.push("Keine blockierenden oder fehlenden Nachweise gefunden.");
  } else {
    findings.forEach(({ issueKey, evidence }) =>
      lines.push(
        `- **${issueKey} · ${readinessStatusLabel(evidence.status)} · ${evidence.title}:** ${evidence.explanation} Behebung: ${evidence.remediation}`,
      ),
    );
  }
  lines.push("", `_Erzeugt am ${formatDateTime(result.generatedAt)}._`);
  return lines.join("\n");
}
