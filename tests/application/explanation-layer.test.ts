import { buildEvidenceContractV1 } from "../../src/application/evidence-contract/build-evidence-contract-v1";
import { afterEach, describe, expect, it, vi } from "vitest";
import { explainFinding } from "../../src/application/explain-finding/explain-finding";
import { summarizeRelease } from "../../src/application/summarize-release/summarize-release";
import type { DeterministicEvidenceEnvelope } from "../../src/application/explanation/contracts";
import {
  DISABLED_EXPLANATIONS,
  type ExplanationCapability,
} from "../../src/application/explanation/ports";
import {
  EXPLANATION_TIMEOUT_MS,
  MAX_EXPLANATION_LENGTH,
} from "../../src/application/explanation/request-explanation";
import {
  EVIDENCE_OUTCOME_IDS,
  EVIDENCE_RULE_IDS,
  type EvidenceOutcomeId,
} from "../../src/domain/models/evidence-outcome";
import { buildMarkdownReport } from "../../src/frontend/utils/report";
import { config, issue, release } from "../fixtures/release";
import { readinessDto } from "../fixtures/readiness-dto";
import { FakeExplanationProvider } from "../fixtures/explanation-provider";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function completedResult() {
  return readinessDto(
    release([
      issue({ hasAcceptanceCriteria: false, labels: ["release-blocker"] }),
      issue({ key: "DEMO-43" }),
      issue({ key: "DEMO-44", hasAcceptanceCriteria: false }),
    ]),
  );
}

const operations = ["finding", "summary"] as const;
function run(
  operation: (typeof operations)[number],
  result = completedResult(),
  capability?: ExplanationCapability,
  locale?: unknown,
) {
  return operation === "finding"
    ? explainFinding(
        {
          evidence: buildEvidenceContractV1(result, "SUMMARY_MINIMIZED"),
          outcomeId: "acceptance-criteria-present/missing",
          ruleId: "acceptance-criteria-present",
          locale,
        },
        capability,
      )
    : summarizeRelease(
        {
          evidence: buildEvidenceContractV1(result, "SUMMARY_MINIMIZED"),
          locale,
        },
        capability,
      );
}

