export const APP_ERROR_CODES = [
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
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export interface SafeError {
  code: AppErrorCode;
  message: string;
  retryAfterSeconds?: number;
}

export function toSafeError(error: unknown): SafeError {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.code,
      ...(error.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: error.retryAfterSeconds }),
    };
  }
  return { code: "UNKNOWN_ERROR", message: "UNKNOWN_ERROR" };
}
