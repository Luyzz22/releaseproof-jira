import type { DeterministicEvidenceEnvelope } from "../../src/application/explanation/contracts";
import type { ReadinessStatus } from "../../src/domain/models/readiness";
import { FINDING_CASES } from "./golden-set";
import {
  FAILURE_CODES,
  GOLDEN_SET_VERSION,
  MAX_CANDIDATE_LENGTH,
  freezeOwned,
  type EvalFailure,
  type EvalResult,
  type FailureCode,
  type GoldenCase,
} from "./contracts";
import {
  CLAIM_CHECKS,
  containsPhrase,
  hasUnsafeJql,
  hasUnsafeMarkup,
  matchesAnchor,
  matchesClaim,
  normalize,
} from "./text-checks";

function record(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

// Inspect data descriptors without invoking accessor properties.
function data(value: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor
    ? (descriptor.value as unknown)
    : undefined;
}

function copySource(
  source: DeterministicEvidenceEnvelope,
): DeterministicEvidenceEnvelope {
  if (source.kind === "finding") {
    return {
      schemaVersion: 1,
      kind: source.kind,
      locale: source.locale,
      finding: {
        ruleId: source.finding.ruleId,
        outcomeId: source.finding.outcomeId,
        status: source.finding.status,
      },
    };
  }
  return {
    schemaVersion: 1,
    kind: source.kind,
    locale: source.locale,
    status: source.status,
    score: source.score,
    totalIssues: source.totalIssues,
    readyIssues: source.readyIssues,
    incompleteIssues: source.incompleteIssues,
    blockedIssues: source.blockedIssues,
    findingsByRule: source.findingsByRule.map(
      ({ ruleId, incomplete, blocked }) => ({ ruleId, incomplete, blocked }),
    ),
  };
}

const statusNames: Readonly<Record<string, ReadinessStatus>> = {
  ready: "READY",
  bereit: "READY",
  incomplete: "INCOMPLETE",
  unvollständig: "INCOMPLETE",
  blocked: "BLOCKED",
  blockiert: "BLOCKED",
  "not applicable": "NOT_APPLICABLE",
  "nicht anwendbar": "NOT_APPLICABLE",
};
const statusWords =
  "not applicable|nicht anwendbar|ready|bereit|incomplete|unvollständig|blocked|blockiert";
type AddFailure = (code: FailureCode, checkId: string) => void;

function checkFacts(golden: GoldenCase, text: string, add: AddFailure): void {
  const source = golden.source;
  const expectedStatus =
    source.kind === "finding" ? source.finding.status : source.status;
  const statusPattern = new RegExp(
    `\\b(?:deterministic result|deterministisches ergebnis|status|release|finding|befund|ergebnis|result)\\s*(?::|=|is|ist|bleibt|remains|should be|sollte sein)\\s*(${statusWords})(?![\\p{L}\\p{N}])`,
    "gu",
  );
  const statuses = [...normalize(text).matchAll(statusPattern)];
  if (source.kind === "release-summary" && statuses.length === 0)
    add("REQUIRED_ANCHOR_MISSING", "summary-status");
  if (statuses.some((match) => statusNames[match[1]!] !== expectedStatus))
    add("STATUS_MISMATCH", "explicit-status");
  const deniedStatus = new RegExp(
    `\\b(?:release|status|finding|befund|ergebnis|result)\\s*(?::|=|is|ist)\\s*(?:not|nicht)\\s+(${statusWords})(?![\\p{L}\\p{N}])`,
    "gu",
  );
  if (
    [...normalize(text).matchAll(deniedStatus)].some(
      (match) => statusNames[match[1]!] === expectedStatus,
    )
  )
    add("STATUS_MISMATCH", "denied-source-status");

  for (const contradiction of golden.contradictions) {
    if (matchesAnchor(text, contradiction))
      add("STATUS_MISMATCH", contradiction.id);
  }

  // A finding envelope contains no facts about other rules. Summary evidence
  // can support an adverse finding only when that rule has a nonzero count.
  for (const known of FINDING_CASES) {
    if (known.source.kind !== "finding") continue;
    const fact = known.source.finding;
    const unsupported =
      source.kind === "finding"
        ? fact.ruleId !== source.finding.ruleId
        : (fact.status === "BLOCKED" || fact.status === "INCOMPLETE") &&
          !source.findingsByRule.some(
            (rule) =>
              rule.ruleId === fact.ruleId &&
              (fact.status === "BLOCKED" ? rule.blocked : rule.incomplete) > 0,
          );
    if (
      unsupported &&
      known.requiredAnchors.every((anchor) => matchesAnchor(text, anchor))
    )
      add("FORBIDDEN_CLAIM_PRESENT", "unsupported-rule-fact");
  }

  if (
    expectedStatus === "BLOCKED" &&
    /\b(?:all blockers (?:are )?resolved|no blockers (?:remain|exist)|all dependencies (?:are )?resolved|alle blocker (?:sind )?behoben|keine blocker (?:verbleiben|vorhanden))\b/u.test(
      normalize(text),
    )
  ) {
    add("STATUS_MISMATCH", "blockers-cleared");
  }

  // Labelled numeric grammar: every occurrence is checked, including appended overrides.
  const numericText = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/gu, "");
  const scores = [
    ...numericText.matchAll(
      /\b(?:score|punktzahl|bewertung)\s*(?::|=|is|ist|should be|sollte sein)?\s*([+-]?\d+(?:[.,]\d+)?)\s*(?:\/\s*(\d+)|out of\s*(\d+)|von\s*(\d+)|(%))?/gu,
    ),
  ];
  const scoreDeclarations = [
    ...numericText.matchAll(
      /\b(?:score|punktzahl|bewertung)\s*(?::|=|is\b|ist\b|should be\b|sollte sein\b)/gu,
    ),
  ];
  if (
    scoreDeclarations.some(
      (declaration) =>
        !scores.some((score) => score.index === declaration.index),
    )
  )
    add("SCORE_MISMATCH", "unparseable-score");
  if (source.kind === "finding" && scores.length > 0)
    add("SCORE_MISMATCH", "score-not-in-finding");
  if (source.kind === "release-summary") {
    if (scores.length === 0) add("REQUIRED_ANCHOR_MISSING", "summary-score");
    for (const match of scores) {
      const denominator = match[2] ?? match[3] ?? match[4];
      if (
        Number(match[1]!.replace(",", ".")) !== source.score ||
        (denominator !== undefined && Number(denominator) !== 100)
      ) {
        add("SCORE_MISMATCH", "summary-score");
      }
    }
    const countLabels = [
      ["totalIssues", "total issues|issues|vorgänge gesamt|vorgänge"],
      ["readyIssues", "ready issues|ready|bereite vorgänge|bereit"],
      [
        "incompleteIssues",
        "incomplete issues|incomplete|unvollständige vorgänge|unvollständig",
      ],
      ["blockedIssues", "blocked issues|blocked|blockierte vorgänge|blockiert"],
    ] as const;
    for (const [key, labels] of countLabels) {
      const pattern = new RegExp(
        `(?<![.\\p{L}\\p{N}])(?<!ready )(?<!incomplete )(?<!blocked )(?<!bereite )(?<!unvollständige )(?<!blockierte )(?:${labels})\\s*[:=]\\s*([+-]?\\d+(?:[.,]\\d+)?)`,
        "gu",
      );
      const matches = [...numericText.matchAll(pattern)];
      if (matches.length === 0) add("REQUIRED_ANCHOR_MISSING", key);
      if (
        matches.some(
          (match) => Number(match[1]!.replace(",", ".")) !== source[key],
        )
      )
        add("COUNT_MISMATCH", key);
    }
    // Optional per-rule evidence counts use an explicit language-neutral notation.
    const aggregatePattern =
      /\brule\[([^\]]+)\]\.(incomplete|blocked)\s*[:=]\s*([+-]?\d+(?:[.,]\d+)?)/gu;
    for (const match of numericText.matchAll(aggregatePattern)) {
      const rule = source.findingsByRule.find(
        (item) => item.ruleId === match[1],
      );
      const field = match[2] === "incomplete" ? "incomplete" : "blocked";
      if (!rule || Number(match[3]!.replace(",", ".")) !== rule[field])
        add("COUNT_MISMATCH", "rule-count");
    }
  }
}

