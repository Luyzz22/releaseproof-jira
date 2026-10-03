import { describe, expect, it, vi } from "vitest";
import { buildEvidenceContractV1 } from "../../src/application/evidence-contract/build-evidence-contract-v1";
import {
  EVIDENCE_OUTCOME_IDS,
  EVIDENCE_RULE_IDS,
  type EvidenceOutcome,
} from "../../src/domain/models/evidence-outcome";
import {
  READINESS_STATUSES,
  RELEASE_SCOPE_MODES,
} from "../../src/domain/models/readiness";
import { readinessRules } from "../../src/domain/rules";
import {
  EVIDENCE_CONTRACT_CATEGORIES,
  EVIDENCE_CONTRACT_OUTCOME_RULES,
  EVIDENCE_CONTRACT_SCOPE_MODES,
  EVIDENCE_CONTRACT_STATUS_COUNTS,
  EvidenceContractV1Error,
  parseEvidenceContractV1,
  serializeEvidenceContractV1,
  type EvidenceContractV1,
} from "../../src/shared/evidence-contract-v1";
import type { ReleaseReadinessResultDto } from "../../src/shared/release-readiness-dto";
import { readinessDto } from "../fixtures/readiness-dto";
import { config, issue, release } from "../fixtures/release";

const profiles = ["SUMMARY_MINIMIZED", "TRACEABLE_INTERNAL"] as const;
const issueKeys = ["SYNTHETIC_A-2", "SYNTHETIC_B-1", "SYNTHETIC_A-10"];
const markers = {
  project: "SYNTHETIC_PROJECT_SECRET",
  version: "SYNTHETIC_VERSION_SECRET",
  jql: "SYNTHETIC_JQL_SECRET",
  summary: "SYNTHETIC_SUMMARY_SECRET",
  issueType: "SYNTHETIC_TYPE_SECRET",
  status: "SYNTHETIC_STATUS_SECRET",
  field: "SYNTHETIC_SOURCE_FIELD_SECRET",
  approval: "SYNTHETIC_APPROVAL_SECRET",
  blocker: "SYNTHETIC_BLOCKER_SECRET",
  versionParam: "SYNTHETIC_VERSION_PARAM_SECRET",
  expectedVersion: "SYNTHETIC_EXPECTED_VERSION_SECRET",
  linkedKey: "SYNTHETIC_LINK-88",
  subtaskKey: "SYNTHETIC_SUBTASK-88",
  findingKey: "SYNTHETIC_FINDING-88",
  generatedAt: "SYNTHETIC_GENERATED_AT_SECRET",
};

const outcomes = [
  { outcomeId: "acceptance-criteria-present/present", params: {} },
  { outcomeId: "acceptance-criteria-present/missing", params: {} },
  {
    outcomeId: "accepted-status/accepted",
    params: { statusName: markers.status },
  },
  {
    outcomeId: "accepted-status/not-accepted",
    params: { statusName: markers.status },
  },
  { outcomeId: "accepted-status/missing", params: {} },
  { outcomeId: "approval-marker-present/disabled", params: {} },
  {
    outcomeId: "approval-marker-present/present",
    params: { approvalMarker: markers.approval },
  },
  {
    outcomeId: "approval-marker-present/missing",
    params: { approvalMarker: markers.approval },
  },
  { outcomeId: "correct-fix-version/version-only", params: {} },
  {
    outcomeId: "correct-fix-version/assigned",
    params: { versionName: markers.versionParam },
  },
  {
    outcomeId: "correct-fix-version/wrong-version",
    params: {
      assignedVersionNames: [markers.versionParam],
      expectedVersionName: markers.expectedVersion,
    },
  },
  {
    outcomeId: "correct-fix-version/missing-version",
    params: { expectedVersionName: markers.expectedVersion },
  },
  { outcomeId: "no-blocker-label/clear", params: {} },
  {
    outcomeId: "no-blocker-label/blocked",
    params: { blockerLabels: [markers.blocker] },
  },
  { outcomeId: "no-blocking-links/clear", params: {} },
  {
    outcomeId: "no-blocking-links/blocked",
    params: { issueKeys: [markers.linkedKey] },
  },
  { outcomeId: "no-open-subtasks/disabled", params: {} },
  { outcomeId: "no-open-subtasks/clear", params: {} },
  {
    outcomeId: "no-open-subtasks/blocked",
    params: { count: 1, issueKeys: [markers.subtaskKey] },
  },
] satisfies EvidenceOutcome[];

