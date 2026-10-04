import {
  findingEnvelope,
  releaseEnvelope,
} from "../../src/application/explanation/evidence-envelope";
import { findingSummary, syntheticSummary } from "./evidence-contract-fixtures";
import type {
  EvidenceOutcomeId,
  EvidenceRuleId,
} from "../../src/domain/models/evidence-outcome";
import type { ReadinessStatus } from "../../src/domain/models/readiness";
import type { ExplanationLocale } from "../../src/application/explanation/contracts";
import {
  EVAL_LOCALES,
  FORBIDDEN_CLAIMS,
  freezeOwned,
  type Anchor,
  type GoldenCase,
} from "./contracts";

// Synthetic, deliberately absent from every allowlisted evidence envelope.
const forbiddenInventedDetails = [
  { id: "issue", value: "DEMO-999" },
  { id: "customer", value: "ACME GmbH" },
  { id: "person", value: "Jane Doe" },
  { id: "email", value: "john@example.invalid" },
  { id: "blocker-label", value: "synthetic-unknown-blocker" },
  { id: "blocker-fact", value: "synthetic database corruption" },
  { id: "version", value: "Synthetic Phoenix 9.9" },
  { id: "approver", value: "SYNTHETIC-APPROVER-77" },
  { id: "account", value: "SYNTHETIC-ACCOUNT-88" },
] as const;

interface FindingDefinition {
  readonly ruleId: EvidenceRuleId;
  readonly status: ReadinessStatus;
  readonly anchors: Record<ExplanationLocale, readonly (readonly string[])[]>;
  readonly remediation: Record<ExplanationLocale, readonly string[]>;
}

function definition(
  ruleId: EvidenceRuleId,
  status: ReadinessStatus,
  en: readonly (readonly string[])[],
  de: readonly (readonly string[])[],
  enRemediation: readonly string[] = [],
  deRemediation: readonly string[] = [],
): FindingDefinition {
  return {
    ruleId,
    status,
    anchors: { "en-US": en, "de-DE": de },
    remediation: { "en-US": enRemediation, "de-DE": deRemediation },
  };
}

