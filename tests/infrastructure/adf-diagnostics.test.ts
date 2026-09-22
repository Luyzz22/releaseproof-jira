import { SchemaError, Validator } from "jsonschema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectAdfDocument } from "../../src/infrastructure/jira/adf-to-text";
import { AppError } from "../../src/shared/errors";
import {
  analysisFailureDiagnostic,
  failureAtAdfCheck,
} from "../../src/shared/failure-diagnostics";

afterEach(() => vi.restoreAllMocks());

const document = {
  type: "doc",
  version: 1,
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "SECRET_SYNTHETIC_CRITERIA" }],
    },
  ],
};

describe("ADF failure diagnostics", () => {
  it("accepts valid evidence without running an extra probe", () => {
    const spy = vi.spyOn(Validator.prototype, "validate");
    expect(inspectAdfDocument(document)).toEqual({ valid: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ ...document, version: "1" }, "invalid_envelope"],
    [{ ...document, content: null }, "invalid_envelope"],
    [
      { ...document, content: Array.from({ length: 10_000 }, () => null) },
      "structure_limit",
    ],
  ])(
    "classifies a pre-schema failure without running the validator",
    (value, reason) => {
      const spy = vi.spyOn(Validator.prototype, "validate");
      expect(inspectAdfDocument(value)).toEqual({ valid: false, reason });
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it("distinguishes rejected evidence from a working validator", () => {
    expect(
      inspectAdfDocument({
        ...document,
        content: [{ type: "SECRET_UNSUPPORTED_NODE" }],
      }),
    ).toEqual({ valid: false, reason: "schema_rejected", probe: "valid" });
  });

  it.each([
    [new TypeError("SECRET_MESSAGE"), "validator_type_error"],
    [new RangeError("SECRET_MESSAGE"), "validator_range_error"],
    [
      new SchemaError("SECRET_MESSAGE", { description: "SECRET_SCHEMA" }),
      "validator_schema_error",
    ],
    [new Error("SECRET_MESSAGE"), "validator_exception"],
    [{ name: "TypeError", message: "SECRET_MESSAGE" }, "validator_exception"],
    ["SECRET_PRIMITIVE", "validator_exception"],
  ])(
    "retains fail-closed behavior while classifying exceptions",
    (error, reason) => {
      const spy = vi
        .spyOn(Validator.prototype, "validate")
        .mockImplementationOnce(() => {
          // Exercise a dependency throwing arbitrary data, without logging it.
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw error;
        });
      const result = inspectAdfDocument(document);
      expect(result).toEqual({ valid: false, reason, probe: "valid" });
      expect(spy).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(result)).not.toContain("SECRET");
    },
  );

  it("reports a validator that also fails on the synthetic probe", () => {
    vi.spyOn(Validator.prototype, "validate").mockImplementation(() => {
      throw new TypeError("SECRET_RUNTIME_FAILURE");
    });
    expect(inspectAdfDocument(document)).toEqual({
      valid: false,
      reason: "validator_type_error",
      probe: "exception",
    });
  });

  it("reports a validator that also rejects the synthetic probe", () => {
    const rejected = new Validator().validate(1, { type: "string" });
    vi.spyOn(Validator.prototype, "validate").mockReturnValue(rejected);
    expect(inspectAdfDocument(document)).toEqual({
      valid: false,
      reason: "schema_rejected",
      probe: "rejected",
    });
  });

  it("attaches only constant diagnostics, including to frozen errors", () => {
    const error = Object.freeze(
      new AppError("JIRA_UNAVAILABLE", "SECRET_MESSAGE"),
    );
    expect(failureAtAdfCheck(error, "validator_type_error", "exception")).toBe(
      error,
    );
    expect(analysisFailureDiagnostic(error)).toEqual({
      event: "releaseproof.analysis_failed",
      code: "JIRA_UNAVAILABLE",
      stage: "analysis",
      check: "acceptance_adf",
      adfReason: "validator_type_error",
      adfProbe: "exception",
    });
    expect(JSON.stringify(error)).not.toContain("adfReason");
  });

  it("runtime-checks both diagnostic allowlists", () => {
    const error = new AppError("JIRA_UNAVAILABLE", "SECRET_MESSAGE");
    failureAtAdfCheck(
      error,
      "SECRET_REASON" as Parameters<typeof failureAtAdfCheck>[1],
      "SECRET_PROBE" as Parameters<typeof failureAtAdfCheck>[2],
    );
    expect(analysisFailureDiagnostic(error)).toEqual({
      event: "releaseproof.analysis_failed",
      code: "JIRA_UNAVAILABLE",
      stage: "analysis",
      check: "acceptance_adf",
    });
  });
});