// Deliberately non-derived facts: scores and counts must survive verbatim.
function dto(): ReleaseReadinessResultDto {
  return {
    release: {
      projectKey: markers.project,
      versionName: markers.version,
      releaseScopeMode: "JQL_SCOPE",
      releaseScopeJql: markers.jql,
      issues: issueKeys.map((key) => ({
        key,
        summary: markers.summary,
        issueTypeName: markers.issueType,
        statusName: markers.status,
        updatedAt: markers.generatedAt,
      })),
    },
    status: "READY",
    score: 13,
    totalIssues: 3,
    readyIssues: 0,
    incompleteIssues: 1,
    blockedIssues: 2,
    results: issueKeys.map((issueKey, index) => ({
      issueKey,
      status: READINESS_STATUSES[index + 1]!,
      score: 97 - index * 23,
      blockerCount: 91 + index,
      missingEvidenceCount: 82 + index,
      evidence: outcomes.map((outcome, findingIndex) => ({
        ruleId: EVIDENCE_CONTRACT_OUTCOME_RULES[outcome.outcomeId],
        issueKey: markers.findingKey,
        category: "DOCUMENTATION",
        status: READINESS_STATUSES[findingIndex % READINESS_STATUSES.length]!,
        outcome: structuredClone(outcome),
        sourceField: markers.field,
      })),
    })),
    generatedAt: markers.generatedAt,
  };
}

function contract() {
  return buildEvidenceContractV1(dto(), "TRACEABLE_INTERNAL");
}

function frozen<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(frozen);
    Object.freeze(value);
  }
  return value;
}

type Path = readonly (string | number)[];
function at(value: unknown, path: Path): unknown {
  return path.reduce<unknown>(
    (current, key) => (current as Record<string | number, unknown>)[key],
    value,
  );
}
function set(value: unknown, path: Path, replacement: unknown): void {
  const parent = at(value, path.slice(0, -1)) as Record<
    string | number,
    unknown
  >;
  parent[path[path.length - 1]!] = replacement;
}

function rejects(value: unknown): void {
  for (const parse of [parseEvidenceContractV1, serializeEvidenceContractV1]) {
    expect(() => parse(value)).toThrow(EvidenceContractV1Error);
    expect(() => parse(value)).toThrow(/^INVALID_EVIDENCE_CONTRACT_V1$/);
  }
}

const forbiddenKeys = [
  "projectKey",
  "versionName",
  "releaseScopeJql",
  "summary",
  "issueTypeName",
  "statusName",
  "sourceField",
  "params",
  "approvalMarker",
  "blockerLabels",
  "assignedVersionNames",
  "expectedVersionName",
  "generatedAt",
  "description",
  "comments",
  "adf",
  "acceptanceCriteria",
  "labels",
  "accountId",
  "email",
  "users",
];

