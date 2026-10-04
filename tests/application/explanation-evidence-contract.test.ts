import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { buildEvidenceContractV1 } from "../../src/application/evidence-contract/build-evidence-contract-v1";
import { explainFinding } from "../../src/application/explain-finding/explain-finding";
import { summarizeRelease } from "../../src/application/summarize-release/summarize-release";
import {
  findingEnvelope,
  releaseEnvelope,
} from "../../src/application/explanation/evidence-envelope";
import {
  parseEvidenceContractV1,
  EVIDENCE_CONTRACT_MAX_ISSUES,
  type SummaryEvidenceContractV1,
} from "../../src/shared/evidence-contract-v1";
import {
  EVIDENCE_OUTCOME_IDS,
  EVIDENCE_RULE_IDS,
} from "../../src/domain/models/evidence-outcome";
import { READINESS_STATUSES } from "../../src/domain/models/readiness";
import { readinessDto } from "../fixtures/readiness-dto";
import { FakeExplanationProvider } from "../fixtures/explanation-provider";
import { GOLDEN_CASES, FINDING_DEFINITIONS } from "../ai-eval/golden-set";
import { GOLDEN_SET_VERSION } from "../ai-eval/contracts";
import { syntheticSummary } from "../ai-eval/evidence-contract-fixtures";

afterEach(() => vi.restoreAllMocks());

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

function valid(): Mutable<SummaryEvidenceContractV1> {
  return structuredClone(
    buildEvidenceContractV1(readinessDto(), "SUMMARY_MINIMIZED"),
  ) as Mutable<SummaryEvidenceContractV1>;
}

function invoke(
  kind: "finding" | "summary",
  evidence: unknown,
  provider: FakeExplanationProvider,
  enabled = true,
) {
  const capability = enabled
    ? { enabled: true as const, provider }
    : { enabled: false as const };
  return kind === "finding"
    ? explainFinding(
        {
          evidence,
          ruleId: "acceptance-criteria-present",
          outcomeId: "acceptance-criteria-present/present",
        },
        capability,
      )
    : summarizeRelease({ evidence }, capability);
}

const invalidCases: readonly [string, () => unknown][] = [
  ["legacy DTO", () => readinessDto()],
  [
    "traceable internal",
    () => buildEvidenceContractV1(readinessDto(), "TRACEABLE_INTERNAL"),
  ],
  ["null", () => null],
  ["array", () => []],
  ["future version", () => ({ ...valid(), schemaVersion: 2 })],
  ["wrong contract", () => ({ ...valid(), contract: "other" })],
  ["wrong profile", () => ({ ...valid(), profile: "SUMMARY" })],
  [
    "wrong data boundary",
    () => ({ ...valid(), dataBoundary: "INTERNAL_ONLY" }),
  ],
  ["issue trace on summary", () => ({ ...valid(), issues: [] })],
  [
    "unknown customer field",
    () => ({ ...valid(), customerText: "PRIVATE_SENTINEL" }),
  ],
  [
    "authority override",
    () => ({
      ...valid(),
      authority: {
        humanReviewRequired: false,
        releaseAuthorization: "APPROVED",
      },
    }),
  ],
  [
    "missing rule",
    () => {
      const x = valid();
      x.rules.pop();
      return x;
    },
  ],
  [
    "duplicate rule",
    () => {
      const x = valid();
      x.rules[1] = x.rules[0]!;
      return x;
    },
  ],
  [
    "noncanonical order",
    () => {
      const x = valid();
      x.rules.reverse();
      return x;
    },
  ],
  [
    "contradictory status counts",
    () => {
      const x = valid();
      x.rules[0]!.ready = 0;
      x.rules[0]!.blocked = 1;
      return x;
    },
  ],
  [
    "duplicate outcome",
    () => {
      const x = valid();
      x.rules[0]!.outcomes[1] = x.rules[0]!.outcomes[0]!;
      return x;
    },
  ],
  [
    "wrong rule/outcome membership",
    () => {
      const x = valid();
      x.rules[0]!.outcomes[0]!.outcomeId = "no-blocker-label/clear";
      return x;
    },
  ],
  [
    "outcome params",
    () => {
      const x = valid();
      Object.assign(x.rules[0]!.outcomes[0]!, {
        params: { label: "PRIVATE_SENTINEL" },
      });
      return x;
    },
  ],
  [
    "sourceField",
    () => {
      const x = valid();
      Object.assign(x.rules[0]!, { sourceField: "PRIVATE_SENTINEL" });
      return x;
    },
  ],
  [
    "release counter mismatch",
    () => {
      const x = valid();
      x.release.totalIssues = 2;
      return x;
    },
  ],
  [
    "oversized total",
    () => {
      const x = valid();
      x.release.totalIssues = EVIDENCE_CONTRACT_MAX_ISSUES + 1;
      x.release.readyIssues = x.release.totalIssues;
      return x;
    },
  ],
  [
    "unknown status",
    () => ({
      ...valid(),
      release: { ...valid().release, status: "PRIVATE_SENTINEL" },
    }),
  ],
  [
    "unknown scope",
    () => ({
      ...valid(),
      release: { ...valid().release, releaseScopeMode: "other" },
    }),
  ],
  [
    "hidden field",
    () =>
      Object.defineProperty(valid(), "private", { value: "PRIVATE_SENTINEL" }),
  ],
  [
    "symbol field",
    () => ({ ...valid(), [Symbol("private")]: "PRIVATE_SENTINEL" }),
  ],
  [
    "custom prototype",
    () => {
      const x = valid();
      Object.setPrototypeOf(x, { private: "PRIVATE_SENTINEL" });
      return x;
    },
  ],
  ...[NaN, Infinity, -1, 101, 2.5].map((score): [string, () => unknown] => [
    `invalid score ${score}`,
    () => ({ ...valid(), release: { ...valid().release, score } }),
  ]),
];

