import type { ProjectConfig } from "../domain/models/readiness";
import type { ApiResult, BootstrapData } from "../shared/resolver-contract";
import type { ReleaseReadinessResultDto } from "../shared/release-readiness-dto";

export type AppScreen =
  "empty" | "config" | "release" | "dashboard" | "detail" | "report";

export type AnalysisScreen = Extract<
  AppScreen,
  "dashboard" | "detail" | "report"
>;

export interface AnalysisViewState {
  result: ReleaseReadinessResultDto | null;
  selectedIssue: string | null;
  screen: AppScreen;
}

export function projectConfigSaveTransition(
  current: AnalysisViewState,
  response: ApiResult<ProjectConfig>,
): AnalysisViewState {
  if (!response.ok) return current;

  return {
    result: null,
    selectedIssue: null,
    screen: "release",
  };
}

export function projectConfigDataSaveTransition(
  current: BootstrapData,
  response: ApiResult<ProjectConfig>,
): BootstrapData {
  if (!response.ok) return current;

  return {
    ...current,
    config: response.data,
    configRecoveryRequired: false,
  };
}

export function canAccessAnalysisScreen(
  state: Pick<AnalysisViewState, "result" | "selectedIssue">,
  screen: AnalysisScreen,
): boolean {
  if (!state.result) return false;
  return screen !== "detail" || state.selectedIssue !== null;
}
