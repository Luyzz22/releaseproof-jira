import { EVIDENCE_RULE_IDS } from "../../src/domain/models/evidence-outcome";
import {
  EVAL_LOCALES,
  FAILURE_CODES,
  GOLDEN_SET_VERSION,
  freezeOwned,
  type EvalResult,
  type FailureCode,
} from "./contracts";
import { GOLDEN_CASES } from "./golden-set";

interface Counts {
  readonly totalCases: number;
  readonly passedCases: number;
  readonly failedCases: number;
}

export interface EvalReport extends Counts {
  readonly goldenSetVersion: typeof GOLDEN_SET_VERSION;
  readonly purpose: "internal-rd-pre-integration";
  // Count failing cases per code, not matches. One case may have several codes.
  readonly failureCodeCounts: Readonly<Record<FailureCode, number>>;
  readonly perLocale: Readonly<Record<string, Counts>>;
  readonly perRule: Readonly<Record<string, Counts>>;
  readonly perOperation: Readonly<Record<string, Counts>>;
  readonly integrationReviewEligible: boolean;
  readonly coverage: {
    readonly missingCaseIds: readonly string[];
    readonly duplicateCaseIds: readonly string[];
    readonly unexpectedCaseIds: readonly string[];
    readonly invalidResultCaseIds: readonly string[];
  };
}

function passed(result: EvalResult): boolean {
  return result.passed && result.failures.length === 0;
}

function counts(results: readonly EvalResult[]): Counts {
  const passedCases = results.filter(passed).length;
  return {
    totalCases: results.length,
    passedCases,
    failedCases: results.length - passedCases,
  };
}

/** One candidate per versioned case. Missing, duplicate and unknown cases fail the gate. */
export function aggregateEvaluation(
  results: readonly EvalResult[],
): EvalReport {
  const ids = results.map((result) => result.caseId);
  const expected = new Map(
    GOLDEN_CASES.map((golden) => [golden.caseId, golden]),
  );
  const missingCaseIds = [...expected.keys()]
    .filter((id) => !ids.includes(id))
    .sort();
  const duplicateCaseIds = [
    ...new Set(ids.filter((id, index) => ids.indexOf(id) !== index)),
  ].sort();
  const unexpectedCaseIds = [
    ...new Set(ids.filter((id) => !expected.has(id))),
  ].sort();
  const invalidResultCaseIds = [
    ...new Set(
      results
        .filter((result) => {
          const golden = expected.get(result.caseId);
          return (
            !golden ||
            result.goldenSetVersion !== GOLDEN_SET_VERSION ||
            result.locale !== golden.source.locale ||
            result.operation !== golden.source.kind ||
            JSON.stringify(result.source) !== JSON.stringify(golden.source) ||
            result.passed !== (result.failures.length === 0)
          );
        })
        .map((result) => result.caseId),
    ),
  ].sort();
  return freezeOwned({
    goldenSetVersion: GOLDEN_SET_VERSION,
    purpose: "internal-rd-pre-integration",
    ...counts(results),
    failureCodeCounts: Object.fromEntries(
      FAILURE_CODES.map((code) => [
        code,
        results.filter((result) =>
          result.failures.some((failure) => failure.code === code),
        ).length,
      ]),
    ) as Record<FailureCode, number>,
    perLocale: Object.fromEntries(
      EVAL_LOCALES.map((locale) => [
        locale,
        counts(results.filter((result) => result.locale === locale)),
      ]),
    ),
    perRule: Object.fromEntries(
      EVIDENCE_RULE_IDS.map((ruleId) => [
        ruleId,
        counts(
          results.filter(
            (result) =>
              result.source.kind === "finding" &&
              result.source.finding.ruleId === ruleId,
          ),
        ),
      ]),
    ),
    perOperation: Object.fromEntries(
      (["finding", "release-summary"] as const).map((operation) => [
        operation,
        counts(results.filter((result) => result.operation === operation)),
      ]),
    ),
    integrationReviewEligible:
      results.every(passed) &&
      missingCaseIds.length === 0 &&
      duplicateCaseIds.length === 0 &&
      unexpectedCaseIds.length === 0 &&
      invalidResultCaseIds.length === 0,
    coverage: {
      missingCaseIds,
      duplicateCaseIds,
      unexpectedCaseIds,
      invalidResultCaseIds,
    },
  });
}
