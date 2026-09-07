import { describe, expect, it } from "vitest";
import type { ReadinessStatus } from "../../src/domain/models/readiness";
import { readinessStatusKey } from "../../src/frontend/i18n/readiness-status-keys";
import { I18N_KEYS } from "../../src/frontend/i18n/keys";

const cases: ReadonlyArray<readonly [ReadinessStatus, string]> = [
  ["READY", "readinessStatus.ready"],
  ["INCOMPLETE", "readinessStatus.incomplete"],
  ["BLOCKED", "readinessStatus.blocked"],
  ["NOT_APPLICABLE", "readinessStatus.notApplicable"],
];

describe("readiness status i18n key contract", () => {
  it.each(cases)(
    "maps %s to the stable translation key %s",
    (status, expectedKey) => {
      expect(readinessStatusKey(status)).toBe(expectedKey);
    },
  );

  it("keeps all readiness status keys registered canonically", () => {
    expect(I18N_KEYS.readinessStatusReady).toBe("readinessStatus.ready");
    expect(I18N_KEYS.readinessStatusIncomplete).toBe(
      "readinessStatus.incomplete",
    );
    expect(I18N_KEYS.readinessStatusBlocked).toBe("readinessStatus.blocked");
    expect(I18N_KEYS.readinessStatusNotApplicable).toBe(
      "readinessStatus.notApplicable",
    );
  });

  it("keeps one unique translation key per internal status", () => {
    const keys = cases.map(([status]) => readinessStatusKey(status));

    expect(new Set(keys).size).toBe(cases.length);
  });
});
