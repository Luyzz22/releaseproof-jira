import type {
  EvidenceOutcomeId,
  EvidenceRuleId,
} from "../../domain/models/evidence-outcome";
import type { ReadinessStatus } from "../../domain/models/readiness";
import type {
  EvidenceItemDto,
  ReleaseReadinessResultDto,
} from "../../shared/release-readiness-dto";

export type DeepReadonly<T> = {
  readonly [Key in keyof T]: DeepReadonly<T[Key]>;
};

// Internal, completed server-side result only; this is not a resolver input.
export type CompletedAnalysis = DeepReadonly<ReleaseReadinessResultDto>;
export type EvaluatedFinding = DeepReadonly<EvidenceItemDto>;
export type ExplanationLocale = "en-US" | "de-DE";

export interface FindingEvidenceEnvelope {
  readonly schemaVersion: 1;
  readonly kind: "finding";
  readonly locale: ExplanationLocale;
  readonly finding: {
    readonly ruleId: EvidenceRuleId;
    readonly outcomeId: EvidenceOutcomeId;
    readonly status: ReadinessStatus;
  };
}

export interface ReleaseEvidenceEnvelope {
  readonly schemaVersion: 1;
  readonly kind: "release-summary";
  readonly locale: ExplanationLocale;
  readonly status: ReadinessStatus;
  readonly score: number;
  readonly totalIssues: number;
  readonly readyIssues: number;
  readonly incompleteIssues: number;
  readonly blockedIssues: number;
  readonly findingsByRule: ReadonlyArray<{
    readonly ruleId: EvidenceRuleId;
    readonly incomplete: number;
    readonly blocked: number;
  }>;
}

export type DeterministicEvidenceEnvelope =
  FindingEvidenceEnvelope | ReleaseEvidenceEnvelope;

export type FallbackReason =
  "DISABLED" | "UNAVAILABLE" | "TIMEOUT" | "INVALID_RESPONSE";

// Text is never authority, markup, a command or a readiness update.
export type Explanation = Readonly<{
  format: "plain-text";
  text: string;
}> &
  (
    | Readonly<{ source: "provider"; requiresHumanReview: true }>
    | Readonly<{ source: "deterministic-fallback"; reason: FallbackReason }>
  );
