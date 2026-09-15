import type { AppErrorCode } from "../../shared/errors";
import { I18N_KEYS, type I18nKey } from "./keys";

const ERROR_MESSAGE_KEYS = {
  INVALID_INPUT: I18N_KEYS.errorInvalidInput,
  PROJECT_CONTEXT_MISSING: I18N_KEYS.errorProjectContextMissing,
  CONFIG_REQUIRED: I18N_KEYS.errorConfigRequired,
  VERSION_NOT_FOUND: I18N_KEYS.errorVersionNotFound,
  PERMISSION_DENIED: I18N_KEYS.errorPermissionDenied,
  RATE_LIMITED: I18N_KEYS.errorRateLimited,
  RESULT_LIMIT_EXCEEDED: I18N_KEYS.errorResultLimitExceeded,
  JIRA_UNAVAILABLE: I18N_KEYS.errorJiraUnavailable,
  STORAGE_UNAVAILABLE: I18N_KEYS.errorStorageUnavailable,
  STORAGE_CORRUPT: I18N_KEYS.errorStorageCorrupt,
  UNKNOWN_ERROR: I18N_KEYS.errorUnknown,
} satisfies Record<AppErrorCode, I18nKey>;

const ERROR_DEFAULT_MESSAGES = {
  INVALID_INPUT: "The input is invalid. Check the configuration.",
  PROJECT_CONTEXT_MISSING: "The Jira project context is unavailable.",
  CONFIG_REQUIRED: "Configure the project before starting an analysis.",
  VERSION_NOT_FOUND:
    "The selected Jira version no longer exists or is not accessible.",
  PERMISSION_DENIED:
    "You do not have the required Jira permissions for this action.",
  RATE_LIMITED: "Jira is temporarily limiting requests. Try again later.",
  RESULT_LIMIT_EXCEEDED:
    "The data set is too large for a synchronous analysis. Reduce the release scope.",
  JIRA_UNAVAILABLE: "Jira is temporarily unavailable.",
  STORAGE_UNAVAILABLE:
    "The project configuration could not be saved or loaded temporarily.",
  STORAGE_CORRUPT:
    "The stored project configuration is invalid and must be saved again.",
  UNKNOWN_ERROR: "An unexpected error occurred. Try again.",
} satisfies Record<AppErrorCode, string>;

export function appErrorMessageKey(code: AppErrorCode): I18nKey {
  return ERROR_MESSAGE_KEYS[code];
}

export function appErrorDefaultMessage(code: AppErrorCode): string {
  return ERROR_DEFAULT_MESSAGES[code];
}
