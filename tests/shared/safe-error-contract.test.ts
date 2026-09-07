import { describe, expect, it } from "vitest";
import {
  APP_ERROR_CODES,
  AppError,
  toSafeError,
  type AppErrorCode,
} from "../../src/shared/errors";

const expectedCodes: readonly AppErrorCode[] = [
  "INVALID_INPUT",
  "PROJECT_CONTEXT_MISSING",
  "CONFIG_REQUIRED",
  "VERSION_NOT_FOUND",
  "PERMISSION_DENIED",
  "RATE_LIMITED",
  "RESULT_LIMIT_EXCEEDED",
  "JIRA_UNAVAILABLE",
  "STORAGE_UNAVAILABLE",
  "STORAGE_CORRUPT",
  "UNKNOWN_ERROR",
];

describe("SafeError code-first compatibility contract", () => {
  it("keeps the public AppErrorCode list stable", () => {
    expect(APP_ERROR_CODES).toEqual(expectedCodes);
  });

  it.each(APP_ERROR_CODES)(
    "serializes %s as a language-neutral compatibility token",
    (code) => {
      const safe = toSafeError(
        new AppError(code, "INTERNAL_DIAGNOSTIC_SENTINEL"),
      );

      expect(safe).toEqual({ code, message: code });
      expect(safe.message).not.toContain("INTERNAL_DIAGNOSTIC_SENTINEL");
    },
  );

  it("redacts unknown exception diagnostics", () => {
    expect(toSafeError(new Error("UNKNOWN_INTERNAL_SENTINEL"))).toEqual({
      code: "UNKNOWN_ERROR",
      message: "UNKNOWN_ERROR",
    });
  });

  it("preserves retryAfterSeconds without exposing diagnostics", () => {
    expect(
      toSafeError(new AppError("RATE_LIMITED", "INTERNAL_SENTINEL", 45)),
    ).toEqual({
      code: "RATE_LIMITED",
      message: "RATE_LIMITED",
      retryAfterSeconds: 45,
    });
  });
});
