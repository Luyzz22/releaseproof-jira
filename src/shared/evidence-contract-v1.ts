import {
  EVIDENCE_OUTCOME_IDS,
  EVIDENCE_RULE_IDS,
  type EvidenceOutcomeId,
  type EvidenceRuleId,
} from "../domain/models/evidence-outcome";
import {
  READINESS_STATUSES,
  type EvidenceCategory,
  type ReadinessStatus,
  type ReleaseScopeMode,
} from "../domain/models/readiness";

// Existing Jira gateway ceiling: 100 pages of 100 issues. No infrastructure import.
export const EVIDENCE_CONTRACT_MAX_ISSUES = 10_000;

// Explicit v1 coverage: additions to the domain require intentional mapping.
export const EVIDENCE_CONTRACT_OUTCOME_RULES = Object.freeze({
  "acceptance-criteria-present/present": "acceptance-criteria-present",
  "acceptance-criteria-present/missing": "acceptance-criteria-present",
  "accepted-status/accepted": "accepted-status",
  "accepted-status/not-accepted": "accepted-status",
  "accepted-status/missing": "accepted-status",
  "approval-marker-present/disabled": "approval-marker-present",
  "approval-marker-present/present": "approval-marker-present",
  "approval-marker-present/missing": "approval-marker-present",
  "correct-fix-version/version-only": "correct-fix-version",
  "correct-fix-version/assigned": "correct-fix-version",
  "correct-fix-version/wrong-version": "correct-fix-version",
  "correct-fix-version/missing-version": "correct-fix-version",
  "no-blocker-label/clear": "no-blocker-label",
  "no-blocker-label/blocked": "no-blocker-label",
  "no-blocking-links/clear": "no-blocking-links",
  "no-blocking-links/blocked": "no-blocking-links",
  "no-open-subtasks/disabled": "no-open-subtasks",
  "no-open-subtasks/clear": "no-open-subtasks",
  "no-open-subtasks/blocked": "no-open-subtasks",
} satisfies Record<EvidenceOutcomeId, EvidenceRuleId>);

export const EVIDENCE_CONTRACT_RULE_CATEGORIES = Object.freeze({
  "acceptance-criteria-present": "DOCUMENTATION",
  "accepted-status": "WORKFLOW",
  "approval-marker-present": "APPROVAL",
  "correct-fix-version": "RELEASE",
  "no-blocker-label": "BLOCKER",
  "no-blocking-links": "DEPENDENCY",
  "no-open-subtasks": "DEPENDENCY",
} satisfies Record<EvidenceRuleId, EvidenceCategory>);

export const EVIDENCE_CONTRACT_OUTCOME_STATUSES = Object.freeze({
  "acceptance-criteria-present/present": "READY",
  "acceptance-criteria-present/missing": "INCOMPLETE",
  "accepted-status/accepted": "READY",
  "accepted-status/not-accepted": "INCOMPLETE",
  "accepted-status/missing": "INCOMPLETE",
  "approval-marker-present/disabled": "NOT_APPLICABLE",
  "approval-marker-present/present": "READY",
  "approval-marker-present/missing": "INCOMPLETE",
  "correct-fix-version/version-only": "NOT_APPLICABLE",
  "correct-fix-version/assigned": "READY",
  "correct-fix-version/wrong-version": "INCOMPLETE",
  "correct-fix-version/missing-version": "INCOMPLETE",
  "no-blocker-label/clear": "READY",
  "no-blocker-label/blocked": "BLOCKED",
  "no-blocking-links/clear": "READY",
  "no-blocking-links/blocked": "BLOCKED",
  "no-open-subtasks/disabled": "NOT_APPLICABLE",
  "no-open-subtasks/clear": "READY",
  "no-open-subtasks/blocked": "BLOCKED",
} satisfies Record<EvidenceOutcomeId, ReadinessStatus>);

type StatusCount = "ready" | "incomplete" | "blocked" | "notApplicable";
export const EVIDENCE_CONTRACT_STATUS_COUNTS = Object.freeze({
  READY: "ready",
  INCOMPLETE: "incomplete",
  BLOCKED: "blocked",
  NOT_APPLICABLE: "notApplicable",
} satisfies Record<ReadinessStatus, StatusCount>);

export const EVIDENCE_CONTRACT_SCOPE_MODES = Object.freeze({
  VERSION_ONLY: true,
  JQL_SCOPE: true,
} satisfies Record<ReleaseScopeMode, true>);