// Explicit outcome definitions: adding a domain outcome requires authored facts.
export const FINDING_DEFINITIONS = freezeOwned({
  "acceptance-criteria-present/present": definition(
    "acceptance-criteria-present",
    "READY",
    [
      ["acceptance criteria", "are present"],
      ["acceptance criteria", "are available"],
    ],
    [
      ["akzeptanzkriterien", "sind vorhanden"],
      ["akzeptanzkriterien", "liegen vor"],
    ],
  ),
  "acceptance-criteria-present/missing": definition(
    "acceptance-criteria-present",
    "INCOMPLETE",
    [
      ["acceptance criteria", "are missing"],
      ["acceptance criteria", "are not present"],
    ],
    [
      ["akzeptanzkriterien fehlen"],
      ["akzeptanzkriterien", "sind nicht vorhanden"],
    ],
    ["add text", "acceptance criteria field"],
    ["ergänzen", "akzeptanzkriterienfeld"],
  ),
  "accepted-status/accepted": definition(
    "accepted-status",
    "READY",
    [["issue", "has an accepted status"]],
    [["vorgang", "hat einen anerkannten status"]],
  ),
  "accepted-status/not-accepted": definition(
    "accepted-status",
    "INCOMPLETE",
    [["issue", "does not have an accepted status"]],
    [["vorgang", "hat keinen anerkannten status"]],
    ["check", "workflow status"],
    ["prüfen", "workflow status"],
  ),
  "accepted-status/missing": definition(
    "accepted-status",
    "INCOMPLETE",
    [["issue", "has no status evidence"]],
    [["vorgang", "fehlt der statusnachweis"]],
    ["check", "workflow status"],
    ["prüfen", "workflow status"],
  ),
  "approval-marker-present/disabled": definition(
    "approval-marker-present",
    "NOT_APPLICABLE",
    [["approval marker checking", "is disabled"]],
    [["prüfung des freigabemarkers", "ist deaktiviert"]],
  ),
  "approval-marker-present/present": definition(
    "approval-marker-present",
    "READY",
    [["configured approval marker", "is present"]],
    [["konfigurierte freigabemarker", "ist vorhanden"]],
  ),
  "approval-marker-present/missing": definition(
    "approval-marker-present",
    "INCOMPLETE",
    [
      ["configured approval marker", "is missing"],
      ["configured approval marker", "is not present"],
    ],
    [
      ["konfigurierte freigabemarker fehlt"],
      ["konfigurierte freigabemarker", "ist nicht vorhanden"],
    ],
    ["obtain", "human approval"],
    ["menschliche freigabe", "einholen"],
  ),
  "correct-fix-version/version-only": definition(
    "correct-fix-version",
    "NOT_APPLICABLE",
    [
      ["version only scope", "prefilters issues"],
      ["version only scope", "filters issues"],
    ],
    [["versions scope", "filtert vorgänge"]],
  ),
  "correct-fix-version/assigned": definition(
    "correct-fix-version",
    "READY",
    [["expected fix version", "is assigned"]],
    [["erwartete fix version", "ist zugeordnet"]],
  ),
  "correct-fix-version/wrong-version": definition(
    "correct-fix-version",
    "INCOMPLETE",
    [["assigned fix version", "does not match"]],
    [["zugeordnete fix version", "stimmt nicht überein"]],
    ["check", "release assignment"],
    ["prüfen", "release zuordnung"],
  ),
  "correct-fix-version/missing-version": definition(
    "correct-fix-version",
    "INCOMPLETE",
    [
      ["expected fix version", "is missing"],
      ["expected fix version", "is not assigned"],
    ],
    [
      ["erwartete fix version fehlt"],
      ["erwartete fix version", "ist nicht zugeordnet"],
    ],
    ["check", "release assignment"],
    ["prüfen", "release zuordnung"],
  ),
  "no-blocker-label/clear": definition(
    "no-blocker-label",
    "READY",
    [["no configured blocker label", "is present"]],
    [["kein konfiguriertes blocker label", "ist vorhanden"]],
  ),
  "no-blocker-label/blocked": definition(
    "no-blocker-label",
    "BLOCKED",
    [["a configured blocker label", "is present"]],
    [["ein konfiguriertes blocker label", "ist vorhanden"]],
    ["resolve and review", "underlying blocker"],
    ["beheben und prüfen", "blocker"],
  ),
  "no-blocking-links/clear": definition(
    "no-blocking-links",
    "READY",
    [
      ["no unresolved blocking link", "was found"],
      ["no unresolved blocking dependencies", "exist"],
    ],
    [["keine ungelöste blockierende verknüpfung", "gefunden"]],
  ),
  "no-blocking-links/blocked": definition(
    "no-blocking-links",
    "BLOCKED",
    [
      ["unresolved blocking links", "were found"],
      ["unresolved blocking dependencies exist"],
    ],
    [
      ["ungelöste blockierende verknüpfungen", "wurden gefunden"],
      ["ungelöste blockierende abhängigkeiten bestehen"],
    ],
    ["review", "resolve", "linked dependencies"],
    ["prüfen", "beheben", "verknüpften abhängigkeiten"],
  ),
  "no-open-subtasks/disabled": definition(
    "no-open-subtasks",
    "NOT_APPLICABLE",
    [["open subtask checking", "is disabled"]],
    [["prüfung offener unteraufgaben", "ist deaktiviert"]],
  ),
  "no-open-subtasks/clear": definition(
    "no-open-subtasks",
    "READY",
    [["no open subtask", "was found"]],
    [["keine offene unteraufgabe", "gefunden"]],
  ),
  "no-open-subtasks/blocked": definition(
    "no-open-subtasks",
    "BLOCKED",
    [["open subtasks", "were found"]],
    [["offene unteraufgaben", "wurden gefunden"]],
    ["review", "completion and resolution"],
    ["prüfen", "abschluss und lösung"],
  ),
} satisfies Record<EvidenceOutcomeId, FindingDefinition>);

function anchor(
  id: string,
  alternatives: readonly (readonly string[])[],
): Anchor {
  return { id, alternatives };
}

