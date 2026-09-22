import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeSafely } from "../../src/resolvers/analyze-safely";
import { AppError } from "../../src/shared/errors";
import {
  withAnalysisStage,
  withHttpStatus,
} from "../../src/shared/failure-diagnostics";

afterEach(() => vi.restoreAllMocks());

describe("analysis diagnostics privacy and compatibility", () => {
  it("logs only allowlisted primitives, preserving the public error and retry delay", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(
      new AppError("RATE_LIMITED", "SECRET_MESSAGE", 45),
      {
        description: "SECRET_DESCRIPTION",
        acceptanceCriteria: "SECRET_CRITERIA",
        comments: ["SECRET_COMMENT"],
        jql: "SECRET_JQL",
        headers: { authorization: "SECRET_TOKEN" },
        cause: new Error("SECRET_CAUSE"),
        body: "SECRET_BODY",
        stack: "SECRET_STACK",
      },
    );
    Object.freeze(error);
    const result = await analyzeSafely(() =>
      withAnalysisStage("load_jql_issues", () =>
        withHttpStatus(429, () => {
          throw error;
        }),
      ),
    );
    expect(log).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({
        event: "releaseproof.analysis_failed",
        code: "RATE_LIMITED",
        stage: "load_jql_issues",
        httpStatus: 429,
      }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: "RATE_LIMITED",
        retryAfterSeconds: 45,
      },
    });
    expect(JSON.stringify([log.mock.calls, result])).not.toContain("SECRET");
  });

  it.each([new Error("SECRET"), "SECRET", { message: "SECRET", status: 403 }])(
    "redacts arbitrary thrown values without inventing an upstream status",
    async (error) => {
      const log = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const result = await analyzeSafely(async () => {
        // Exercise a third-party rejection that is not necessarily an Error.
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw error;
      });
      expect(log).toHaveBeenCalledExactlyOnceWith(
        JSON.stringify({
          event: "releaseproof.analysis_failed",
          code: "UNKNOWN_ERROR",
          stage: "analysis",
        }),
      );
      expect(result).toEqual({
        ok: false,
        error: { code: "UNKNOWN_ERROR", message: "UNKNOWN_ERROR" },
      });
    },
  );

  it("keeps concurrent failures attached to their own operation", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let rejectFirst!: (error: Error) => void;
    const pending = new Promise<never>((_, reject) => {
      rejectFirst = reject;
    });
    const first = analyzeSafely(() =>
      withAnalysisStage("list_fields", () =>
        withHttpStatus(503, () => pending),
      ),
    );
    await analyzeSafely(() =>
      withAnalysisStage("load_version", () =>
        withHttpStatus(404, () => {
          throw new AppError("VERSION_NOT_FOUND", "SECRET");
        }),
      ),
    );
    rejectFirst(new AppError("JIRA_UNAVAILABLE", "SECRET"));
    await first;
    expect(log.mock.calls).toEqual([
      [
        JSON.stringify({
          event: "releaseproof.analysis_failed",
          code: "VERSION_NOT_FOUND",
          stage: "load_version",
          httpStatus: 404,
        }),
      ],
      [
        JSON.stringify({
          event: "releaseproof.analysis_failed",
          code: "JIRA_UNAVAILABLE",
          stage: "list_fields",
          httpStatus: 503,
        }),
      ],
    ]);
  });

  it.each([NaN, Infinity, 99, 600, 200.5])(
    "omits invalid HTTP status %s",
    async (status) => {
      const log = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      await analyzeSafely(() =>
        withHttpStatus(status, () => {
          throw new Error("SECRET");
        }),
      );
      expect(log).toHaveBeenCalledExactlyOnceWith(
        JSON.stringify({
          event: "releaseproof.analysis_failed",
          code: "UNKNOWN_ERROR",
          stage: "analysis",
        }),
      );
    },
  );

  it("does not log successful analysis data", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const data = { summary: "SECRET_RESULT" };
    expect(await analyzeSafely(async () => data)).toEqual({ ok: true, data });
    expect(log).not.toHaveBeenCalled();
  });

  it("returns the existing safe error even if logging throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("Logger failed");
    });
    expect(
      await analyzeSafely(async () => {
        throw new AppError("JIRA_UNAVAILABLE", "SECRET");
      }),
    ).toEqual({
      ok: false,
      error: { code: "JIRA_UNAVAILABLE", message: "JIRA_UNAVAILABLE" },
    });
  });
});