export const EVIDENCE_CONTRACT_CATEGORIES = Object.freeze({
  DOCUMENTATION: true,
  WORKFLOW: true,
  DEPENDENCY: true,
  RELEASE: true,
  BLOCKER: true,
  APPROVAL: true,
} satisfies Record<EvidenceCategory, true>);

export interface EvidenceContractReleaseV1 {
  readonly releaseScopeMode: ReleaseScopeMode;
  readonly status: ReadinessStatus;
  readonly score: number;
  readonly totalIssues: number;
  readonly readyIssues: number;
  readonly incompleteIssues: number;
  readonly blockedIssues: number;
}

export interface EvidenceContractRuleV1 {
  readonly ruleId: EvidenceRuleId;
  readonly ready: number;
  readonly incomplete: number;
  readonly blocked: number;
  readonly notApplicable: number;
  readonly outcomes: readonly Readonly<{
    outcomeId: EvidenceOutcomeId;
    count: number;
  }>[];
}

export interface EvidenceContractFindingV1 {
  readonly ruleId: EvidenceRuleId;
  readonly category: EvidenceCategory;
  readonly status: ReadinessStatus;
  readonly outcomeId: EvidenceOutcomeId;
}

export interface EvidenceContractIssueV1 {
  readonly issueKey: string;
  readonly status: ReadinessStatus;
  readonly score: number;
  readonly blockerCount: number;
  readonly missingEvidenceCount: number;
  readonly findings: readonly EvidenceContractFindingV1[];
}

interface EvidenceContractBaseV1 {
  readonly schemaVersion: 1;
  readonly contract: "releaseproof-evidence";
  readonly authority: Readonly<{
    humanReviewRequired: true;
    releaseAuthorization: "NONE";
  }>;
  readonly release: EvidenceContractReleaseV1;
  readonly rules: readonly EvidenceContractRuleV1[];
}

export interface SummaryEvidenceContractV1 extends EvidenceContractBaseV1 {
  readonly profile: "SUMMARY_MINIMIZED";
  readonly dataBoundary: "MINIMIZED";
}

export interface TraceableEvidenceContractV1 extends EvidenceContractBaseV1 {
  readonly profile: "TRACEABLE_INTERNAL";
  readonly dataBoundary: "INTERNAL_ONLY";
  readonly issues: readonly EvidenceContractIssueV1[];
}

export type EvidenceContractV1 =
  SummaryEvidenceContractV1 | TraceableEvidenceContractV1;

export class EvidenceContractV1Error extends Error {
  readonly code = "INVALID_EVIDENCE_CONTRACT_V1";

  constructor() {
    super("INVALID_EVIDENCE_CONTRACT_V1");
    this.name = "EvidenceContractV1Error";
  }
}

function invalid(): never {
  throw new EvidenceContractV1Error();
}

function dataProperty(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !("value" in descriptor)) invalid();
  if (key !== "length" && !descriptor.enumerable) invalid();
  return descriptor.value as unknown;
}

// Null-prototype records are permitted; custom prototypes are not. Accessors,
// symbols and non-enumerable fields cannot hide data outside the exact key set.
function record(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    invalid();
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid();
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== keys.length ||
    ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
  )
    invalid();
  const result: Record<string, unknown> = {};
  for (const key of keys) result[key] = dataProperty(value, key);
  return result;
}

// Dense ordinary arrays only; never call an input-owned iterator/map/toJSON.
function array(value: unknown, maxLength: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype)
    invalid();
  // Reject oversized lists before enumerating keys or visiting any item.
  const length = integer(dataProperty(value, "length"), maxLength);
  if (Reflect.ownKeys(value).length !== length + 1) invalid();
  const result: unknown[] = [];
  for (let index = 0; index < length; index++) {
    result.push(dataProperty(value, String(index)));
  }
  return result;
}

function integer(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > max
  )
    invalid();
  return value;
}

function member<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) invalid();
  return value as T;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => integer(total + value), 0);
}

function parseRelease(input: unknown): EvidenceContractReleaseV1 {
  const value = record(input, [
    "releaseScopeMode",
    "status",
    "score",
    "totalIssues",
    "readyIssues",
    "incompleteIssues",
    "blockedIssues",
  ]);
  const release = {
    releaseScopeMode: member(
      value.releaseScopeMode,
      Object.keys(EVIDENCE_CONTRACT_SCOPE_MODES) as ReleaseScopeMode[],
    ),
    status: member(value.status, READINESS_STATUSES),
    score: integer(value.score, 100),
    totalIssues: integer(value.totalIssues, EVIDENCE_CONTRACT_MAX_ISSUES),
    readyIssues: integer(value.readyIssues),
    incompleteIssues: integer(value.incompleteIssues),
    blockedIssues: integer(value.blockedIssues),
  };
  if (
    sum([
      release.readyIssues,
      release.incompleteIssues,
      release.blockedIssues,
    ]) !== release.totalIssues
  )
    invalid();
  return release;
}