describe.each(["finding", "summary"] as const)(
  "SCRUM-89 %s contract boundary",
  (kind) => {
    it.each(invalidCases)(
      "rejects %s before enabled or disabled orchestration",
      async (_label, make) => {
        const provider = new FakeExplanationProvider();
        for (const enabled of [false, true]) {
          await expect(
            invoke(kind, make(), provider, enabled),
          ).rejects.toMatchObject({
            code: "INVALID_INPUT",
            message:
              "A valid minimized evidence summary with an existing outcome is required.",
          });
        }
        expect(provider.calls).toHaveLength(0);
      },
    );

    it("does not invoke getters at any accepted nesting level or inspect a rejected trace", async () => {
      const getter = vi.fn(() => {
        throw new Error("PRIVATE_SENTINEL");
      });
      const evidence = valid();
      const candidates = [
        Object.defineProperty(valid(), "profile", {
          get: getter,
          enumerable: true,
        }),
        Object.defineProperty(valid(), "release", {
          get: getter,
          enumerable: true,
        }),
        {
          ...valid(),
          release: Object.defineProperty({ ...evidence.release }, "score", {
            get: getter,
            enumerable: true,
          }),
        },
        {
          ...valid(),
          rules: Object.defineProperty([...evidence.rules], "0", {
            get: getter,
            enumerable: true,
          }),
        },
        Object.defineProperty({ profile: "TRACEABLE_INTERNAL" }, "issues", {
          get: getter,
          enumerable: true,
        }),
      ];
      const provider = new FakeExplanationProvider();
      for (const candidate of candidates)
        await expect(invoke(kind, candidate, provider)).rejects.toMatchObject({
          code: "INVALID_INPUT",
        });
      expect(getter).not.toHaveBeenCalled();
      expect(provider.calls).toHaveLength(0);
    });

    it("snapshots and freezes owned facts before asynchronous work, without retaining caller references", async () => {
      const evidence = valid();
      const before = structuredClone(evidence);
      const provider = new FakeExplanationProvider((envelope) => {
        expect(Object.isFrozen(envelope)).toBe(true);
        return { text: "Synthetic explanation." };
      });
      const pending = invoke(kind, evidence, provider);
      evidence.release.score = 11;
      evidence.rules[0]!.outcomes[0]!.count = 0;
      const response = await pending;
      expect(response.deterministicEvidence).toEqual(before);
      expect(response.deterministicEvidence).not.toBe(evidence);
      expect(response.deterministicEvidence.release).not.toBe(evidence.release);
      expect(Object.isFrozen(evidence)).toBe(false);
      function frozen(value: unknown): void {
        if (value === null || typeof value !== "object") return;
        expect(Object.isFrozen(value)).toBe(true);
        for (const child of Object.values(value)) frozen(child);
      }
      frozen(response);
      frozen(provider.calls[0]!.envelope);
      expect(JSON.stringify(provider.calls[0]!.envelope)).not.toContain(
        "issueKey",
      );
    });
  },
);

