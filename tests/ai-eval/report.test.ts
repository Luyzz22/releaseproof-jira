import { describe, expect, it } from "vitest";
import { REVIEW_BOUNDARY, SAFE_FIXTURES } from "../fixtures/ai-eval";
import { evaluateExplanation } from "./evaluator";
import { aggregateEvaluation } from "./report";
import { GOLDEN_CASES } from "./golden-set";

const passing = SAFE_FIXTURES.map(({ golden, candidate }) =>
  evaluateExplanation(golden, candidate, REVIEW_BOUNDARY),
);

describe("internal R&D pre-integration gate", () => {
  it("requires every versioned case exactly once", () => {
    const report = aggregateEvaluation(passing);
    expect(report).toMatchObject({
      totalCases: GOLDEN_CASES.length,
      passedCases: GOLDEN_CASES.length,
      failedCases: 0,
      integrationReviewEligible: true,
    });
    expect(
      Object.values(report.failureCodeCounts).every((count) => count === 0),
    ).toBe(true);
    expect(report.perLocale["en-US"]?.totalCases).toBe(GOLDEN_CASES.length / 2);
    expect(report.perRule["no-blocking-links"]?.totalCases).toBe(4);
    expect(report.perOperation["release-summary"]?.totalCases).toBe(8);
    expect(aggregateEvaluation([]).integrationReviewEligible).toBe(false);
    expect(
      aggregateEvaluation(passing.slice(1)).coverage.missingCaseIds,
    ).toEqual([passing[0]!.caseId]);
    expect(
      aggregateEvaluation(passing.slice(1)).integrationReviewEligible,
    ).toBe(false);
    expect(
      aggregateEvaluation([...passing, passing[0]!]).coverage.duplicateCaseIds,
    ).toEqual([passing[0]!.caseId]);
    expect(
      aggregateEvaluation([...passing, passing[0]!]).integrationReviewEligible,
    ).toBe(false);
    expect(
      aggregateEvaluation([
        ...passing,
        { ...passing[0]!, caseId: "synthetic-unknown" },
      ]).integrationReviewEligible,
    ).toBe(false);
  });

  it("counts failing cases once per code and is invariant to input order", () => {
    const fixture = SAFE_FIXTURES[0]!;
    const failed = evaluateExplanation(
      fixture.golden,
      {
        text: "DEMO-999 ACME GmbH. Release approved. No human review is required.",
      },
      REVIEW_BOUNDARY,
    );
    const results = [failed, ...passing.slice(1)];
    const before = structuredClone(results);
    const report = aggregateEvaluation(results);
    expect(report.failedCases).toBe(1);
    expect(report.failureCodeCounts.INVENTED_DETAIL_PRESENT).toBe(1);
    expect(report.failureCodeCounts.AUTHORITY_CLAIM_PRESENT).toBe(1);
    expect(report.integrationReviewEligible).toBe(false);
    expect(JSON.stringify(aggregateEvaluation([...results].reverse()))).toBe(
      JSON.stringify(report),
    );
    expect(results).toEqual(before);
  });

  it("rejects stale/misidentified or inconsistent results", () => {
    for (const replacement of [
      { ...passing[0]!, locale: "de-DE" as const },
      { ...passing[0]!, source: passing[1]!.source },
      { ...passing[0]!, passed: false },
      {
        ...passing[0]!,
        failures: [
          { code: "STATUS_MISMATCH" as const, checkId: "explicit-status" },
        ],
      },
    ]) {
      const report = aggregateEvaluation([replacement, ...passing.slice(1)]);
      expect(report.integrationReviewEligible).toBe(false);
      expect(report.coverage.invalidResultCaseIds).toEqual([
        passing[0]!.caseId,
      ]);
    }
  });
});
