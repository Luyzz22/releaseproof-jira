import type {
  DeterministicEvidenceEnvelope,
  ExplanationLocale,
} from "../../src/application/explanation/contracts";

export const GOLDEN_SET_VERSION = 1;
// Mirrors SCRUM-83 without importing its timer/provider orchestration.
export const MAX_CANDIDATE_LENGTH = 2_000;
export const EVAL_LOCALES = ["en-US", "de-DE"] as const;

export const FAILURE_CODES = [
  "INVALID_OUTPUT_SHAPE",
  "EMPTY_OUTPUT",
  "TEXT_TOO_LONG",
  "REQUIRED_ANCHOR_MISSING",
  "FORBIDDEN_CLAIM_PRESENT",
  "INVENTED_DETAIL_PRESENT",
  "STATUS_MISMATCH",
  "SCORE_MISMATCH",
  "COUNT_MISMATCH",
  "AUTHORITY_CLAIM_PRESENT",
  "COMPLIANCE_GUARANTEE_PRESENT",
  "UNSAFE_MARKUP_OR_JQL",
  "LOCALE_MISMATCH",
  "HUMAN_REVIEW_BOUNDARY_MISSING",
] as const;
export type FailureCode = (typeof FAILURE_CODES)[number];

export const FORBIDDEN_CLAIMS = [
  "release-approval",
  "release-rejection",
  "status-change",
  "score-change",
  "invented-finding",
  "invented-issue",
  "invented-customer",
  "audit-guarantee",
  "compliance-guarantee",
  "certification",
  "autonomous-authority",
  "executable-markup",
  "unsafe-jql",
  "unsupported-account",
  "contradictory-remediation",
] as const;
export type ForbiddenClaim = (typeof FORBIDDEN_CLAIMS)[number];

// Every alternative is a conjunction of short phrases within one clause.
export interface Anchor {
  readonly id: string;
  readonly alternatives: readonly (readonly string[])[];
}

export interface GoldenCase {
  readonly caseId: string;
  readonly source: DeterministicEvidenceEnvelope;
  readonly requiredAnchors: readonly Anchor[];
  readonly localeAnchors: readonly Anchor[];
  readonly allowedRemediationAnchors: readonly string[];
  readonly forbiddenClaims: readonly ForbiddenClaim[];
  readonly forbiddenInventedDetails: readonly {
    readonly id: string;
    readonly value: string;
  }[];
  readonly contradictions: readonly Anchor[];
  readonly authorityBoundary: "advisory-only";
  readonly humanReviewRequirement: "application-metadata";
}

export interface EvalFailure {
  readonly code: FailureCode;
  // Authored check identifier only: never candidate text, matched strings or offsets.
  readonly checkId: string;
}

export interface EvalResult {
  readonly goldenSetVersion: typeof GOLDEN_SET_VERSION;
  readonly caseId: string;
  readonly passed: boolean;
  readonly failures: readonly EvalFailure[];
  readonly locale: ExplanationLocale;
  readonly operation: DeterministicEvidenceEnvelope["kind"];
  readonly source: DeterministicEvidenceEnvelope;
}

// Only call on newly allocated harness-owned data, never on caller input.
export function freezeOwned<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) freezeOwned(child);
    Object.freeze(value);
  }
  return value;
}