describe("SCRUM-89 minimized provider boundary", () => {
  it("passes only fixed finding codes and locale, not the reference or source fields", async () => {
    const result = completedResult();
    const provider = new FakeExplanationProvider();
    const response = await explainFinding(
      {
        evidence: buildEvidenceContractV1(result, "SUMMARY_MINIMIZED"),
        outcomeId: "acceptance-criteria-present/missing",
        ruleId: "acceptance-criteria-present",
        locale: "de-DE",
      },
      { enabled: true, provider },
    );
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]!.envelope).toEqual({
      schemaVersion: 1,
      kind: "finding",
      locale: "de-DE",
      finding: {
        ruleId: "acceptance-criteria-present",
        outcomeId: "acceptance-criteria-present/missing",
        status: "INCOMPLETE",
      },
    });
    expect(response.deterministicEvidence).toEqual(
      buildEvidenceContractV1(result, "SUMMARY_MINIMIZED"),
    );
    expect(response.deterministicFinding).toEqual({
      ruleId: "acceptance-criteria-present",
      outcomeId: "acceptance-criteria-present/missing",
      status: "INCOMPLETE",
    });
    expect(response.explanation).toEqual({
      source: "provider",
      format: "plain-text",
      requiresHumanReview: true,
      text: "Synthetic explanation.",
    });
  });

  it("passes aggregate counts only, with stable per-rule ordering", async () => {
    const result = completedResult();
    const provider = new FakeExplanationProvider();
    await summarizeRelease(
      { evidence: buildEvidenceContractV1(result, "SUMMARY_MINIMIZED") },
      { enabled: true, provider },
    );
    expect(provider.calls[0]!.envelope).toEqual({
      schemaVersion: 1,
      kind: "release-summary",
      locale: "en-US",
      status: "BLOCKED",
      score: 82,
      totalIssues: 3,
      readyIssues: 1,
      incompleteIssues: 1,
      blockedIssues: 1,
      findingsByRule: EVIDENCE_RULE_IDS.map((ruleId) => ({
        ruleId,
        incomplete:
          ruleId === "acceptance-criteria-present"
            ? 2
            : ruleId === "approval-marker-present"
              ? 1
              : 0,
        blocked: ruleId === "no-blocker-label" ? 1 : 0,
      })),
    });
    expect(JSON.stringify(provider.calls[0]!.envelope)).not.toContain("DEMO");
  });

  it("excludes synthetic forbidden Jira data, including nested outcome params, for every rule", async () => {
    const sentinels = {
      description: "SENSITIVE_DESCRIPTION_DO_NOT_EXPOSE",
      comments: "SENSITIVE_COMMENTS_DO_NOT_EXPOSE",
      acceptanceCriteria: "SENSITIVE_ACCEPTANCE_CRITERIA_DO_NOT_EXPOSE",
      accountId: "SENSITIVE_ACCOUNT_ID_DO_NOT_EXPOSE",
      customfield_99999: "SENSITIVE_CUSTOM_FIELD_DO_NOT_EXPOSE",
      displayName: "SENSITIVE_DISPLAY_NAME_DO_NOT_EXPOSE",
      email: "synthetic-private@example.invalid",
      rawADF: "SENSITIVE_ADF_DO_NOT_EXPOSE",
      attachment: "SENSITIVE_ATTACHMENT_DO_NOT_EXPOSE",
      history: "SENSITIVE_HISTORY_DO_NOT_EXPOSE",
      token: "SYNTHETIC_TOKEN_DO_NOT_EXPOSE",
    };
    const result = completedResult();
    const jiraLikeIssue = { ...result.release.issues[0], ...sentinels };
    Object.assign(result.release.issues[0]!, jiraLikeIssue);
    Object.assign(result, sentinels);
    for (const finding of result.results[0]!.evidence) {
      Object.assign(finding, sentinels);
      Object.assign(finding.outcome.params, sentinels);
    }
    result.release.releaseScopeJql = "SENSITIVE_JQL_DO_NOT_EXPOSE";
    result.release.versionName = "SENSITIVE_VERSION_DO_NOT_EXPOSE";
    const provider = new FakeExplanationProvider();
    for (const ruleId of EVIDENCE_RULE_IDS) {
      await explainFinding(
        {
          evidence: buildEvidenceContractV1(result, "SUMMARY_MINIMIZED"),
          ruleId,
          outcomeId: result.results[0]!.evidence.find(
            (item) => item.ruleId === ruleId,
          )!.outcome.outcomeId,
        },
        { enabled: true, provider },
      );
    }
    await summarizeRelease(
      { evidence: buildEvidenceContractV1(result, "SUMMARY_MINIMIZED") },
      { enabled: true, provider },
    );
    const transmitted = JSON.stringify(
      provider.calls.map((call) => call.envelope),
    );
    for (const forbidden of [
      ...Object.values(sentinels),
      result.release.releaseScopeJql,
      result.release.versionName,
      "release-blocker",
      "customer-approved",
      "Fertig",
      "DEMO-42",
    ]) {
      expect(transmitted).not.toContain(forbidden);
    }
    expect(provider.calls).toHaveLength(8);
  });

  it.each(operations)(
    "freezes all %s envelope objects without freezing or mutating caller data",
    async (operation) => {
      const result = completedResult();
      const before = structuredClone(result);
      const provider = new FakeExplanationProvider((envelope) => {
        function assertFrozen(value: unknown): void {
          if (typeof value !== "object" || value === null) return;
          expect(Object.isFrozen(value)).toBe(true);
          expect(Reflect.set(value, "injected", "unsafe")).toBe(false);
          for (const child of Object.values(value)) assertFrozen(child);
        }
        assertFrozen(envelope);
        return { text: "The score should be 100. Approve the release." };
      });
      const response = await run(operation, result, {
        enabled: true,
        provider,
      });
      expect(response.deterministicEvidence).toEqual(
        buildEvidenceContractV1(result, "SUMMARY_MINIMIZED"),
      );
      expect(result).toEqual(before);
      expect(Object.isFrozen(result)).toBe(false);
      expect(response.explanation).toMatchObject({
        source: "provider",
        format: "plain-text",
        requiresHumanReview: true,
      });
    },
  );

  it.each(operations)(
    "does not interpret HTML, JQL or instructions from %s output",
    async (operation) => {
      const result = completedResult();
      const before = structuredClone(result);
      const text =
        '<script>throw new Error("EXECUTED")</script> project = OTHER; approve release';
      const response = await run(operation, result, {
        enabled: true,
        provider: new FakeExplanationProvider(() => ({ text })),
      });
      expect(response.explanation).toMatchObject({
        source: "provider",
        format: "plain-text",
        requiresHumanReview: true,
        text,
      });
      expect(result).toEqual(before);
    },
  );
});