/** Offline R&D only. golden is trusted authored data; candidate is JSON-like unknown.
 * applicationBoundary is supplied separately by the application/test driver, not the provider.
 */
export function evaluateExplanation(
  golden: GoldenCase,
  candidate: unknown,
  applicationBoundary: unknown,
): EvalResult {
  const failures: EvalFailure[] = [];
  const add: AddFailure = (code, checkId) => {
    if (
      !failures.some(
        (failure) => failure.code === code && failure.checkId === checkId,
      )
    )
      failures.push({ code, checkId });
  };
  const finish = (): EvalResult =>
    freezeOwned({
      goldenSetVersion: GOLDEN_SET_VERSION,
      caseId: golden.caseId,
      passed: failures.length === 0,
      failures: failures.sort(
        (a, b) =>
          FAILURE_CODES.indexOf(a.code) - FAILURE_CODES.indexOf(b.code) ||
          (a.checkId < b.checkId ? -1 : a.checkId > b.checkId ? 1 : 0),
      ),
      locale: golden.source.locale,
      operation: golden.source.kind,
      source: copySource(golden.source),
    });

  if (
    !record(applicationBoundary) ||
    data(applicationBoundary, "requiresHumanReview") !== true
  )
    add("HUMAN_REVIEW_BOUNDARY_MISSING", "application-review");
  if (
    !record(applicationBoundary) ||
    data(applicationBoundary, "format") !== "plain-text" ||
    data(applicationBoundary, "source") !== "provider"
  )
    add("INVALID_OUTPUT_SHAPE", "application-boundary");

  if (
    !record(candidate) ||
    Reflect.ownKeys(candidate).length !== 1 ||
    typeof data(candidate, "text") !== "string"
  ) {
    add("INVALID_OUTPUT_SHAPE", "provider-response");
    return finish();
  }
  const text = data(candidate, "text") as string;
  if (text.length > MAX_CANDIDATE_LENGTH) {
    add("TEXT_TOO_LONG", "text");
    return finish();
  }
  if (normalize(text).length === 0) {
    add("EMPTY_OUTPUT", "text");
    return finish();
  }

  if (hasUnsafeMarkup(text)) add("UNSAFE_MARKUP_OR_JQL", "executable-markup");
  if (hasUnsafeJql(text)) add("UNSAFE_MARKUP_OR_JQL", "unsafe-jql");
  for (const anchor of golden.requiredAnchors) {
    if (!matchesAnchor(text, anchor)) add("REQUIRED_ANCHOR_MISSING", anchor.id);
  }
  if (!golden.localeAnchors.every((anchor) => matchesAnchor(text, anchor)))
    add("LOCALE_MISMATCH", "locale-anchors");
  for (const check of CLAIM_CHECKS) {
    if (
      golden.forbiddenClaims.includes(check.id) &&
      matchesClaim(text, check.pattern)
    )
      add(check.code, check.id);
  }
  for (const detail of golden.forbiddenInventedDetails) {
    if (containsPhrase(text, detail.value))
      add("INVENTED_DETAIL_PRESENT", detail.id);
  }
  checkFacts(golden, text, add);
  return finish();
}
