import { describe, expect, it } from "vitest";
import {
  RELEASE_SCOPE_JQL_MAX_LENGTH,
  validateProjectConfigInput,
  validateReleaseScopeJql,
  type ProjectConfigInput,
} from "../../src/shared/validation";

const validInput: ProjectConfigInput = {
  projectId: "10000",
  projectKey: "DEMO",
  releaseScopeMode: "JQL_SCOPE",
  releaseScopeJql: "project = DEMO AND key = DEMO-42",
  acceptedStatusIds: ["31"],
  acceptanceCriteriaFieldId: "customfield_10042",
  blockerLabels: ["release-blocker"],
  includedIssueTypes: ["10001"],
  requireApprovalMarker: true,
  approvalMarker: "customer-approved",
  blockOnOpenSubtasks: true,
};

function expectFailure(
  value: unknown,
  expected: Record<string, unknown>,
): void {
  const result = validateProjectConfigInput(value);
  expect(result.valid).toBe(false);
  if (!result.valid) {
    expect(result.failure).toMatchObject(expected);
  }
}

describe("Project configuration code-first validation", () => {
  it("returns a stable code when an approval marker is required", () => {
    expectFailure(
      { ...validInput, approvalMarker: "" },
      { code: "APPROVAL_MARKER_REQUIRED" },
    );
  });

  it("returns a stable code when JQL scope has no query", () => {
    const withoutJql = { ...validInput };
    delete withoutJql.releaseScopeJql;

    expectFailure(withoutJql, { code: "RELEASE_SCOPE_JQL_REQUIRED" });
  });

  it("returns a stable code when VERSION_ONLY receives a JQL query", () => {
    expectFailure(
      { ...validInput, releaseScopeMode: "VERSION_ONLY" },
      { code: "RELEASE_SCOPE_JQL_FORBIDDEN" },
    );
  });

  it("preserves the nested JQL code and reason as structured data", () => {
    expectFailure(
      { ...validInput, releaseScopeJql: "project = DEMO AND" },
      {
        code: "RELEASE_SCOPE_JQL_INVALID",
        validation: {
          valid: false,
          code: "SYNTAX_INVALID",
          reason: "UNSUPPORTED_SYNTAX",
        },
      },
    );
  });

  it.each([
    [
      "accepted statuses required",
      { acceptedStatusIds: [] },
      { code: "ACCEPTED_STATUSES_REQUIRED" },
    ],
    [
      "accepted statuses limit",
      {
        acceptedStatusIds: Array.from(
          { length: 101 },
          (_, index) => `${index}`,
        ),
      },
      { code: "ACCEPTED_STATUSES_LIMIT_EXCEEDED", maxItems: 100 },
    ],
    [
      "included issue types required",
      { includedIssueTypes: [] },
      { code: "INCLUDED_ISSUE_TYPES_REQUIRED" },
    ],
    [
      "included issue types limit",
      {
        includedIssueTypes: Array.from(
          { length: 101 },
          (_, index) => `${index}`,
        ),
      },
      { code: "INCLUDED_ISSUE_TYPES_LIMIT_EXCEEDED", maxItems: 100 },
    ],
    [
      "acceptance criteria field ID",
      { acceptanceCriteriaFieldId: "invalid field" },
      { code: "ACCEPTANCE_CRITERIA_FIELD_INVALID" },
    ],
    [
      "empty blocker label",
      { blockerLabels: ["   "] },
      { code: "BLOCKER_LABEL_INVALID" },
    ],
    [
      "blocker label length",
      { blockerLabels: ["x".repeat(256)] },
      { code: "BLOCKER_LABEL_TOO_LONG", maxLength: 255 },
    ],
    [
      "blocker labels limit",
      { blockerLabels: Array.from({ length: 51 }, () => "blocker") },
      { code: "BLOCKER_LABELS_LIMIT_EXCEEDED", maxItems: 50 },
    ],
    [
      "approval marker length",
      { approvalMarker: "x".repeat(256) },
      { code: "APPROVAL_MARKER_TOO_LONG", maxLength: 255 },
    ],
  ] as const)(
    "classifies %s without prose matching",
    (_case, override, expected) => {
      expectFailure({ ...validInput, ...override }, expected);
    },
  );

  it("falls back to a generic code for structural/internal failures", () => {
    expectFailure(
      { ...validInput, projectId: "not-a-jira-id" },
      { code: "INVALID_CONFIGURATION" },
    );
  });

  it("returns parsed data for valid input", () => {
    expect(validateProjectConfigInput(validInput)).toEqual({
      valid: true,
      data: validInput,
    });
  });
});

