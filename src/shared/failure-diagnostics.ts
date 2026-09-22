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
  "evaluate_release",
] as const;

type AnalysisStage = (typeof ANALYSIS_STAGES)[number];
interface FailureContext {
  stage?: AnalysisStage;
  httpStatus?: number;
}

// Keep diagnostics out of error serialization and resolver response payloads.
// Context belongs to the thrown object, never to shared current-request state.
const contexts = new WeakMap<object, FailureContext>();

function errorObject(error: unknown): Error {
  return error instanceof Error
    ? error
    : new AppError("UNKNOWN_ERROR", "Unexpected operation failure.");
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
  };
}
