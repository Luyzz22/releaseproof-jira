import { describe, expect, it } from "vitest";
import {
  canAccessAnalysisScreen,
  projectConfigDataSaveTransition,
  projectConfigSaveTransition,
  type AnalysisScreen,
  type AnalysisViewState,
} from "../../src/frontend/app-state";
import type {
  ApiResult,
  BootstrapData,
} from "../../src/shared/resolver-contract";
import { config, projectConfig, release } from "../fixtures/release";
import { readinessDto } from "../fixtures/readiness-dto";

const analysisScreens: AnalysisScreen[] = ["dashboard", "detail", "report"];

function analyzedViewState(): AnalysisViewState {
  return {
    result: readinessDto(release(), projectConfig, "2026-08-04T10:00:00.000Z"),
    selectedIssue: "DEMO-42",
    screen: "detail",
  };
}

function recoveryBootstrapData(): BootstrapData {
  return {
    siteUrl: "https://demo.atlassian.net",
    project: { id: "10000", key: "DEMO", name: "Demoagentur" },
    statuses: [{ id: "31", name: "Fertig" }],
    issueTypes: [{ id: "10001", name: "Story", subtask: false }],
    fields: [
      {
        id: "customfield_10042",
        name: "Akzeptanzkriterien",
        custom: true,
        schemaType: "string",
      },
    ],
    versions: [],
    config: null,
    configRecoveryRequired: true,
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

  it("entfernt den Recovery-Zustand nur nach erfolgreichem Speichern", () => {
    const current = recoveryBootstrapData();
    const savedConfig = config();

    const afterSuccess = projectConfigDataSaveTransition(current, {
      ok: true,
      data: savedConfig,
    });
    expect(afterSuccess).toMatchObject({
      config: savedConfig,
      configRecoveryRequired: false,
    });

    const afterFailure = projectConfigDataSaveTransition(current, {
      ok: false,
      error: {
        code: "STORAGE_UNAVAILABLE",
        message: "Die Projektkonfiguration konnte nicht gespeichert werden.",
      },
    });
    expect(afterFailure).toBe(current);
    expect(afterFailure.configRecoveryRequired).toBe(true);
    expect(afterFailure.config).toBeNull();
  });
});