it.each([
  ["unknown-rule", "acceptance-criteria-present/present"],
  ["acceptance-criteria-present", "unknown-outcome"],
  ["accepted-status", "acceptance-criteria-present/present"],
  ["acceptance-criteria-present", "acceptance-criteria-present/missing"],
  ["__proto__", "constructor"],
])(
  "rejects an absent or mismatched outcome selection %s / %s",
  async (ruleId, outcomeId) => {
    const provider = new FakeExplanationProvider();
    await expect(
      explainFinding(
        { evidence: valid(), ruleId, outcomeId },
        { enabled: true, provider },
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(provider.calls).toHaveLength(0);
  },
);

it.each([0, 9_999, 10_000])(
  "preserves accepted release facts at %i issues without recomputing readiness",
  async (totalIssues) => {
    for (const status of READINESS_STATUSES) {
      const evidence = syntheticSummary({
        releaseScopeMode: "JQL_SCOPE",
        status,
        score: 37,
        totalIssues,
        readyIssues: totalIssues,
        incompleteIssues: 0,
        blockedIssues: 0,
      });
      const provider = new FakeExplanationProvider();
      const response = await summarizeRelease(
        { evidence },
        { enabled: true, provider },
      );
      expect(response.deterministicEvidence.release).toEqual(evidence.release);
      expect(provider.calls[0]!.envelope).toMatchObject({
        status,
        score: 37,
        totalIssues,
      });
    }
  },
);

it("constructs all versioned golden cases through validated summaries and the real adapter", () => {
  expect(GOLDEN_SET_VERSION).toBe(2);
  expect(GOLDEN_CASES).toHaveLength(
    EVIDENCE_OUTCOME_IDS.length * 2 + READINESS_STATUSES.length * 2,
  );
  for (const golden of GOLDEN_CASES) {
    expect(parseEvidenceContractV1(golden.evidence)).toEqual(golden.evidence);
    expect(golden.evidence.profile).toBe("SUMMARY_MINIMIZED");
    expect(golden.evidence.rules.map((rule) => rule.ruleId)).toEqual(
      EVIDENCE_RULE_IDS,
    );
    const source = golden.source;
    const rebuilt =
      source.kind === "finding"
        ? findingEnvelope(golden.evidence, source.finding, source.locale)
            .envelope
        : releaseEnvelope(golden.evidence, source.locale).envelope;
    expect(rebuilt).toEqual(source);
    if (source.kind === "finding") {
      expect(source.finding.status).toBe(
        FINDING_DEFINITIONS[source.finding.outcomeId].status,
      );
      const observed = golden.evidence.rules
        .find((rule) => rule.ruleId === source.finding.ruleId)!
        .outcomes.find(
          (outcome) => outcome.outcomeId === source.finding.outcomeId,
        )!;
      expect(observed.count).toBeGreaterThan(0);
    }
  }
});

it.each([
  "src/shared/evidence-contract-v1.ts",
  "src/application/evidence-contract/build-evidence-contract-v1.ts",
])("preserves the independently reviewed SCRUM-88 runtime: %s", (file) => {
  expect(readFileSync(file)).toEqual(
    execFileSync("git", [
      "show",
      `43957889f17151ff13613789e49532d076ac0a27:${file}`,
    ]),
  );
});