describe("Evidence Contract v1 coverage and authority", () => {
  it("has exact domain sets, not just the current 7/19/4/2 counts", () => {
    const value = contract();
    const rules = value.rules.map((rule) => rule.ruleId);
    const outcomeIds = value.rules.flatMap((rule) =>
      rule.outcomes.map((outcome) => outcome.outcomeId),
    );
    expect(rules).toEqual(EVIDENCE_RULE_IDS);
    expect(outcomeIds).toEqual(EVIDENCE_OUTCOME_IDS);
    expect(new Set(Object.values(EVIDENCE_CONTRACT_OUTCOME_RULES))).toEqual(
      new Set(EVIDENCE_RULE_IDS),
    );
    expect(new Set(Object.keys(EVIDENCE_CONTRACT_OUTCOME_RULES))).toEqual(
      new Set(EVIDENCE_OUTCOME_IDS),
    );
    expect(new Set(Object.keys(EVIDENCE_CONTRACT_STATUS_COUNTS))).toEqual(
      new Set(READINESS_STATUSES),
    );
    expect(new Set(Object.keys(EVIDENCE_CONTRACT_SCOPE_MODES))).toEqual(
      new Set(RELEASE_SCOPE_MODES),
    );
    expect(outcomes.map((outcome) => outcome.outcomeId)).toEqual(
      EVIDENCE_OUTCOME_IDS,
    );
    expect([
      rules.length,
      outcomeIds.length,
      READINESS_STATUSES.length,
      RELEASE_SCOPE_MODES.length,
    ]).toEqual([7, 19, 4, 2]);
  });

  it("binds every mapped outcome to actual existing domain rule results", () => {
    const candidates = [
      issue(),
      issue({
        hasAcceptanceCriteria: false,
        labels: ["release-blocker"],
        fixVersions: [],
      }),
      issue({
        status: null,
        fixVersions: [{ id: "39999", name: "SYNTHETIC_OTHER_VERSION" }],
      }),
      issue({
        status: { id: "3", name: "SYNTHETIC_STATUS" },
        linkedIssues: [
          {
            id: "1",
            key: "SYNTHETIC_LINK-1",
            relationship: "is blocked by",
            direction: "inward",
            isBlocking: true,
            status: null,
            resolution: null,
          },
        ],
        subtasks: [
          {
            id: "2",
            key: "SYNTHETIC_SUBTASK-1",
            status: null,
            resolution: null,
          },
        ],
      }),
    ];
    const seen = new Set<string>();
    for (const candidate of candidates) {
      for (const settings of [
        config(),
        config({
          releaseScopeMode: "VERSION_ONLY",
          requireApprovalMarker: false,
          blockOnOpenSubtasks: false,
        }),
      ]) {
        for (const rule of readinessRules) {
          const finding = rule.evaluate({
            issue: candidate,
            config: settings,
            release: release([candidate]),
          });
          expect(
            EVIDENCE_CONTRACT_OUTCOME_RULES[finding.outcome.outcomeId],
          ).toBe(finding.ruleId);
          seen.add(finding.outcome.outcomeId);
        }
      }
    }
    expect(seen).toEqual(new Set(EVIDENCE_OUTCOME_IDS));
  });

  it.each(profiles)(
    "copies all supplied facts without recomputation in %s",
    (profile) => {
      const source = dto();
      const value = buildEvidenceContractV1(source, profile);
      expect(value.release).toEqual({
        releaseScopeMode: "JQL_SCOPE",
        status: "READY",
        score: 13,
        totalIssues: 3,
        readyIssues: 0,
        incompleteIssues: 1,
        blockedIssues: 2,
      });
      expect(value.authority).toEqual({
        humanReviewRequired: true,
        releaseAuthorization: "NONE",
      });
      expect(value.schemaVersion).toBe(1);
      expect(value.contract).toBe("releaseproof-evidence");
      expect(value.dataBoundary).toBe(
        profile === "SUMMARY_MINIMIZED" ? "MINIMIZED" : "INTERNAL_ONLY",
      );
      if (value.profile === "TRACEABLE_INTERNAL") {
        for (const result of source.results) {
          const trace = value.issues.find(
            (entry) => entry.issueKey === result.issueKey,
          )!;
          expect({ ...trace, findings: undefined }).toEqual({
            issueKey: result.issueKey,
            status: result.status,
            score: result.score,
            blockerCount: result.blockerCount,
            missingEvidenceCount: result.missingEvidenceCount,
            findings: undefined,
          });
          expect(trace.findings).toEqual(
            result.evidence.map((item) => ({
              ruleId: item.ruleId,
              category: item.category,
              status: item.status,
              outcomeId: item.outcome.outcomeId,
            })),
          );
        }
      }
      expect(value.rules[0]).toEqual({
        ruleId: "acceptance-criteria-present",
        ready: 3,
        incomplete: 3,
        blocked: 0,
        notApplicable: 0,
        outcomes: [
          { outcomeId: "acceptance-criteria-present/present", count: 3 },
          { outcomeId: "acceptance-criteria-present/missing", count: 3 },
        ],
      });
    },
  );

  it.each(READINESS_STATUSES)(
    "accepts supplied %s at release, issue and finding levels",
    (status) => {
      const source = dto();
      source.status = status;
      source.results[0]!.status = status;
      source.results[0]!.evidence[0]!.status = status;
      const value = buildEvidenceContractV1(source, "TRACEABLE_INTERNAL");
      expect(value.release.status).toBe(status);
      expect(
        value.issues.find((entry) => entry.issueKey === issueKeys[0])!.status,
      ).toBe(status);
      expect(parseEvidenceContractV1(value)).toEqual(value);
    },
  );

  it.each(RELEASE_SCOPE_MODES)(
    "accepts %s without transporting JQL",
    (releaseScopeMode) => {
      const source = dto();
      source.release.releaseScopeMode = releaseScopeMode;
      for (const profile of profiles) {
        const value = buildEvidenceContractV1(source, profile);
        expect(value.release.releaseScopeMode).toBe(releaseScopeMode);
        expect(serializeEvidenceContractV1(value)).not.toContain(markers.jql);
      }
    },
  );

  it.each(Object.keys(EVIDENCE_CONTRACT_CATEGORIES))(
    "accepts category %s and preserves it",
    (category) => {
      const value = structuredClone(contract());
      set(value, ["issues", 0, "findings", 0, "category"], category);
      expect(
        at(parseEvidenceContractV1(value), [
          "issues",
          0,
          "findings",
          0,
          "category",
        ]),
      ).toBe(category);
    },
  );

  it.each(profiles)(
    "preserves empty-release status/score and zero aggregates in %s",
    (profile) => {
      const source = dto();
      Object.assign(source, {
        status: "NOT_APPLICABLE",
        score: 37,
        totalIssues: 0,
        readyIssues: 0,
        incompleteIssues: 0,
        blockedIssues: 0,
        results: [],
      });
      source.release.issues = [];
      const value = buildEvidenceContractV1(source, profile);
      expect(value.release).toEqual({
        releaseScopeMode: "JQL_SCOPE",
        status: "NOT_APPLICABLE",
        score: 37,
        totalIssues: 0,
        readyIssues: 0,
        incompleteIssues: 0,
        blockedIssues: 0,
      });
      for (const rule of value.rules) {
        expect([
          rule.ready,
          rule.incomplete,
          rule.blocked,
          rule.notApplicable,
        ]).toEqual([0, 0, 0, 0]);
        expect(rule.outcomes.every((entry) => entry.count === 0)).toBe(true);
      }
      if (value.profile === "TRACEABLE_INTERNAL")
        expect(value.issues).toEqual([]);
    },
  );

  it("handles actual deterministic DTO fixtures for both modes, with zero outcomes retained", () => {
    for (const releaseScopeMode of RELEASE_SCOPE_MODES) {
      const source = readinessDto(
        { ...release(), releaseScopeMode },
        config({ releaseScopeMode }),
      );
      for (const profile of profiles) {
        const value = buildEvidenceContractV1(source, profile);
        expect(value.release.status).toBe(source.status);
        expect(value.release.score).toBe(source.score);
        expect(value.rules.flatMap((rule) => rule.outcomes)).toHaveLength(19);
        expect(parseEvidenceContractV1(value)).toEqual(value);
      }
    }
  });
});