const common = {
  forbiddenClaims: FORBIDDEN_CLAIMS,
  forbiddenInventedDetails,
  authorityBoundary: "advisory-only",
  humanReviewRequirement: "application-metadata",
} as const;

export const FINDING_CASES: readonly GoldenCase[] = freezeOwned(
  (Object.keys(FINDING_DEFINITIONS) as EvidenceOutcomeId[]).flatMap(
    (outcomeId) => {
      const row = FINDING_DEFINITIONS[outcomeId];
      return EVAL_LOCALES.map((locale): GoldenCase => {
        const fact = anchor("finding-fact", row.anchors[locale]);
        const requiredAnchors = [fact];
        if (outcomeId === "correct-fix-version/version-only") {
          requiredAnchors.push(
            anchor(
              "scope-limitation",
              locale === "en-US"
                ? [["cannot detect", "missing from that scope"]]
                : [["fehlende vorgänge", "nicht erkennen"]],
            ),
          );
        }
        const evidence = findingSummary(outcomeId);
        return {
          ...common,
          caseId: `finding:${outcomeId}:${locale}`,
          evidence,
          source: findingEnvelope(
            evidence,
            { ruleId: row.ruleId, outcomeId },
            locale,
          ).envelope,
          requiredAnchors,
          localeAnchors: [fact],
          allowedRemediationAnchors: row.remediation[locale],
          contradictions: Object.entries(FINDING_DEFINITIONS)
            .filter(
              ([id, other]) => id !== outcomeId && other.ruleId === row.ruleId,
            )
            .flatMap(([id, other]) =>
              EVAL_LOCALES.map((language) =>
                anchor(
                  `contradiction:${id}:${language}`,
                  other.anchors[language],
                ),
              ),
            ),
        };
      });
    },
  ),
);

export const SUMMARY_FACTS = freezeOwned({
  READY: {
    score: 100,
    totalIssues: 4,
    readyIssues: 4,
    incompleteIssues: 0,
    blockedIssues: 0,
  },
  INCOMPLETE: {
    score: 82,
    totalIssues: 4,
    readyIssues: 3,
    incompleteIssues: 1,
    blockedIssues: 0,
  },
  BLOCKED: {
    score: 82,
    totalIssues: 4,
    readyIssues: 3,
    incompleteIssues: 0,
    blockedIssues: 1,
  },
  NOT_APPLICABLE: {
    score: 0,
    totalIssues: 0,
    readyIssues: 0,
    incompleteIssues: 0,
    blockedIssues: 0,
  },
} satisfies Record<ReadinessStatus, object>);

export const SUMMARY_CASES: readonly GoldenCase[] = freezeOwned(
  (Object.keys(SUMMARY_FACTS) as ReadinessStatus[]).flatMap((status) =>
    EVAL_LOCALES.map((locale): GoldenCase => {
      const evidence = syntheticSummary(
        { releaseScopeMode: "JQL_SCOPE", status, ...SUMMARY_FACTS[status] },
        status === "INCOMPLETE"
          ? { outcomeId: "acceptance-criteria-present/missing", count: 1 }
          : status === "BLOCKED"
            ? { outcomeId: "no-blocking-links/blocked", count: 1 }
            : undefined,
      );
      return {
        ...common,
        caseId: `release-summary:${status}:${locale}`,
        evidence,
        source: releaseEnvelope(evidence, locale).envelope,
        requiredAnchors: [
          anchor(
            "summary-facts",
            locale === "en-US" ? [["issues"]] : [["vorgänge"]],
          ),
        ],
        localeAnchors: [
          anchor(
            "summary-language",
            locale === "en-US"
              ? [["issues"], ["deterministic result"]]
              : [["vorgänge"], ["deterministisches ergebnis"]],
          ),
        ],
        allowedRemediationAnchors:
          locale === "en-US" ? ["human review"] : ["menschliche prüfung"],
        contradictions: [],
      };
    }),
  ),
);

export const GOLDEN_CASES: readonly GoldenCase[] = freezeOwned([
  ...FINDING_CASES,
  ...SUMMARY_CASES,
]);
