import { APP_ERROR_CODES, AppError } from "./errors";

const ANALYSIS_STAGES = [
  "analysis",
  "load_configuration",
  "list_fields",
  "load_project_metadata",
  "validate_jql",
  "load_version",
  "load_version_issues",
  "load_jql_issues",
  "request_issue_page",
  "evaluate_release",
] as const;

type AnalysisStage = (typeof ANALYSIS_STAGES)[number];
const FAILURE_CHECKS = [
  "search_page",
  "search_issues",
  "issue_core",
  "acceptance_criteria",
  "acceptance_adf",
  "issue_labels",
  "issue_versions",
  "issue_subtasks",
  "issue_links",
  "pagination_is_last",
  "pagination_token",
  "pagination_last_with_token",
  "pagination_missing_token",
  "pagination_repeated_token",
] as const;
type FailureCheck = (typeof FAILURE_CHECKS)[number];
const ADF_REASONS = [
  "invalid_envelope",
  "structure_limit",
  "schema_rejected",
  "validator_type_error",
  "validator_range_error",
  "validator_schema_error",
  "validator_exception",
] as const;
export type AdfFailureReason = (typeof ADF_REASONS)[number];
const ADF_PROBES = ["valid", "rejected", "exception"] as const;
export type AdfValidatorProbe = (typeof ADF_PROBES)[number];
interface FailureContext {
  stage?: AnalysisStage;
  httpStatus?: number;
  check?: FailureCheck;
  adfReason?: AdfFailureReason;
  adfProbe?: AdfValidatorProbe;
}

// Keep diagnostics out of error serialization and resolver response payloads.
// Context belongs to the thrown object, never to shared current-request state.
const contexts = new WeakMap<object, FailureContext>();

function errorObject(error: unknown): Error {
  return error instanceof Error
    ? error
    : new AppError("UNKNOWN_ERROR", "Unexpected operation failure.");
}

export function failureAtCheck(error: Error, check: FailureCheck): Error {
  const context = contexts.get(error);
  contexts.set(error, { ...context, check: context?.check ?? check });
  return error;
}

export function failureAtAdfCheck(
  error: Error,
  reason: AdfFailureReason,
  probe?: AdfValidatorProbe,
): Error {
  failureAtCheck(error, "acceptance_adf");
  contexts.set(error, {
    ...contexts.get(error),
    adfReason: reason,
    ...(probe !== undefined ? { adfProbe: probe } : {}),
  });
  return error;
}

export function withFailureCheck<T>(
  check: FailureCheck,
  operation: () => T,
): T {
  try {
    return operation();
  } catch (error) {
    throw failureAtCheck(errorObject(error), check);
  }
}

export async function withAnalysisStage<T>(
  stage: AnalysisStage,
  operation: () => T | Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const failure = errorObject(error);
    const context = contexts.get(failure);
    contexts.set(failure, { ...context, stage: context?.stage ?? stage });
    throw failure;
  }
}

export async function withHttpStatus<T>(
  httpStatus: number,
  operation: () => T | Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const failure = errorObject(error);
    contexts.set(failure, { ...contexts.get(failure), httpStatus });
    throw failure;
  }
}

export function analysisFailureDiagnostic(error: unknown) {
  const context =
    typeof error === "object" && error !== null
      ? contexts.get(error)
      : undefined;
  const stage = context?.stage;
  const httpStatus = context?.httpStatus;
  const check = context?.check;
  const adfReason = context?.adfReason;
  const adfProbe = context?.adfProbe;
  // Project fields, exception text, URLs, JQL, headers, bodies and stacks are
  // deliberately excluded. Rebuild the event from runtime-checked primitives.
  return {
    event: "releaseproof.analysis_failed",
    code:
      error instanceof AppError && APP_ERROR_CODES.includes(error.code)
        ? error.code
        : "UNKNOWN_ERROR",
    stage:
      stage !== undefined && ANALYSIS_STAGES.includes(stage)
        ? stage
        : "analysis",
    ...(typeof httpStatus === "number" &&
    Number.isInteger(httpStatus) &&
    httpStatus >= 100 &&
    httpStatus <= 599
      ? { httpStatus }
      : {}),
    ...(check !== undefined && FAILURE_CHECKS.includes(check) ? { check } : {}),
    ...(adfReason !== undefined && ADF_REASONS.includes(adfReason)
      ? { adfReason }
      : {}),
    ...(adfProbe !== undefined && ADF_PROBES.includes(adfProbe)
      ? { adfProbe }
      : {}),
  };
}
