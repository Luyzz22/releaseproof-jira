import { describe, expect, it } from "vitest";
import { analyzeRelease } from "../../src/domain/services/analyze-release";
import {
  canAccessAnalysisScreen,
  projectConfigSaveTransition,
  type AnalysisScreen,
  type AnalysisViewState,
} from "../../src/frontend/app-state";
import type { ApiResult } from "../../src/shared/resolver-contract";
import { config, projectConfig, release } from "../fixtures/release";

const analysisScreens: AnalysisScreen[] = ["dashboard", "detail", "report"];

function analyzedViewState(): AnalysisViewState {
  return {
    result: analyzeRelease(
      release(),
      projectConfig,
      "2026-08-04T10:00:00.000Z",
    ),
    selectedIssue: "DEMO-42",
    screen: "detail",
  };
}

describe("App-State nach dem Speichern der Projektkonfiguration", () => {
  it("invalidiert nur nach erfolgreichem Speichern alle alten Analysezugänge", () => {
    const current = analyzedViewState();
    const savedConfig = config({ approvalMarker: "reviewed-by-customer" });
    const success: ApiResult<typeof savedConfig> = {
      ok: true,
      data: savedConfig,
    };

    expect(
      analysisScreens.every((screen) =>
        canAccessAnalysisScreen(current, screen),
      ),
    ).toBe(true);

    const afterSuccess = projectConfigSaveTransition(current, success);

    expect(afterSuccess).toEqual({
      result: null,
      selectedIssue: null,
      screen: "release",
    });
    expect(
      analysisScreens.every(
        (screen) => !canAccessAnalysisScreen(afterSuccess, screen),
      ),
    ).toBe(true);

    const failure: ApiResult<typeof savedConfig> = {
      ok: false,
      error: {
        code: "STORAGE_UNAVAILABLE",
        message: "Die Projektkonfiguration konnte nicht gespeichert werden.",
      },
    };
    const afterFailure = projectConfigSaveTransition(current, failure);

    expect(afterFailure).toBe(current);
    expect(afterFailure.result).toBe(current.result);
    expect(afterFailure.selectedIssue).toBe("DEMO-42");
    expect(
      analysisScreens.every((screen) =>
        canAccessAnalysisScreen(afterFailure, screen),
      ),
    ).toBe(true);
  });
});
