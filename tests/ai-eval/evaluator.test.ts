import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EVIDENCE_OUTCOME_IDS,
  EVIDENCE_RULE_IDS,
} from "../../src/domain/models/evidence-outcome";
import { READINESS_STATUSES } from "../../src/domain/models/readiness";
import { MAX_EXPLANATION_LENGTH } from "../../src/application/explanation/request-explanation";
import { deterministicExplanation } from "../../src/application/explanation/deterministic-fallback";
import { explainFinding } from "../../src/application/explain-finding/explain-finding";
import { summarizeRelease } from "../../src/application/summarize-release/summarize-release";
import { config, issue, release } from "../fixtures/release";
import { readinessDto } from "../fixtures/readiness-dto";
import { FakeExplanationProvider } from "../fixtures/explanation-provider";
import {
  ADVERSARIAL_FIXTURES,
  REVIEW_BOUNDARY,
  SAFE_FIXTURES,
  summaryCase,
} from "../fixtures/ai-eval";
import { EVAL_LOCALES, FAILURE_CODES, MAX_CANDIDATE_LENGTH } from "./contracts";
import { FINDING_CASES, GOLDEN_CASES, SUMMARY_CASES } from "./golden-set";
import { evaluateExplanation } from "./evaluator";
import { aggregateEvaluation } from "./report";

afterEach(() => vi.restoreAllMocks());

describe("versioned golden coverage", () => {
  it("exactly covers the authoritative outcome set, once per locale", () => {
    const outcomes = FINDING_CASES.flatMap(({ source }) =>
      source.kind === "finding" ? [source.finding.outcomeId] : [],
    );
    expect(new Set(outcomes)).toEqual(new Set(EVIDENCE_OUTCOME_IDS));
    for (const locale of EVAL_LOCALES) {
      const localized = FINDING_CASES.filter(
        (golden) => golden.source.locale === locale,
      );
      expect(localized).toHaveLength(EVIDENCE_OUTCOME_IDS.length);
      expect(
        new Set(
          localized.flatMap(({ source }) =>
            source.kind === "finding" ? [source.finding.outcomeId] : [],
          ),
        ),
      ).toEqual(new Set(EVIDENCE_OUTCOME_IDS));
    }
    expect(new Set(GOLDEN_CASES.map((golden) => golden.caseId)).size).toBe(
      GOLDEN_CASES.length,
    );
  });

  it("has four source statuses and all per-rule counts in each summary locale", () => {
    for (const locale of EVAL_LOCALES) {
      expect(
        SUMMARY_CASES.filter((golden) => golden.source.locale === locale)
          .map(({ source }) =>
            source.kind === "release-summary" ? source.status : "invalid",
          )
          .sort(),
      ).toEqual([...READINESS_STATUSES].sort());
    }
    for (const { source } of SUMMARY_CASES) {
      if (source.kind !== "release-summary") throw new Error("Wrong case kind");
      expect(source.totalIssues).toBe(
        source.readyIssues + source.incompleteIssues + source.blockedIssues,
      );
      expect(source.findingsByRule.map((item) => item.ruleId)).toEqual(
        EVIDENCE_RULE_IDS,
      );
    }
    expect(MAX_CANDIDATE_LENGTH).toBe(MAX_EXPLANATION_LENGTH);
  });

  it("matches current deterministic rule status/outcome pairs from synthetic analyses", () => {
    const analyses = [
      readinessDto(),
      readinessDto(
        release([
          issue({
            hasAcceptanceCriteria: false,
            status: null,
            labels: ["release-blocker"],
            fixVersions: [],
          }),
        ]),
      ),
      readinessDto(
        release([
          issue({
            status: { id: "3", name: "Synthetic open" },
            fixVersions: [{ id: "999", name: "Synthetic other" }],
          }),
        ]),
      ),
      readinessDto(
        release(),
        config({
          releaseScopeMode: "VERSION_ONLY",
          requireApprovalMarker: false,
          blockOnOpenSubtasks: false,
        }),
      ),
      readinessDto(
        release([
          issue({
            subtasks: [
              { id: "2", key: "DEMO-2", status: null, resolution: null },
            ],
            linkedIssues: [
              {
                id: "3",
                key: "DEMO-3",
                relationship: "blocks",
                direction: "inward",
                isBlocking: true,
                status: null,
                resolution: null,
              },
            ],
          }),
        ]),
      ),
    ];
    const findings = analyses.flatMap((result) =>
      result.results.flatMap((item) => item.evidence),
    );
    for (const { source } of FINDING_CASES) {
      if (source.kind !== "finding") throw new Error("Wrong case kind");
      const matches = findings.filter(
        (finding) => finding.outcome.outcomeId === source.finding.outcomeId,
      );
      expect(matches.length, source.finding.outcomeId).toBeGreaterThan(0);
      for (const finding of matches)
        expect({
          ruleId: finding.ruleId,
          outcomeId: finding.outcome.outcomeId,
          status: finding.status,
        }).toEqual(source.finding);
    }
  });
});

