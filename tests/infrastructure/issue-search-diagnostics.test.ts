import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectIssueSearchPages,
  parseResponse,
} from "../../src/infrastructure/jira/forge-jira-gateway";
import { analyzeSafely } from "../../src/resolvers/analyze-safely";
import { AppError } from "../../src/shared/errors";
import {
  analysisFailureDiagnostic,
  failureAtCheck,
  withAnalysisStage,
} from "../../src/shared/failure-diagnostics";

afterEach(() => vi.restoreAllMocks());

const input = {
  jql: "project = DEMO",
  projectKey: "DEMO",
  acceptanceCriteriaFieldId: "description",
};
function page(overrides: Record<string, unknown> = {}) {
  return {
    isLast: true,
    issues: [
      {
        id: "1",
        key: "DEMO-1",
        fields: {
          summary: "SYNTHETIC_PRIVATE_SUMMARY",
          issuetype: { id: "1", name: "Story" },
          status: { id: "1", name: "Done" },
          description: null,
          labels: [],
          fixVersions: [],
          subtasks: [],
          issuelinks: [],
          ...overrides,
        },
      },
    ],
  };
}

async function diagnose(loadPage: () => Promise<unknown>) {
  return analyzeSafely(() =>
    withAnalysisStage("load_jql_issues", () =>
      collectIssueSearchPages(input, loadPage),
    ),
  );
}

describe("issue search failure checkpoints", () => {
  it.each([
    ["issue_core", { summary: null }],
    ["issue_core", { status: { id: "broken", name: "SECRET_STATUS" } }],
    ["acceptance_criteria", { description: "SECRET_DESCRIPTION" }],
    ["acceptance_criteria", { description: undefined }],
    [
      "acceptance_adf",
      {
        description: {
          type: "doc",
          version: 1,
          content: [{ type: "SECRET_UNSUPPORTED_NODE" }],
        },
      },
    ],
    ["issue_labels", { labels: [42, "SECRET_LABEL"] }],
    [
      "issue_versions",
      { fixVersions: [{ id: "invalid", name: "SECRET_VERSION" }] },
    ],
    [
      "issue_subtasks",
      { subtasks: [{ id: "2", key: "DEMO-2", fields: { status: null } }] },
    ],
    ["issue_links", { issuelinks: [{ description: "SECRET_LINK" }] }],
  ] satisfies Array<[string, Record<string, unknown>]>)(
    "attributes %s without emitting field data",
    async (check, fields) => {
      const log = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      expect(await diagnose(async () => page(fields))).toEqual({
        ok: false,
        error: { code: "JIRA_UNAVAILABLE", message: "JIRA_UNAVAILABLE" },
      });
      expect(log).toHaveBeenCalledExactlyOnceWith(
        JSON.stringify({
          event: "releaseproof.analysis_failed",
          code: "JIRA_UNAVAILABLE",
          stage: "load_jql_issues",
          check,
        }),
      );
    },
  );

  it.each([
    ["search_page", null],
    ["search_issues", { isLast: true, issues: {} }],
    ["issue_core", { isLast: true, issues: [null] }],
    ["pagination_is_last", { issues: [] }],
    ["pagination_token", { isLast: false, nextPageToken: 42, issues: [] }],
    [
      "pagination_last_with_token",
      { isLast: true, nextPageToken: "SECRET_TOKEN", issues: [] },
    ],
    ["pagination_missing_token", { isLast: false, issues: [] }],
  ] satisfies Array<[string, unknown]>)(
    "distinguishes %s from issue field failures",
    async (check, payload) => {
      const log = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      await diagnose(async () => payload);
      expect(log).toHaveBeenCalledExactlyOnceWith(
        JSON.stringify({
          event: "releaseproof.analysis_failed",
          code: "JIRA_UNAVAILABLE",
          stage: "load_jql_issues",
          check,
        }),
      );
    },
  );

  it("still rejects repeated pagination tokens and logs no partial results", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const loadPage = vi.fn(async () => ({
      ...page(),
      isLast: false,
      nextPageToken: "SECRET_TOKEN",
    }));
    const result = await diagnose(loadPage);
    expect(loadPage).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      ok: false,
      error: { code: "JIRA_UNAVAILABLE", message: "JIRA_UNAVAILABLE" },
    });
    expect(log).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({
        event: "releaseproof.analysis_failed",
        code: "JIRA_UNAVAILABLE",
        stage: "load_jql_issues",
        check: "pagination_repeated_token",
      }),
    );
  });

  it("distinguishes request failure from response validation without inferring an HTTP status", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await diagnose(async () => {
      throw new AppError("JIRA_UNAVAILABLE", "SECRET_REQUEST");
    });
    expect(log).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({
        event: "releaseproof.analysis_failed",
        code: "JIRA_UNAVAILABLE",
        stage: "request_issue_page",
      }),
    );
  });

  it("retains the real HTTP status on a rejected search request", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const json = vi.fn(async () => ({ message: "SECRET_BODY" }));
    await diagnose(() =>
      parseResponse({
        ok: false,
        status: 403,
        headers: { get: () => null },
        json,
      }),
    );
    expect(json).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({
        event: "releaseproof.analysis_failed",
        code: "PERMISSION_DENIED",
        stage: "request_issue_page",
        httpStatus: 403,
      }),
    );
  });

  it("does not accept an arbitrary runtime checkpoint value for logging", () => {
    const failure = failureAtCheck(
      new AppError("JIRA_UNAVAILABLE", "SECRET_MESSAGE"),
      "SECRET_CHECK" as Parameters<typeof failureAtCheck>[1],
    );
    expect(analysisFailureDiagnostic(failure)).toEqual({
      event: "releaseproof.analysis_failed",
      code: "JIRA_UNAVAILABLE",
      stage: "analysis",
    });
  });

  it("returns successful issue data without logging it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await diagnose(async () => page())).toMatchObject({
      ok: true,
      data: [{ key: "DEMO-1" }],
    });
    expect(log).not.toHaveBeenCalled();
  });
});