function outcomesFor(ruleId: EvidenceRuleId): readonly EvidenceOutcomeId[] {
  return EVIDENCE_OUTCOME_IDS.filter(
    (id) => EVIDENCE_CONTRACT_OUTCOME_RULES[id] === ruleId,
  );
}

function parseRules(
  input: unknown,
  totalIssues: number,
): EvidenceContractRuleV1[] {
  const values = array(input, EVIDENCE_RULE_IDS.length);
  if (values.length !== EVIDENCE_RULE_IDS.length) invalid();
  return EVIDENCE_RULE_IDS.map((ruleId, index) => {
    const value = record(values[index], [
      "ruleId",
      "ready",
      "incomplete",
      "blocked",
      "notApplicable",
      "outcomes",
    ]);
    if (value.ruleId !== ruleId) invalid();
    const ids = outcomesFor(ruleId);
    const outcomes = array(value.outcomes, ids.length);
    if (outcomes.length !== ids.length) invalid();
    const rule = {
      ruleId,
      ready: integer(value.ready),
      incomplete: integer(value.incomplete),
      blocked: integer(value.blocked),
      notApplicable: integer(value.notApplicable),
      outcomes: ids.map((outcomeId, outcomeIndex) => {
        const item = record(outcomes[outcomeIndex], ["outcomeId", "count"]);
        if (item.outcomeId !== outcomeId) invalid();
        return { outcomeId, count: integer(item.count) };
      }),
    };
    if (
      sum([rule.ready, rule.incomplete, rule.blocked, rule.notApplicable]) !==
        totalIssues ||
      sum(rule.outcomes.map((item) => item.count)) !== totalIssues
    )
      invalid();
    // Validate supplied aggregate semantics, including SUMMARY without a trace.
    for (const status of READINESS_STATUSES) {
      const expected = sum(
        rule.outcomes
          .filter(
            (item) =>
              EVIDENCE_CONTRACT_OUTCOME_STATUSES[item.outcomeId] === status,
          )
          .map((item) => item.count),
      );
      if (rule[EVIDENCE_CONTRACT_STATUS_COUNTS[status]] !== expected) invalid();
    }
    return rule;
  });
}

function parseFinding(input: unknown): EvidenceContractFindingV1 {
  const value = record(input, ["ruleId", "category", "status", "outcomeId"]);
  const ruleId = member(value.ruleId, EVIDENCE_RULE_IDS);
  const outcomeId = member(value.outcomeId, EVIDENCE_OUTCOME_IDS);
  if (EVIDENCE_CONTRACT_OUTCOME_RULES[outcomeId] !== ruleId) invalid();
  const category = member(
    value.category,
    Object.keys(EVIDENCE_CONTRACT_CATEGORIES) as EvidenceCategory[],
  );
  const status = member(value.status, READINESS_STATUSES);
  if (
    category !== EVIDENCE_CONTRACT_RULE_CATEGORIES[ruleId] ||
    status !== EVIDENCE_CONTRACT_OUTCOME_STATUSES[outcomeId]
  )
    invalid();
  return {
    ruleId,
    category,
    status,
    outcomeId,
  };
}

/** @internal One finding per rule; findings follow the authoritative rule order. */
export function compareEvidenceFindingsV1(
  left: { readonly ruleId: string },
  right: { readonly ruleId: string },
): number {
  const rules: readonly string[] = EVIDENCE_RULE_IDS;
  return rules.indexOf(left.ruleId) - rules.indexOf(right.ruleId);
}

function parseIssue(input: unknown): EvidenceContractIssueV1 {
  const value = record(input, [
    "issueKey",
    "status",
    "score",
    "blockerCount",
    "missingEvidenceCount",
    "findings",
  ]);
  // Existing Jira adapter accepts the configured project-key shape + digit suffix.
  if (
    typeof value.issueKey !== "string" ||
    value.issueKey.trim() !== value.issueKey ||
    !/^[A-Z][A-Z0-9_]{0,19}-\d+$/.test(value.issueKey)
  )
    invalid();
  const items = array(value.findings, EVIDENCE_RULE_IDS.length);
  if (items.length !== EVIDENCE_RULE_IDS.length) invalid();
  const findings = items.map((item, index) => {
    const finding = parseFinding(item);
    if (finding.ruleId !== EVIDENCE_RULE_IDS[index]) invalid();
    return finding;
  });
  return {
    issueKey: value.issueKey,
    status: member(value.status, READINESS_STATUSES),
    score: integer(value.score, 100),
    blockerCount: integer(value.blockerCount),
    missingEvidenceCount: integer(value.missingEvidenceCount),
    findings,
  };
}

