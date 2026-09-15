import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { I18N_KEYS } from "../../src/frontend/i18n/keys";

function readAppSource(): string {
  return readFileSync(resolve(process.cwd(), "src/frontend/App.tsx"), "utf8");
}

describe("App shell i18n contract", () => {
  it("uses registered keys for shell navigation and ARIA text", () => {
    const source = readAppSource();

    for (const key of [
      "shellHomeAria",
      "shellSkipToMain",
      "shellProjectContextAria",
      "shellPrimaryNavigationAria",
      "navigationAnalysis",
      "navigationOverview",
      "navigationConfiguration",
    ] as const) {
      expect(source).toContain(`I18N_KEYS.${key}`);
    }

    expect(source).toContain("const { t } = useI18n();");
  });

  it("removes the migrated German shell strings from App.tsx", () => {
    const source = readAppSource();

    expect(source).not.toContain("Zum Hauptinhalt springen");
    expect(source).not.toContain('aria-label="ReleaseProof Startseite"');
    expect(source).not.toContain('aria-label="Aktuelles Jira-Projekt"');
    expect(source).not.toContain('aria-label="Hauptnavigation"');

    expect(source).not.toMatch(/>\s*Analyse\s*</);
    expect(source).not.toMatch(/>\s*Übersicht\s*</);
    expect(source).not.toMatch(/>\s*Konfiguration\s*</);
  });

  it("keeps the canonical shell key values stable", () => {
    expect(I18N_KEYS.shellHomeAria).toBe("shell.homeAria");
    expect(I18N_KEYS.shellSkipToMain).toBe("shell.skipToMain");
    expect(I18N_KEYS.shellProjectContextAria).toBe("shell.projectContextAria");
    expect(I18N_KEYS.shellPrimaryNavigationAria).toBe(
      "shell.primaryNavigationAria",
    );
    expect(I18N_KEYS.navigationAnalysis).toBe("navigation.analysis");
    expect(I18N_KEYS.navigationOverview).toBe("navigation.overview");
    expect(I18N_KEYS.navigationConfiguration).toBe("navigation.configuration");
  });
});
