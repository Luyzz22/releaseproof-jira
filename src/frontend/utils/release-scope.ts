import type { ReleaseScopeMode } from "../../domain/models/readiness";
import type { TranslationFunction } from "../i18n/context";
import { I18N_KEYS } from "../i18n/keys";

interface ReleaseScopeDescriptor {
  projectKey: string;
  releaseScopeMode: ReleaseScopeMode;
  releaseScopeJql?: string;
}

function interpolate(
  template: string,
  params: Readonly<Record<string, string>>,
): string {
  return template.replace(
    /\{([A-Za-z][A-Za-z0-9]*)\}/g,
    (placeholder, name: string) => params[name] ?? placeholder,
  );
}

export function releaseScopeModeLabelForLocale(
  mode: ReleaseScopeMode,
  t: TranslationFunction,
): string {
  return t(
    mode === "JQL_SCOPE"
      ? I18N_KEYS.releaseScopeModeJqlScope
      : I18N_KEYS.releaseScopeModeVersionOnly,
  );
}

export function releaseScopeExplanationForLocale(
  release: ReleaseScopeDescriptor,
  t: TranslationFunction,
): string {
  if (release.releaseScopeMode === "JQL_SCOPE") {
    return release.releaseScopeJql ?? t(I18N_KEYS.releaseScopeExplicitProject);
  }

  return interpolate(t(I18N_KEYS.releaseScopeVersionOnlyExplanation), {
    projectKey: release.projectKey,
  });
}