describe("minimization, canonicalization and ownership", () => {
  it.each(profiles)(
    "excludes every forbidden field and sentinel in %s",
    (profile) => {
      const value = buildEvidenceContractV1(dto(), profile);
      const json = serializeEvidenceContractV1(value);
      for (const marker of Object.values(markers))
        expect(json).not.toContain(marker);
      for (const key of forbiddenKeys) expect(json).not.toContain(`"${key}"`);
      if (profile === "SUMMARY_MINIMIZED") {
        expect(json).not.toContain('"issueKey"');
        for (const key of issueKeys) expect(json).not.toContain(key);
      } else {
        for (const key of issueKeys) expect(json).toContain(key);
        expect(
          (
            value as Extract<
              EvidenceContractV1,
              { profile: "TRACEABLE_INTERNAL" }
            >
          ).issues.map((entry) => entry.issueKey),
        ).toEqual(["SYNTHETIC_A-10", "SYNTHETIC_A-2", "SYNTHETIC_B-1"]);
      }
      expect(json).toContain('"status"');
    },
  );

  it.each(profiles)(
    "ignores source array order and generatedAt in %s",
    (profile) => {
      const source = dto();
      const expected = buildEvidenceContractV1(source, profile);
      for (let shift = 0; shift < outcomes.length; shift++) {
        const shuffled = dto();
        shuffled.generatedAt = `SYNTHETIC_OTHER_TIME_${shift}`;
        shuffled.results.reverse();
        shuffled.release.issues.reverse();
        for (const result of shuffled.results) {
          result.evidence = [
            ...result.evidence.slice(shift),
            ...result.evidence.slice(0, shift),
          ].reverse();
        }
        const actual = buildEvidenceContractV1(shuffled, profile);
        expect(actual).toEqual(expected);
        expect(serializeEvidenceContractV1(actual)).toBe(
          serializeEvidenceContractV1(expected),
        );
      }
    },
  );

  it("canonicalizes object key construction without reordering untrusted arrays", () => {
    function reversed(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(reversed);
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value)
            .reverse()
            .map(([key, child]) => [key, reversed(child)]),
        );
      return value;
    }
    const value = contract();
    expect(serializeEvidenceContractV1(reversed(value))).toBe(
      serializeEvidenceContractV1(value),
    );
    expect(
      serializeEvidenceContractV1(
        JSON.parse(serializeEvidenceContractV1(value)) as unknown,
      ),
    ).toBe(serializeEvidenceContractV1(value));
  });

  it("does not change/freeze the source, supports frozen DTOs, and deeply freezes owned output", () => {
    const source = dto();
    const original = structuredClone(source);
    const outputs = profiles.map((profile) =>
      buildEvidenceContractV1(source, profile),
    );
    expect(source).toEqual(original);
    expect(Object.isFrozen(source)).toBe(false);
    expect(Object.isFrozen(source.results[0]!.evidence)).toBe(false);
    function assertFrozen(value: unknown): void {
      if (value && typeof value === "object") {
        expect(Object.isFrozen(value)).toBe(true);
        Object.values(value).forEach(assertFrozen);
      }
    }
    outputs.forEach(assertFrozen);
    for (const [index, profile] of profiles.entries())
      expect(buildEvidenceContractV1(frozen(source), profile)).toEqual(
        outputs[index],
      );
    const callerOwned = structuredClone(outputs[0]);
    const parsed = parseEvidenceContractV1(callerOwned);
    expect(parsed).not.toBe(callerOwned);
    expect(parsed.authority).not.toBe(callerOwned!.authority);
    expect(parsed.release).not.toBe(callerOwned!.release);
    expect(Object.isFrozen(callerOwned)).toBe(false);
    expect(() => {
      (
        parsed.authority as { humanReviewRequired: boolean }
      ).humanReviewRequired = false;
    }).toThrow();
    set(callerOwned, ["release", "score"], 11);
    expect(parsed.release.score).toBe(13);
  });

  it("never reads excluded source display fields, timestamps, or outcome params", () => {
    const source = dto();
    const getter = vi.fn(() => {
      throw new Error("SYNTHETIC_SECRET");
    });
    for (const key of [
      "projectKey",
      "versionName",
      "releaseScopeJql",
      "issues",
    ])
      Object.defineProperty(source.release, key, { get: getter });
    Object.defineProperty(source, "generatedAt", { get: getter });
    for (const result of source.results)
      for (const finding of result.evidence) {
        Object.defineProperty(finding, "sourceField", { get: getter });
        Object.defineProperty(finding, "issueKey", { get: getter });
        Object.defineProperty(finding.outcome, "params", { get: getter });
      }
    for (const profile of profiles)
      expect(() => buildEvidenceContractV1(source, profile)).not.toThrow();
    expect(getter).not.toHaveBeenCalled();
  });
});

