import type { EvidenceOutcomeId } from "../../domain/models/evidence-outcome";
import type { ReadinessStatus } from "../../domain/models/readiness";
import type {
  DeterministicEvidenceEnvelope,
  ExplanationLocale,
} from "./contracts";

// R&D-only copy. No Jira-derived interpolation or provider-generated content.
const findings: Record<ExplanationLocale, Record<EvidenceOutcomeId, string>> = {
  "en-US": {
    "acceptance-criteria-present/present":
      "Acceptance criteria are present. No action is required for this rule.",
    "acceptance-criteria-present/missing":
      "Acceptance criteria are missing. Add text to the configured acceptance criteria field.",
    "accepted-status/accepted":
      "The issue has an accepted status. No action is required for this rule.",
    "accepted-status/not-accepted":
      "The issue does not have an accepted status. Check its workflow status against the project configuration.",
    "accepted-status/missing":
      "The issue has no status evidence. Check its workflow status.",
    "approval-marker-present/disabled":
      "Approval marker checking is disabled. This rule is not applicable.",
    "approval-marker-present/present":
      "The configured approval marker is present. No action is required for this rule.",
    "approval-marker-present/missing":
      "The configured approval marker is missing. Obtain the required human approval before applying the marker.",
    "correct-fix-version/version-only":
      "Version-only scope prefilters issues by version. This rule cannot detect issues missing from that scope.",
    "correct-fix-version/assigned":
      "The expected fix version is assigned. No action is required for this rule.",
    "correct-fix-version/wrong-version":
      "The assigned fix version does not match. Check the issue's intended release assignment.",
    "correct-fix-version/missing-version":
      "The expected fix version is missing. Check the issue's intended release assignment.",
    "no-blocker-label/clear":
      "No configured blocker label is present. No action is required for this rule.",
    "no-blocker-label/blocked":
      "A configured blocker label is present. Resolve and review the underlying blocker before changing the label.",
    "no-blocking-links/clear":
      "No unresolved blocking link was found. No action is required for this rule.",
    "no-blocking-links/blocked":
      "Unresolved blocking links were found. Review and resolve the linked dependencies.",
    "no-open-subtasks/disabled":
      "Open-subtask checking is disabled. This rule is not applicable.",
    "no-open-subtasks/clear":
      "No open subtask was found. No action is required for this rule.",
    "no-open-subtasks/blocked":
      "Open subtasks were found. Review their completion and resolution.",
  },
  "de-DE": {
    "acceptance-criteria-present/present":
      "Akzeptanzkriterien sind vorhanden. Für diese Regel ist keine Maßnahme erforderlich.",
    "acceptance-criteria-present/missing":
      "Akzeptanzkriterien fehlen. Ergänzen Sie Text im konfigurierten Akzeptanzkriterienfeld.",
    "accepted-status/accepted":
      "Der Vorgang hat einen anerkannten Status. Für diese Regel ist keine Maßnahme erforderlich.",
    "accepted-status/not-accepted":
      "Der Vorgang hat keinen anerkannten Status. Prüfen Sie den Workflow-Status anhand der Projektkonfiguration.",
    "accepted-status/missing":
      "Für den Vorgang fehlt der Statusnachweis. Prüfen Sie seinen Workflow-Status.",
    "approval-marker-present/disabled":
      "Die Prüfung des Freigabemarkers ist deaktiviert. Diese Regel ist nicht anwendbar.",
    "approval-marker-present/present":
      "Der konfigurierte Freigabemarker ist vorhanden. Für diese Regel ist keine Maßnahme erforderlich.",
    "approval-marker-present/missing":
      "Der konfigurierte Freigabemarker fehlt. Holen Sie die erforderliche menschliche Freigabe ein, bevor Sie den Marker setzen.",
    "correct-fix-version/version-only":
      "Der Versions-Scope filtert Vorgänge bereits nach Version. Diese Regel kann darin fehlende Vorgänge nicht erkennen.",
    "correct-fix-version/assigned":
      "Die erwartete Fix-Version ist zugeordnet. Für diese Regel ist keine Maßnahme erforderlich.",
    "correct-fix-version/wrong-version":
      "Die zugeordnete Fix-Version stimmt nicht überein. Prüfen Sie die beabsichtigte Release-Zuordnung des Vorgangs.",
    "correct-fix-version/missing-version":
      "Die erwartete Fix-Version fehlt. Prüfen Sie die beabsichtigte Release-Zuordnung des Vorgangs.",
    "no-blocker-label/clear":
      "Kein konfiguriertes Blocker-Label ist vorhanden. Für diese Regel ist keine Maßnahme erforderlich.",
    "no-blocker-label/blocked":
      "Ein konfiguriertes Blocker-Label ist vorhanden. Beheben und prüfen Sie den zugrunde liegenden Blocker vor einer Label-Änderung.",
    "no-blocking-links/clear":
      "Es wurde keine ungelöste blockierende Verknüpfung gefunden. Für diese Regel ist keine Maßnahme erforderlich.",
    "no-blocking-links/blocked":
      "Ungelöste blockierende Verknüpfungen wurden gefunden. Prüfen und beheben Sie die verknüpften Abhängigkeiten.",
    "no-open-subtasks/disabled":
      "Die Prüfung offener Unteraufgaben ist deaktiviert. Diese Regel ist nicht anwendbar.",
    "no-open-subtasks/clear":
      "Es wurde keine offene Unteraufgabe gefunden. Für diese Regel ist keine Maßnahme erforderlich.",
    "no-open-subtasks/blocked":
      "Offene Unteraufgaben wurden gefunden. Prüfen Sie deren Abschluss und Lösung.",
  },
};

const statuses: Record<ExplanationLocale, Record<ReadinessStatus, string>> = {
  "en-US": {
    READY: "Ready",
    INCOMPLETE: "Incomplete",
    BLOCKED: "Blocked",
    NOT_APPLICABLE: "Not applicable",
  },
  "de-DE": {
    READY: "Bereit",
    INCOMPLETE: "Unvollständig",
    BLOCKED: "Blockiert",
    NOT_APPLICABLE: "Nicht anwendbar",
  },
};

export function deterministicExplanation(
  envelope: DeterministicEvidenceEnvelope,
): string {
  if (envelope.kind === "finding")
    return findings[envelope.locale][envelope.finding.outcomeId];
  const status = statuses[envelope.locale][envelope.status];
  return envelope.locale === "de-DE"
    ? `Deterministisches Ergebnis: ${status}. Score: ${envelope.score}/100. Vorgänge: ${envelope.totalIssues}; bereit: ${envelope.readyIssues}; unvollständig: ${envelope.incompleteIssues}; blockiert: ${envelope.blockedIssues}. Dies ist keine Release-Freigabe.`
    : `Deterministic result: ${status}. Score: ${envelope.score}/100. Issues: ${envelope.totalIssues}; ready: ${envelope.readyIssues}; incomplete: ${envelope.incompleteIssues}; blocked: ${envelope.blockedIssues}. This is not a release approval.`;
}
