import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_ERROR_CODES } from "../../src/shared/errors";
import { appErrorMessageKey } from "../../src/frontend/i18n/error-keys";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("global loading and error i18n contract", () => {
  it("maps every stable AppErrorCode to one translation key", () => {
    const keys = APP_ERROR_CODES.map((code) => appErrorMessageKey(code));

    expect(keys).toHaveLength(APP_ERROR_CODES.length);
    expect(new Set(keys).size).toBe(APP_ERROR_CODES.length);

    for (const code of APP_ERROR_CODES) {
      expect(appErrorMessageKey(code)).toMatch(/^errors\.message\./);
    }
  });

  it("migrates loading-state visible text to registered keys", () => {
    const source = readSource("src/frontend/components/loading-state.tsx");

    expect(source).toContain("I18N_KEYS.loadingCompact");
    expect(source).toContain("I18N_KEYS.loadingFull");
    expect(source).not.toContain("Ansicht wird vorbereitet");
    expect(source).not.toContain("ReleaseProof wird geladen");
  });

  it("migrates ErrorState visible text and retry controls", () => {
    const source = readSource("src/frontend/components/error-state.tsx");

    expect(source).toContain("appErrorMessageKey(error.code)");
    expect(source).toContain("I18N_KEYS.errorAnalysisUnavailable");
    expect(source).toContain("I18N_KEYS.errorRetryLead");
    expect(source).toContain("I18N_KEYS.errorRetrySeconds");
    expect(source).toContain("I18N_KEYS.errorRetryAction");

    expect(source).not.toContain("Analyse nicht verfügbar");
    expect(source).not.toContain("Frühester neuer Versuch");
    expect(source).not.toContain("Erneut versuchen");
  });

  it("migrates InlineError message and dismiss ARIA text", () => {
    const source = readSource("src/frontend/components/inline-error.tsx");

    expect(source).toContain("appErrorMessageKey(error.code)");
    expect(source).toContain("I18N_KEYS.errorDismissAria");
    expect(source).not.toContain("Fehlermeldung schließen");
  });
});
