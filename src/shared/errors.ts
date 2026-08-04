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

const PUBLIC_MESSAGES: Record<AppErrorCode, string> = {
  INVALID_INPUT:
    "Die Eingabe ist ungültig. Bitte prüfen Sie die Konfiguration.",
  PROJECT_CONTEXT_MISSING: "Der Jira-Projektkontext ist nicht verfügbar.",
  CONFIG_REQUIRED:
    "Bitte konfigurieren Sie das Projekt, bevor Sie eine Analyse starten.",
  VERSION_NOT_FOUND:
    "Die ausgewählte Jira-Version existiert nicht mehr oder ist nicht zugänglich.",
  PERMISSION_DENIED:
    "Für diese Jira-Daten fehlen die erforderlichen Leseberechtigungen.",
  RATE_LIMITED:
    "Jira begrenzt die Anfragen vorübergehend. Bitte versuchen Sie es später erneut.",
  RESULT_LIMIT_EXCEEDED:
    "Die Datenmenge ist für eine synchrone Analyse zu groß. Bitte verkleinern Sie den Release-Scope.",
  JIRA_UNAVAILABLE: "Jira konnte vorübergehend nicht erreicht werden.",
  STORAGE_UNAVAILABLE:
    "Die Projektkonfiguration konnte vorübergehend nicht gespeichert oder geladen werden.",
  STORAGE_CORRUPT:
    "Die gespeicherte Projektkonfiguration ist ungültig und muss neu gespeichert werden.",
  UNKNOWN_ERROR:
    "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
};

export function toSafeError(error: unknown): SafeError {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: PUBLIC_MESSAGES[error.code],
      ...(error.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: error.retryAfterSeconds }),
    };
  }
  return { code: "UNKNOWN_ERROR", message: PUBLIC_MESSAGES.UNKNOWN_ERROR };
}