describe("strict fail-closed parser and serializer", () => {
  const invalidFields: [string, Path, unknown][] = [
    ["schema 0", ["schemaVersion"], 0],
    ["schema 2", ["schemaVersion"], 2],
    ["contract", ["contract"], "SYNTHETIC_OTHER"],
    ["profile", ["profile"], "UNKNOWN"],
    ["boundary", ["dataBoundary"], "MINIMIZED"],
    ["human review", ["authority", "humanReviewRequired"], false],
    ["authorization", ["authority", "releaseAuthorization"], "APPROVED"],
    ["release status", ["release", "status"], "UNKNOWN"],
    ["scope", ["release", "releaseScopeMode"], "UNKNOWN"],
    ["rule", ["rules", 0, "ruleId"], "UNKNOWN"],
    ["outcome", ["rules", 0, "outcomes", 0, "outcomeId"], "UNKNOWN"],
    [
      "wrong rule outcome",
      ["rules", 0, "outcomes", 0, "outcomeId"],
      "no-blocker-label/clear",
    ],
    ["issue status", ["issues", 0, "status"], "UNKNOWN"],
    ["finding rule", ["issues", 0, "findings", 0, "ruleId"], "UNKNOWN"],
    ["finding status", ["issues", 0, "findings", 0, "status"], "UNKNOWN"],
    ["category", ["issues", 0, "findings", 0, "category"], "UNKNOWN"],
    ["finding outcome", ["issues", 0, "findings", 0, "outcomeId"], "UNKNOWN"],
    [
      "finding outcome wrong rule",
      ["issues", 0, "findings", 0, "outcomeId"],
      "accepted-status/accepted",
    ],
    ["release counter sum", ["release", "totalIssues"], 4],
    ["rule counter sum", ["rules", 0, "ready"], 4],
    ["extra nested field", ["authority", "customer"], "SYNTHETIC_SECRET"],
  ];
  it.each(invalidFields)("rejects %s", (_name, path, replacement) => {
    const value = structuredClone(contract());
    set(value, path, replacement);
    rejects(value);
  });

  it.each([
    ["release", "score"],
    ["issues", 0, "score"],
  ] satisfies Path[])("rejects invalid score at %j", (...path) => {
    for (const invalid of [
      -1,
      101,
      NaN,
      Infinity,
      -Infinity,
      0.5,
      "50",
      null,
      undefined,
      50n,
    ]) {
      const value = structuredClone(contract());
      set(value, path, invalid);
      rejects(value);
    }
  });

  const countPaths: Path[] = [
    ...["totalIssues", "readyIssues", "incompleteIssues", "blockedIssues"].map(
      (key) => ["release", key],
    ),
    ...["ready", "incomplete", "blocked", "notApplicable"].map((key) => [
      "rules",
      0,
      key,
    ]),
    ["rules", 0, "outcomes", 0, "count"],
    ["issues", 0, "blockerCount"],
    ["issues", 0, "missingEvidenceCount"],
  ];
  it.each(countPaths.map((path) => ({ path })))(
    "rejects invalid count at $path",
    ({ path }) => {
      for (const invalid of [
        -1,
        0.5,
        Number.MAX_SAFE_INTEGER + 1,
        NaN,
        Infinity,
        "1",
        null,
      ]) {
        const value = structuredClone(contract());
        set(value, path, invalid);
        rejects(value);
      }
    },
  );

  it("accepts safe integer boundaries and rejects overflow in sums", () => {
    const value = structuredClone(
      buildEvidenceContractV1(dto(), "SUMMARY_MINIMIZED"),
    );
    set(value, ["release", "totalIssues"], Number.MAX_SAFE_INTEGER);
    set(value, ["release", "readyIssues"], Number.MAX_SAFE_INTEGER);
    set(value, ["release", "incompleteIssues"], 0);
    set(value, ["release", "blockedIssues"], 0);
    expect(parseEvidenceContractV1(value).release.totalIssues).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    set(value, ["release", "blockedIssues"], 1);
    rejects(value);
    const overflow = structuredClone(contract());
    set(overflow, ["rules", 0, "ready"], Number.MAX_SAFE_INTEGER);
    rejects(overflow);
  });

  it.each([
    "",
    "customer@example.invalid",
    "SYNTHETIC-1\n",
    " SYNTHETIC-1",
    "SYNTHETIC-1 ",
    "synthetic-1",
    "SYNTHETIC-0.5",
    "SYNTHETIC_COMMENT_TEXT",
  ])("rejects non-key issue reference %j", (issueKey) => {
    const value = structuredClone(contract());
    set(value, ["issues", 0, "issueKey"], issueKey);
    rejects(value);
  });

  it.each([
    ["rules"],
    ["rules", 0, "outcomes"],
    ["issues"],
    ["issues", 0, "findings"],
  ] satisfies Path[])(
    "rejects wrong order and duplicate identities at %j",
    (...path) => {
      const value = structuredClone(contract());
      const list = at(value, path) as unknown[];
      [list[0], list[1]] = [list[1], list[0]];
      rejects(value);
      [list[0], list[1]] = [list[1], list[0]];
      list[1] = structuredClone(list[0]);
      rejects(value);
      list.pop();
      rejects(value);
    },
  );

  it("rejects a duplicate finding even if its category/status differ", () => {
    const value = structuredClone(contract());
    set(value, ["issues", 0, "findings", 1], {
      ...value.issues[0]!.findings[0],
      category: "BLOCKER",
      status: "BLOCKED",
    });
    rejects(value);
  });

  it("checks trace length and trace/aggregate correspondence, not just totals", () => {
    const length = structuredClone(contract());
    set(length, ["issues"], length.issues.slice(1));
    rejects(length);
    const statuses = structuredClone(contract());
    set(statuses, ["rules", 0, "ready"], 2);
    set(statuses, ["rules", 0, "blocked"], 1);
    rejects(statuses);
    const distribution = structuredClone(contract());
    set(distribution, ["rules", 0, "outcomes", 0, "count"], 2);
    set(distribution, ["rules", 0, "outcomes", 1, "count"], 4);
    rejects(distribution);
  });

  it.each(forbiddenKeys)("rejects raw/display field injection %s", (key) => {
    for (const profile of profiles) {
      for (const path of [
        [],
        ["release"],
        ["rules", 0],
        ["rules", 0, "outcomes", 0],
      ]) {
        const value = structuredClone(buildEvidenceContractV1(dto(), profile));
        set(value, [...path, key], "SYNTHETIC_SECRET");
        rejects(value);
      }
    }
    for (const path of [
      ["issues", 0],
      ["issues", 0, "findings", 0],
    ]) {
      const value = structuredClone(contract());
      set(value, [...path, key], "SYNTHETIC_SECRET");
      rejects(value);
    }
  });

  it("rejects TRACEABLE fields inside SUMMARY and a wrong summary boundary", () => {
    for (const [key, value] of [
      ["issues", []],
      ["issueKey", "SYNTHETIC-1"],
      ["dataBoundary", "INTERNAL_ONLY"],
    ]) {
      const summary = structuredClone(
        buildEvidenceContractV1(dto(), "SUMMARY_MINIMIZED"),
      );
      set(summary, [String(key)], value);
      rejects(summary);
    }
  });

  it.each(
    [
      [],
      ["authority"],
      ["release"],
      ["rules", 0],
      ["rules", 0, "outcomes", 0],
      ["issues", 0],
      ["issues", 0, "findings", 0],
    ].map((path) => ({ path })),
  )("requires every declared key at $path", ({ path }) => {
    const value = contract();
    for (const key of Object.keys(at(value, path) as object)) {
      const candidate = structuredClone(value);
      delete (at(candidate, path) as Record<string, unknown>)[key];
      rejects(candidate);
    }
  });

  it("rejects invalid builder input before SUMMARY can discard its trace", () => {
    const source = dto();
    source.results[0]!.evidence[0]!.ruleId = "SYNTHETIC_UNKNOWN_RULE";
    for (const profile of profiles)
      expect(() => buildEvidenceContractV1(source, profile)).toThrow(
        EvidenceContractV1Error,
      );
    expect(() =>
      buildEvidenceContractV1(
        dto(),
        "UNKNOWN" as EvidenceContractV1["profile"],
      ),
    ).toThrow(EvidenceContractV1Error);
  });
});