/** @internal Counts supplied findings only; never evaluates readiness or scores. */
export function aggregateEvidenceFindingsV1(
  input: readonly unknown[],
): EvidenceContractRuleV1[] {
  const findings = input.map(parseFinding);
  return EVIDENCE_RULE_IDS.map((ruleId) => {
    const matches = findings.filter((finding) => finding.ruleId === ruleId);
    const counts = { ready: 0, incomplete: 0, blocked: 0, notApplicable: 0 };
    for (const finding of matches)
      counts[EVIDENCE_CONTRACT_STATUS_COUNTS[finding.status]] += 1;
    return {
      ruleId,
      ...counts,
      outcomes: outcomesFor(ruleId).map((outcomeId) => ({
        outcomeId,
        count: matches.filter((finding) => finding.outcomeId === outcomeId)
          .length,
      })),
    };
  });
}

function freezeOwned<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>))
      freezeOwned(child);
    Object.freeze(value);
  }
  return value;
}

function parseContract(input: unknown): EvidenceContractV1 {
  // Determine the discriminator through a descriptor, not a property read.
  if (input === null || typeof input !== "object") invalid();
  const profile = member(dataProperty(input, "profile"), [
    "SUMMARY_MINIMIZED",
    "TRACEABLE_INTERNAL",
  ] as const);
  const keys = [
    "schemaVersion",
    "contract",
    "profile",
    "dataBoundary",
    "authority",
    "release",
    "rules",
  ];
  const value = record(
    input,
    profile === "TRACEABLE_INTERNAL" ? [...keys, "issues"] : keys,
  );
  if (value.schemaVersion !== 1 || value.contract !== "releaseproof-evidence")
    invalid();
  const authority = record(value.authority, [
    "humanReviewRequired",
    "releaseAuthorization",
  ]);
  if (
    authority.humanReviewRequired !== true ||
    authority.releaseAuthorization !== "NONE"
  )
    invalid();
  const release = parseRelease(value.release);
  const rules = parseRules(value.rules, release.totalIssues);
  const common = {
    schemaVersion: 1 as const,
    contract: "releaseproof-evidence" as const,
    profile,
    // Reconstructed constants; no consumer-owned authority object is retained.
    authority: {
      humanReviewRequired: true as const,
      releaseAuthorization: "NONE" as const,
    },
    release,
    rules,
  };
  if (profile === "SUMMARY_MINIMIZED") {
    if (value.dataBoundary !== "MINIMIZED") invalid();
    return freezeOwned({
      ...common,
      profile,
      dataBoundary: "MINIMIZED" as const,
    });
  }
  if (value.dataBoundary !== "INTERNAL_ONLY") invalid();
  const items = array(value.issues, EVIDENCE_CONTRACT_MAX_ISSUES);
  if (items.length !== release.totalIssues) invalid();
  const issues = items.map(parseIssue);
  for (let index = 1; index < issues.length; index++) {
    const previous = issues[index - 1];
    const current = issues[index];
    if (!previous || !current || previous.issueKey >= current.issueKey)
      invalid();
  }
  const expected = aggregateEvidenceFindingsV1(
    issues.flatMap((issue) => issue.findings),
  );
  for (const [index, rule] of rules.entries()) {
    const actual = expected[index];
    if (!actual) invalid();
    for (const field of Object.values(EVIDENCE_CONTRACT_STATUS_COUNTS)) {
      if (rule[field] !== actual[field]) invalid();
    }
    for (const [outcomeIndex, outcome] of rule.outcomes.entries()) {
      if (outcome.count !== actual.outcomes[outcomeIndex]?.count) invalid();
    }
  }
  return freezeOwned({
    ...common,
    profile,
    dataBoundary: "INTERNAL_ONLY" as const,
    issues,
  });
}

/** Strict in-memory data parser. Does not authenticate facts or authorize release. */
export function parseEvidenceContractV1(input: unknown): EvidenceContractV1 {
  try {
    return parseContract(input);
  } catch {
    // Never retain/stringify an input, property name, exception or proxy error.
    throw new EvidenceContractV1Error();
  }
}

export function serializeEvidenceContractV1(input: unknown): string {
  return JSON.stringify(parseEvidenceContractV1(input));
}