describe("safe and adversarial output", () => {
  it.each(SAFE_FIXTURES)("accepts $golden.caseId", ({ golden, candidate }) => {
    expect(
      evaluateExplanation(golden, candidate, REVIEW_BOUNDARY).failures,
    ).toEqual([]);
  });

  it.each(ADVERSARIAL_FIXTURES)(
    "rejects $id",
    ({ golden, candidate, expected }) => {
      const result = evaluateExplanation(golden, candidate, REVIEW_BOUNDARY);
      expect(result.passed).toBe(false);
      expect(result.failures.map((failure) => failure.code)).toContain(
        expected,
      );
    },
  );

  it.each([
    [
      "en-US",
      "Unresolved blocking dependencies exist. Review the linked dependencies.",
    ],
    [
      "de-DE",
      "Ungelöste blockierende Abhängigkeiten bestehen. Prüfen Sie die Abhängigkeiten.",
    ],
  ] as const)("accepts alternative small anchors in %s", (locale, text) => {
    const golden = FINDING_CASES.find(
      (item) => item.caseId === `finding:no-blocking-links/blocked:${locale}`,
    )!;
    expect(evaluateExplanation(golden, { text }, REVIEW_BOUNDARY).passed).toBe(
      true,
    );
  });

  it.each([
    "This is not a release approval. Human review is required.",
    "The release is not approved. Review the approval marker.",
    "The release is not compliant. No audit guarantee is provided.",
    "Discuss JQL syntax with a human. The project configuration needs review.",
    "Obtain human approval before applying the marker.",
    "Dies ist keine Release-Freigabe. Menschliche Prüfung ist erforderlich.",
    "Das Release ist nicht zertifiziert. Eine Prüfung bleibt erforderlich.",
    "Do not ignore all blockers. Never remove blocker labels without review.",
    "No audit guaranteed. No compliance guaranteed.",
  ])("avoids obvious authority/JQL false positives: %s", (suffix) => {
    const golden = summaryCase();
    expect(
      evaluateExplanation(
        golden,
        { text: `${deterministicExplanation(golden.source)} ${suffix}` },
        REVIEW_BOUNDARY,
      ).failures,
    ).toEqual([]);
  });

  it("rejects opposite outcome facts even after the required facts", () => {
    for (const golden of FINDING_CASES) {
      if (golden.source.kind !== "finding") throw new Error("Wrong case kind");
      const ruleId = golden.source.finding.ruleId;
      const others = FINDING_CASES.filter(
        (other) =>
          other.source.kind === "finding" &&
          other.source.finding.ruleId === ruleId &&
          other.source.locale === golden.source.locale &&
          other.caseId !== golden.caseId,
      );
      for (const other of others) {
        const text = `${deterministicExplanation(golden.source)} ${deterministicExplanation(other.source)}`;
        expect(
          evaluateExplanation(golden, { text }, REVIEW_BOUNDARY).failures.map(
            (failure) => failure.code,
          ),
          `${golden.caseId} + ${other.caseId}`,
        ).toContain("STATUS_MISMATCH");
      }
    }
  });

  it.each([
    "Score: 82/99.",
    "Score: 82.5/100.",
    "Score: -82/100.",
    "Score is 100.",
    "Punktzahl: 100 von 100.",
    "Score: one hundred.",
  ])("checks numeric score contradictions: %s", (suffix) => {
    const golden = summaryCase();
    expect(
      evaluateExplanation(
        golden,
        { text: `${deterministicExplanation(golden.source)} ${suffix}` },
        REVIEW_BOUNDARY,
      ).failures.map((failure) => failure.code),
    ).toContain("SCORE_MISMATCH");
  });

  it("requires every summary fact and checks all repeated counts", () => {
    const golden = summaryCase();
    const safe = deterministicExplanation(golden.source);
    for (const omitted of [
      "Deterministic result: Blocked.",
      "Score: 82/100.",
      "Issues: 4;",
      "ready: 3;",
      "incomplete: 0;",
      "blocked: 1.",
    ]) {
      expect(
        evaluateExplanation(
          golden,
          { text: safe.replace(omitted, "") },
          REVIEW_BOUNDARY,
        ).failures.map((failure) => failure.code),
      ).toContain("REQUIRED_ANCHOR_MISSING");
    }
    for (const suffix of [
      "Issues: 5.",
      "ready: 4.",
      "incomplete: 1.",
      "blocked: 0.",
      "rule[no-blocking-links].blocked: 0.",
      "rule[synthetic-new-rule].blocked: 1.",
    ]) {
      expect(
        evaluateExplanation(
          golden,
          { text: `${safe} ${suffix}` },
          REVIEW_BOUNDARY,
        ).failures.map((failure) => failure.code),
      ).toContain("COUNT_MISMATCH");
    }
    expect(
      evaluateExplanation(
        golden,
        { text: `${safe} rule[no-blocking-links].blocked: 1.` },
        REVIEW_BOUNDARY,
      ).passed,
    ).toBe(true);
  });

  it("distinguishes issue totals from labelled subsets and per-rule evidence counts", () => {
    const golden = summaryCase();
    const text =
      "Status: BLOCKED. Score: 82/100. Issues: 4; ready issues: 3; incomplete issues: 0; blocked issues: 1. rule[no-blocker-label].blocked: 0.";
    expect(
      evaluateExplanation(golden, { text }, REVIEW_BOUNDARY).failures,
    ).toEqual([]);
  });

  it("detects denied source status and known unsupported rule facts", () => {
    const golden = summaryCase();
    const safe = deterministicExplanation(golden.source);
    expect(
      evaluateExplanation(
        golden,
        { text: `${safe} Release is not BLOCKED.` },
        REVIEW_BOUNDARY,
      ).failures.map((item) => item.code),
    ).toContain("STATUS_MISMATCH");
    expect(
      evaluateExplanation(
        golden,
        { text: `${safe} A configured blocker label is present.` },
        REVIEW_BOUNDARY,
      ).failures.map((item) => item.code),
    ).toContain("FORBIDDEN_CLAIM_PRESENT");
    expect(
      evaluateExplanation(
        golden,
        { text: `${safe} Unresolved blocking links were found.` },
        REVIEW_BOUNDARY,
      ).passed,
    ).toBe(true);
    expect(
      evaluateExplanation(
        golden,
        { text: `${safe} Release is\napproved.` },
        REVIEW_BOUNDARY,
      ).failures.map((item) => item.code),
    ).toContain("AUTHORITY_CLAIM_PRESENT");
  });

  it.each([
    "<b>text</b>",
    "<script",
    "&lt;script&gt;",
    "&#60;script&#62;",
    "javascript:alert(1)",
    "onerror = 'SYNTHETIC'",
    "```text```",
    "fixVersion in (123)",
    "assignee = currentUser()",
    "ORDER BY updated",
  ])("rejects executable/plain-text violations: %s", (suffix) => {
    const golden = summaryCase();
    expect(
      evaluateExplanation(
        golden,
        { text: `${deterministicExplanation(golden.source)} ${suffix}` },
        REVIEW_BOUNDARY,
      ).failures.map((failure) => failure.code),
    ).toContain("UNSAFE_MARKUP_OR_JQL");
  });

  it("normalizes case, whitespace, compatibility characters and zero-width text", () => {
    const golden = summaryCase();
    const safe = deterministicExplanation(golden.source);
    expect(
      evaluateExplanation(
        golden,
        { text: safe.toUpperCase().replaceAll(" ", "  ") },
        REVIEW_BOUNDARY,
      ).passed,
    ).toBe(true);
    for (const suffix of [
      "Release is ＲＥＡＤＹ.",
      "Release is R\u200BEADY.",
    ]) {
      expect(
        evaluateExplanation(
          golden,
          { text: `${safe} ${suffix}` },
          REVIEW_BOUNDARY,
        ).failures.map((failure) => failure.code),
      ).toContain("STATUS_MISMATCH");
    }
    expect(
      evaluateExplanation(
        golden,
        { text: "\u200B\uFEFF" },
        REVIEW_BOUNDARY,
      ).failures.map((failure) => failure.code),
    ).toContain("EMPTY_OUTPUT");
  });
});