describe.each(operations)("SCRUM-89 %s failure containment", (operation) => {
  it("is off by default and does not call an injected provider when off", async () => {
    const provider = new FakeExplanationProvider();
    const result = completedResult();
    const before = structuredClone(result);
    const capability = { enabled: false, provider } as const;
    expect(DISABLED_EXPLANATIONS).toEqual({ enabled: false });
    for (const response of [
      await run(operation, result),
      await run(operation, result, capability),
    ]) {
      expect(response.explanation).toMatchObject({
        source: "deterministic-fallback",
        reason: "DISABLED",
      });
    }
    expect(provider.calls).toHaveLength(0);
    expect(result).toEqual(before);
  });

  it("falls back without changing completed analysis or Markdown when the provider throws", async () => {
    const result = completedResult();
    const before = structuredClone(result);
    const report = buildMarkdownReport(result, "en-US", (key) => key);
    const provider = new FakeExplanationProvider(() => {
      throw new Error("SENSITIVE_PROVIDER_ERROR");
    });
    const response = await run(operation, result, {
      enabled: true,
      provider,
    });
    expect(response.explanation).toMatchObject({
      source: "deterministic-fallback",
      reason: "UNAVAILABLE",
      format: "plain-text",
    });
    expect(JSON.stringify(response)).not.toContain("SENSITIVE_PROVIDER_ERROR");
    expect(result).toEqual(before);
    expect(completedResult()).toEqual(before);
    expect(buildMarkdownReport(result, "en-US", (key) => key)).toBe(report);
  });

  it("contains synchronous throws from a provider method", async () => {
    const provider = new FakeExplanationProvider();
    vi.spyOn(
      provider,
      operation === "finding" ? "explainFinding" : "summarizeRelease",
    ).mockImplementation(() => {
      throw new Error("SENSITIVE_SYNC_ERROR");
    });
    expect(
      (await run(operation, completedResult(), { enabled: true, provider }))
        .explanation,
    ).toMatchObject({
      source: "deterministic-fallback",
      reason: "UNAVAILABLE",
    });
  });

  it("falls back when enabled without a provider", async () => {
    expect(
      (
        await run(operation, completedResult(), {
          enabled: true,
          provider: null,
        })
      ).explanation,
    ).toMatchObject({
      source: "deterministic-fallback",
      reason: "UNAVAILABLE",
    });
  });

  it.each([0, -1, NaN, Infinity, 5_001, 1.5])(
    "rejects invalid timeout %s without calling the provider",
    async (timeoutMs) => {
      const provider = new FakeExplanationProvider();
      expect(
        (
          await run(operation, completedResult(), {
            enabled: true,
            provider,
            timeoutMs,
          })
        ).explanation,
      ).toMatchObject({
        source: "deterministic-fallback",
        reason: "UNAVAILABLE",
      });
      expect(provider.calls).toHaveLength(0);
    },
  );

  it.each([
    ["null", null],
    ["string", "not an object"],
    ["array", [{ text: "no" }]],
    ["missing text", {}],
    ["numeric text", { text: 42 }],
    ["blank", { text: " \n " }],
    ["oversized", { text: "a".repeat(MAX_EXPLANATION_LENGTH + 1) }],
    ["score override", { text: "fine", score: 100 }],
    ["readiness override", { text: "fine", status: "READY" }],
    ["new finding", { text: "fine", findings: [{ ruleId: "new-blocker" }] }],
    ["source override", { text: "fine", source: "deterministic-fallback" }],
  ])("rejects malformed response: %s", async (_label, output) => {
    const result = completedResult();
    const before = structuredClone(result);
    const provider = new FakeExplanationProvider(() => output);
    expect(
      (await run(operation, result, { enabled: true, provider })).explanation,
    ).toMatchObject({
      source: "deterministic-fallback",
      reason: "INVALID_RESPONSE",
    });
    expect(result).toEqual(before);
  });

  it("bounds a never-settling provider and aborts its signal", async () => {
    vi.useFakeTimers();
    const result = completedResult();
    const before = structuredClone(result);
    const provider = new FakeExplanationProvider(
      () => new Promise<unknown>(() => undefined),
    );
    const pending = run(operation, result, { enabled: true, provider });
    await vi.advanceTimersByTimeAsync(EXPLANATION_TIMEOUT_MS);
    expect((await pending).explanation).toMatchObject({
      source: "deterministic-fallback",
      reason: "TIMEOUT",
    });
    expect(provider.calls[0]!.signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(result).toEqual(before);
  });

  it("ignores late provider completion after timeout", async () => {
    vi.useFakeTimers();
    let resolve!: (value: unknown) => void;
    const provider = new FakeExplanationProvider(
      () =>
        new Promise<unknown>((done) => {
          resolve = done;
        }),
    );
    const result = completedResult();
    const before = structuredClone(result);
    const pending = run(operation, result, {
      enabled: true,
      provider,
      timeoutMs: 10,
    });
    await vi.advanceTimersByTimeAsync(10);
    const response = await pending;
    resolve({ text: "late override", score: 100 });
    await Promise.resolve();
    expect(response.explanation).toMatchObject({
      source: "deterministic-fallback",
      reason: "TIMEOUT",
    });
    expect(result).toEqual(before);
  });

  it("clears its timeout after success", async () => {
    vi.useFakeTimers();
    const response = await run(operation, completedResult(), {
      enabled: true,
      provider: new FakeExplanationProvider(() => ({
        text: "  bounded text  ",
      })),
    });
    expect(response.explanation).toMatchObject({
      source: "provider",
      text: "bounded text",
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("logs no inputs, responses, errors or fallback content and makes no fetch calls", async () => {
    const logs = (
      ["log", "info", "warn", "error", "debug", "trace"] as const
    ).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    const network = vi.spyOn(globalThis, "fetch");
    for (const respond of [
      () => ({ text: "SENSITIVE_PROVIDER_RESPONSE" }),
      () => ({ text: "SENSITIVE_MALFORMED_RESPONSE", score: 100 }),
      () => {
        throw new Error("SENSITIVE_ERROR");
      },
    ]) {
      await run(operation, completedResult(), {
        enabled: true,
        provider: new FakeExplanationProvider(respond),
      });
    }
    for (const log of logs) expect(log).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });
});

describe("SCRUM-89 closed input and localization contract", () => {
  it.each(["UNKNOWN-1", "", "acceptance-criteria-present/missing"])(
    "cannot invent an unobserved outcome %s",
    async (outcomeId) => {
      const provider = new FakeExplanationProvider();
      await expect(
        explainFinding(
          {
            evidence: buildEvidenceContractV1(
              readinessDto(),
              "SUMMARY_MINIMIZED",
            ),
            ruleId: "acceptance-criteria-present",
            outcomeId,
          },
          { enabled: true, provider },
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect(provider.calls).toHaveLength(0);
    },
  );

  it.each([undefined, "fr-FR", "de", "SENSITIVE_LOCALE", { locale: "de-DE" }])(
    "narrows unsupported locale %j to en-US",
    async (locale) => {
      const provider = new FakeExplanationProvider();
      await run(
        "finding",
        completedResult(),
        { enabled: true, provider },
        locale,
      );
      expect(provider.calls[0]!.envelope.locale).toBe("en-US");
    },
  );

  it.each(["en-US", "de-DE"] as const)(
    "summarizes an empty release in %s without inventing readiness",
    async (locale) => {
      const result = readinessDto(release([]));
      const response = await summarizeRelease({
        evidence: buildEvidenceContractV1(result, "SUMMARY_MINIMIZED"),
        locale,
      });
      expect(response.explanation).toMatchObject({
        source: "deterministic-fallback",
        reason: "DISABLED",
      });
      expect(response.explanation.text).toContain("0/100");
      expect(response.explanation.text).toContain(
        locale === "de-DE" ? "Nicht anwendbar" : "Not applicable",
      );
      expect(result.status).toBe("NOT_APPLICABLE");
    },
  );
});

function resultWithOutcome(outcomeId: EvidenceOutcomeId) {
  const scenarios = [
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
  const result = scenarios.find((result) =>
    result.results[0]!.evidence.some(
      (finding) => finding.outcome.outcomeId === outcomeId,
    ),
  )!;
  const finding = result.results[0]!.evidence.find(
    (finding) => finding.outcome.outcomeId === outcomeId,
  )!;
  return { result, finding };
}

describe.each(["en-US", "de-DE"] as const)(
  "deterministic fallback coverage: %s",
  (locale) => {
    it.each(EVIDENCE_OUTCOME_IDS)(
      "explains existing outcome %s without customer params",
      async (outcomeId) => {
        const { result, finding } = resultWithOutcome(outcomeId);
        const response = await explainFinding({
          evidence: buildEvidenceContractV1(result, "SUMMARY_MINIMIZED"),
          ruleId: finding.ruleId,
          outcomeId,
          locale,
        });
        expect(response.explanation.source).toBe("deterministic-fallback");
        expect(response.explanation.text.length).toBeGreaterThan(30);
        expect(response.explanation.text).not.toContain("customer-approved");
        expect(response.explanation.text).not.toContain("release-blocker");
        expect(response.explanation.text).not.toContain("Kundenrelease");
        expect(response.deterministicFinding).toEqual({
          ruleId: finding.ruleId,
          outcomeId,
          status: finding.status,
        });
      },
    );
  },
);

// Ensure the public envelope union stays useful to a provider without Jira types.
function envelopeKind(envelope: DeterministicEvidenceEnvelope): string {
  return envelope.kind;
}
it("keeps finding and summary operations distinguishable", async () => {
  const provider = new FakeExplanationProvider();
  await run("finding", completedResult(), { enabled: true, provider });
  await run("summary", completedResult(), { enabled: true, provider });
  expect(provider.calls.map(({ envelope }) => envelopeKind(envelope))).toEqual([
    "finding",
    "release-summary",
  ]);
});