describe("adversarial data object boundaries", () => {
  const recordPaths = [
    [],
    ["authority"],
    ["release"],
    ["rules", 0],
    ["rules", 0, "outcomes", 0],
    ["issues", 0],
    ["issues", 0, "findings", 0],
  ] satisfies Path[];

  it.each(recordPaths.map((path) => ({ path })))(
    "does not invoke getters and rejects hidden keys/prototypes at $path",
    ({ path }) => {
      for (const attack of [
        "getter",
        "hidden",
        "symbol",
        "prototype",
        "array",
        "null",
      ]) {
        let value: unknown = structuredClone(contract());
        const target = at(value, path) as Record<string, unknown>;
        const getter = vi.fn(() => {
          throw new Error("SYNTHETIC_SECRET");
        });
        if (attack === "getter")
          Object.defineProperty(target, Object.keys(target)[0]!, {
            get: getter,
          });
        if (attack === "hidden")
          Object.defineProperty(target, "SYNTHETIC_SECRET", {
            value: "SYNTHETIC_SECRET",
            enumerable: false,
          });
        if (attack === "symbol")
          Object.defineProperty(target, Symbol("SYNTHETIC_SECRET"), {
            get: getter,
          });
        if (attack === "prototype")
          Object.setPrototypeOf(target, { inherited: "SYNTHETIC_SECRET" });
        if (attack === "array" || attack === "null") {
          const replacement = attack === "array" ? [] : null;
          if (path.length) set(value, path, replacement);
          else value = replacement;
        }
        rejects(value);
        expect(getter).not.toHaveBeenCalled();
      }
    },
  );

  it("permits null-prototype records and reconstructs ordinary owned data", () => {
    const value = structuredClone(contract());
    for (const path of recordPaths)
      Object.setPrototypeOf(at(value, path), null);
    expect(parseEvidenceContractV1(value)).toEqual(contract());
    expect(Object.getPrototypeOf(parseEvidenceContractV1(value))).toBe(
      Object.prototype,
    );
  });

  it.each(
    [
      ["rules"],
      ["rules", 0, "outcomes"],
      ["issues"],
      ["issues", 0, "findings"],
    ].map((path) => ({ path })),
  )("rejects accessor/sparse/decorated/custom arrays at $path", ({ path }) => {
    for (const attack of [
      "getter",
      "sparse",
      "symbol",
      "extra",
      "hidden",
      "prototype",
      "record",
    ]) {
      const value = structuredClone(contract());
      const target = at(value, path) as unknown[];
      const getter = vi.fn(() => {
        throw new Error("SYNTHETIC_SECRET");
      });
      if (attack === "getter")
        Object.defineProperty(target, "0", { get: getter });
      if (attack === "sparse") Reflect.deleteProperty(target, "0");
      if (attack === "symbol")
        Object.defineProperty(target, Symbol.iterator, { get: getter });
      if (attack === "extra")
        Object.defineProperty(target, "extra", {
          value: "SYNTHETIC_SECRET",
          enumerable: true,
        });
      if (attack === "hidden")
        Object.defineProperty(target, "hidden", {
          value: "SYNTHETIC_SECRET",
          enumerable: false,
        });
      if (attack === "prototype") Object.setPrototypeOf(target, null);
      if (attack === "record") set(value, path, { length: target.length });
      rejects(value);
      expect(getter).not.toHaveBeenCalled();
    }
  });

  it("rejects discriminator/toJSON accessors, opaque primitives and proxy exceptions safely", () => {
    const getter = vi.fn(() => {
      throw new Error("SYNTHETIC_SECRET");
    });
    const value = structuredClone(contract());
    Object.defineProperty(value, "profile", { get: getter });
    rejects(value);
    const json = structuredClone(contract());
    Object.defineProperty(json, "toJSON", { get: getter });
    rejects(json);
    for (const primitive of [
      null,
      undefined,
      true,
      1,
      "SYNTHETIC_SECRET",
      [],
      () => "SYNTHETIC_SECRET",
    ])
      rejects(primitive);
    rejects(
      new Proxy(
        {},
        {
          getOwnPropertyDescriptor() {
            throw new Error("SYNTHETIC_SECRET");
          },
        },
      ),
    );
    expect(getter).not.toHaveBeenCalled();
  });
});