describe("data, side effects and parent boundary", () => {
  it("requires application metadata without repetitive review prose", () => {
    const fixture = SAFE_FIXTURES[0]!;
    for (const boundary of [
      undefined,
      {},
      { ...REVIEW_BOUNDARY, requiresHumanReview: false },
      { ...REVIEW_BOUNDARY, requiresHumanReview: "true" },
    ]) {
      expect(
        evaluateExplanation(
          fixture.golden,
          fixture.candidate,
          boundary,
        ).failures.map((failure) => failure.code),
      ).toContain("HUMAN_REVIEW_BOUNDARY_MISSING");
    }
    expect(
      evaluateExplanation(fixture.golden, fixture.candidate, {
        ...REVIEW_BOUNDARY,
        format: "html",
      }).passed,
    ).toBe(false);
    expect(
      evaluateExplanation(
        fixture.golden,
        { ...fixture.candidate, requiresHumanReview: true },
        REVIEW_BOUNDARY,
      ).failures.map((failure) => failure.code),
    ).toContain("INVALID_OUTPUT_SHAPE");
  });

  it("does not invoke accessor text and rejects hidden keys/prototypes", () => {
    const getter = vi.fn(() => "SYNTHETIC");
    const accessor = Object.defineProperty({}, "text", { get: getter });
    const hidden = Object.defineProperty({ text: "SYNTHETIC" }, "status", {
      value: "READY",
    });
    for (const candidate of [
      accessor,
      hidden,
      { text: "SYNTHETIC", [Symbol("extra")]: true },
      new Date(0),
    ]) {
      expect(
        evaluateExplanation(
          summaryCase(),
          candidate,
          REVIEW_BOUNDARY,
        ).failures.map((failure) => failure.code),
      ).toContain("INVALID_OUTPUT_SHAPE");
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it("bounds original length and never copies provider text or candidate metadata", () => {
    const fixture = SAFE_FIXTURES[0]!;
    const exact = fixture.candidate.text.padEnd(MAX_CANDIDATE_LENGTH, " ");
    expect(
      evaluateExplanation(fixture.golden, { text: exact }, REVIEW_BOUNDARY)
        .passed,
    ).toBe(true);
    expect(
      evaluateExplanation(
        fixture.golden,
        { text: exact + " " },
        REVIEW_BOUNDARY,
      ).failures.map((failure) => failure.code),
    ).toContain("TEXT_TOO_LONG");
    const result = evaluateExplanation(
      summaryCase(),
      { text: "PRIVATE_PROVIDER_SENTINEL DEMO-999 john@example.invalid" },
      REVIEW_BOUNDARY,
    );
    const serialized = JSON.stringify(result);
    for (const secret of [
      "PRIVATE_PROVIDER_SENTINEL",
      "DEMO-999",
      "john@example.invalid",
    ])
      expect(serialized).not.toContain(secret);
    for (const failure of result.failures)
      expect(FAILURE_CODES).toContain(failure.code);
    expect(JSON.stringify(aggregateEvaluation([result]))).not.toContain(
      "PRIVATE_PROVIDER_SENTINEL",
    );
  });

  it("is repeatable and freezes only newly owned results", () => {
    const fixture = structuredClone(SAFE_FIXTURES[0]!);
    const before = structuredClone(fixture);
    const first = evaluateExplanation(
      fixture.golden,
      fixture.candidate,
      REVIEW_BOUNDARY,
    );
    expect(
      evaluateExplanation(fixture.golden, fixture.candidate, REVIEW_BOUNDARY),
    ).toEqual(first);
    expect(fixture).toEqual(before);
    expect(Object.isFrozen(fixture.golden.source)).toBe(false);
    function frozen(value: unknown): void {
      if (typeof value !== "object" || value === null) return;
      expect(Object.isFrozen(value)).toBe(true);
      for (const child of Object.values(value)) frozen(child);
    }
    frozen(GOLDEN_CASES);
    frozen(first);
    frozen(aggregateEvaluation([first]));
  });

  it("does not call network, logs, timers or clock", () => {
    const network = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("Unexpected network");
    });
    const logs = (
      ["log", "info", "warn", "error", "debug", "trace"] as const
    ).map((key) => vi.spyOn(console, key).mockImplementation(() => undefined));
    const time = vi.spyOn(Date, "now");
    const timer = vi.spyOn(globalThis, "setTimeout");
    const random = vi.spyOn(Math, "random");
    const results = [...SAFE_FIXTURES, ...ADVERSARIAL_FIXTURES].map(
      ({ golden, candidate }) =>
        evaluateExplanation(golden, candidate, REVIEW_BOUNDARY),
    );
    aggregateEvaluation(results);
    for (const spy of [network, time, timer, random, ...logs])
      expect(spy).not.toHaveBeenCalled();
  });

  it("keeps SCRUM-83 results intact even when the offline evaluator rejects its text", async () => {
    const result = readinessDto();
    const before = structuredClone(result);
    const provider = new FakeExplanationProvider(() => ({
      text: "The release is approved. Score: 100/100.",
    }));
    const summary = await summarizeRelease(
      { result },
      { enabled: true, provider },
    );
    expect(summary.deterministicResult).toBe(result);
    expect(summary.explanation).toMatchObject(REVIEW_BOUNDARY);
    expect(
      evaluateExplanation(
        summaryCase(),
        { text: summary.explanation.text },
        summary.explanation,
      ).passed,
    ).toBe(false);
    const finding = await explainFinding(
      { result, issueKey: "DEMO-42", ruleId: "acceptance-criteria-present" },
      { enabled: true, provider },
    );
    expect(finding.deterministicResult).toBe(result);
    expect(finding.deterministicFinding).toBe(
      result.results[0]!.evidence.find(
        (item) => item.ruleId === "acceptance-criteria-present",
      ),
    );
    expect(result).toEqual(before);
    expect(Object.isFrozen(result)).toBe(false);
  });
});
