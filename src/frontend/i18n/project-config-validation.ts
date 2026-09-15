import type {
  ProjectConfigValidationFailure,
  ReleaseScopeJqlValidationFailure,
} from "../../shared/validation";
import type { TranslationFunction } from "./context";
import { I18N_KEYS } from "./keys";

type InterpolationParameters = Readonly<Record<string, string | number>>;

function interpolate(
  template: string,
  parameters: InterpolationParameters,
): string {
  return template.replace(
    /\{([A-Za-z][A-Za-z0-9]*)\}/g,
    (match: string, name: string) =>
      Object.hasOwn(parameters, name) ? String(parameters[name]) : match,
  );
}

function localizedFallback(t: TranslationFunction): string {
  return t(
    I18N_KEYS.projectConfigurationValidationFallback,
    "Check the project configuration.",
  );
}

function unexpectedFailure(_failure: never, t: TranslationFunction): string {
  return localizedFallback(t);
}

function localizeProjectRequiredReason(
  reason: "PROJECT_PREFIX_REQUIRED" | "ADDITIONAL_PROJECT_REFERENCE",
  t: TranslationFunction,
): string {
  switch (reason) {
    case "PROJECT_PREFIX_REQUIRED":
      return t(
        I18N_KEYS.projectConfigurationValidationReleaseScopeProjectRequired,
      );
    case "ADDITIONAL_PROJECT_REFERENCE":
      return t(
        I18N_KEYS.projectConfigurationValidationReleaseScopeAdditionalProjectReference,
      );
    default:
      return unexpectedFailure(reason, t);
  }
}

function localizeSyntaxReason(
  reason: "UNCLOSED_STRING" | "INVALID_BARE_TOKEN" | "UNSUPPORTED_SYNTAX",
  t: TranslationFunction,
): string {
  switch (reason) {
    case "UNCLOSED_STRING":
      return t(
        I18N_KEYS.projectConfigurationValidationReleaseScopeUnclosedString,
      );
    case "INVALID_BARE_TOKEN":
      return t(
        I18N_KEYS.projectConfigurationValidationReleaseScopeInvalidBareToken,
      );
    case "UNSUPPORTED_SYNTAX":
      return t(
        I18N_KEYS.projectConfigurationValidationReleaseScopeSyntaxInvalid,
      );
    default:
      return unexpectedFailure(reason, t);
  }
}

function localizeReleaseScopeJqlFailure(
  validation: ReleaseScopeJqlValidationFailure,
  t: TranslationFunction,
): string {
  switch (validation.code) {
    case "EMPTY":
      return t(I18N_KEYS.projectConfigurationValidationReleaseScopeEmpty);
    case "TOO_LONG":
      return interpolate(
        t(I18N_KEYS.projectConfigurationValidationReleaseScopeTooLong),
        { maxLength: validation.maxLength },
      );
    case "FIX_VERSION_FORBIDDEN":
      return t(
        I18N_KEYS.projectConfigurationValidationReleaseScopeFixVersionForbidden,
      );
    case "OR_FORBIDDEN":
      return t(I18N_KEYS.projectConfigurationValidationReleaseScopeOrForbidden);
    case "PROJECT_MISMATCH":
      return interpolate(
        t(I18N_KEYS.projectConfigurationValidationReleaseScopeProjectMismatch),
        { expectedProjectKey: validation.expectedProjectKey },
      );
    case "PROJECT_REQUIRED":
      return localizeProjectRequiredReason(validation.reason, t);
    case "SYNTAX_INVALID":
      return localizeSyntaxReason(validation.reason, t);
    default:
      return unexpectedFailure(validation, t);
  }
}

export function localizeProjectConfigValidationFailure(
  failure: ProjectConfigValidationFailure,
  t: TranslationFunction,
): string {
  switch (failure.code) {
    case "INVALID_CONFIGURATION":
      return localizedFallback(t);
    case "ACCEPTED_STATUSES_REQUIRED":
      return t(
        I18N_KEYS.projectConfigurationValidationAcceptedStatusesRequired,
      );
    case "ACCEPTED_STATUSES_LIMIT_EXCEEDED":
      return interpolate(
        t(
          I18N_KEYS.projectConfigurationValidationAcceptedStatusesLimitExceeded,
        ),
        { maxItems: failure.maxItems },
      );
    case "INCLUDED_ISSUE_TYPES_REQUIRED":
      return t(
        I18N_KEYS.projectConfigurationValidationIncludedIssueTypesRequired,
      );
    case "INCLUDED_ISSUE_TYPES_LIMIT_EXCEEDED":
      return interpolate(
        t(
          I18N_KEYS.projectConfigurationValidationIncludedIssueTypesLimitExceeded,
        ),
        { maxItems: failure.maxItems },
      );
    case "ACCEPTANCE_CRITERIA_FIELD_INVALID":
      return t(I18N_KEYS.projectConfigurationValidationUnsupportedField);
    case "BLOCKER_LABEL_INVALID":
      return t(I18N_KEYS.projectConfigurationValidationBlockerLabelInvalid);
    case "BLOCKER_LABEL_TOO_LONG":
      return interpolate(
        t(I18N_KEYS.projectConfigurationValidationBlockerLabelTooLong),
        { maxLength: failure.maxLength },
      );
    case "BLOCKER_LABELS_LIMIT_EXCEEDED":
      return interpolate(
        t(I18N_KEYS.projectConfigurationValidationBlockerLabelsLimitExceeded),
        { maxItems: failure.maxItems },
      );
    case "APPROVAL_MARKER_REQUIRED":
      return t(I18N_KEYS.projectConfigurationValidationApprovalMarkerRequired);
    case "APPROVAL_MARKER_TOO_LONG":
      return interpolate(
        t(I18N_KEYS.projectConfigurationValidationApprovalMarkerTooLong),
        { maxLength: failure.maxLength },
      );
    case "RELEASE_SCOPE_JQL_FORBIDDEN":
      return t(
        I18N_KEYS.projectConfigurationValidationReleaseScopeJqlForbidden,
      );
    case "RELEASE_SCOPE_JQL_REQUIRED":
      return t(I18N_KEYS.projectConfigurationValidationReleaseScopeJqlRequired);
    case "RELEASE_SCOPE_JQL_INVALID":
      return localizeReleaseScopeJqlFailure(failure.validation, t);
    default:
      return unexpectedFailure(failure, t);
  }
}