describe("Release scope JQL semantic failures", () => {
  it("returns EMPTY", () => {
    const result = validateReleaseScopeJql("", "DEMO");

    expect(result).toEqual({
      valid: false,
      code: "EMPTY",
    });
    expect(result).not.toHaveProperty("message");
  });

  it("returns TOO_LONG with its parameter", () => {
    const result = validateReleaseScopeJql(
      `project = DEMO AND summary ~ "${"x".repeat(RELEASE_SCOPE_JQL_MAX_LENGTH)}"`,
      "DEMO",
    );

    expect(result).toEqual({
      valid: false,
      code: "TOO_LONG",
      maxLength: RELEASE_SCOPE_JQL_MAX_LENGTH,
    });
    expect(result).not.toHaveProperty("message");
  });

  it("distinguishes an unclosed string", () => {
    const result = validateReleaseScopeJql(
      'project = DEMO AND summary ~ "open',
      "DEMO",
    );

    expect(result).toEqual({
      valid: false,
      code: "SYNTAX_INVALID",
      reason: "UNCLOSED_STRING",
    });
    expect(result).not.toHaveProperty("message");
  });

  it("distinguishes an invalid bare token", () => {
    expect(
      validateReleaseScopeJql("project = DEMO AND status = foo;bar", "DEMO"),
    ).toEqual({
      valid: false,
      code: "SYNTAX_INVALID",
      reason: "INVALID_BARE_TOKEN",
    });
  });

  it("distinguishes generally unsupported syntax", () => {
    expect(validateReleaseScopeJql("project = DEMO AND", "DEMO")).toEqual({
      valid: false,
      code: "SYNTAX_INVALID",
      reason: "UNSUPPORTED_SYNTAX",
    });
  });

  it.each([
    [
      "OR_FORBIDDEN",
      "project = DEMO OR key = DEMO-42",
      { code: "OR_FORBIDDEN" },
    ],
    [
      "FIX_VERSION_FORBIDDEN",
      "project = DEMO AND fixVersion = 10000",
      { code: "FIX_VERSION_FORBIDDEN" },
    ],
    [
      "PROJECT_REQUIRED prefix",
      "key = DEMO-42",
      { code: "PROJECT_REQUIRED", reason: "PROJECT_PREFIX_REQUIRED" },
    ],
    [
      "PROJECT_REQUIRED additional project",
      "project = DEMO AND project = DEMO",
      { code: "PROJECT_REQUIRED", reason: "ADDITIONAL_PROJECT_REFERENCE" },
    ],
    [
      "PROJECT_MISMATCH",
      "project = OTHER AND key = OTHER-42",
      { code: "PROJECT_MISMATCH", expectedProjectKey: "DEMO" },
    ],
  ] as const)("returns stable semantics for %s", (_case, jql, expected) => {
    const result = validateReleaseScopeJql(jql, "DEMO");
    expect(result).toMatchObject({
      valid: false,
      ...expected,
    });
    expect(result).not.toHaveProperty("message");
  });

  it("keeps valid input valid", () => {
    expect(
      validateReleaseScopeJql("project = DEMO AND key = DEMO-42", "DEMO"),
    ).toEqual({ valid: true });
  });
});
