import { describe, expect, it } from "vitest";
import { mapAdministerProjectAuthorization } from "../../src/infrastructure/jira/forge-jira-gateway";

describe("Jira-Projektadministrationsautorisierung", () => {
  it.each([
    [{ permission: "ADMINISTER_PROJECTS", projects: [10000] }, true],
    [{ permission: "ADMINISTER_PROJECTS", projects: ["10000"] }, true],
    [{ permission: "ADMINISTER_PROJECTS", projects: [] }, false],
    [{ permission: "ADMINISTER_PROJECTS" }, false],
  ] satisfies ReadonlyArray<readonly [unknown, boolean]>)(
    "bildet das dokumentierte Forge-Authorize-Ergebnis %# fail-closed ab",
    (value, expected) => {
      expect(mapAdministerProjectAuthorization(value, "10000")).toBe(expected);
    },
  );

  it.each([
    [
      "einem fremden Projekt",
      { permission: "ADMINISTER_PROJECTS", projects: [10001] },
    ],
    [
      "mehreren Projekten",
      { permission: "ADMINISTER_PROJECTS", projects: [10000, 10001] },
    ],
    [
      "einem fremden Permission-Grant",
      { permission: "BROWSE_PROJECTS", projects: [10000] },
    ],
    [
      "einem Issue-Kontext",
      {
        permission: "ADMINISTER_PROJECTS",
        projects: [10000],
        issues: [10010],
      },
    ],
    [
      "einer ungültigen Projekt-ID",
      { permission: "ADMINISTER_PROJECTS", projects: ["SCRUM"] },
    ],
    [
      "der veralteten Array-Annahme",
      [{ permission: "ADMINISTER_PROJECTS", projects: [10000] }],
    ],
    ["einem leeren Array", []],
    ["einem Null-Ergebnis", null],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "weist %s zurück",
    (_case, value) => {
      expect(() =>
        mapAdministerProjectAuthorization(value, "10000"),
      ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
    },
  );

  it("weist einen ungültigen erwarteten Projektkontext zurück", () => {
    expect(() =>
      mapAdministerProjectAuthorization(
        { permission: "ADMINISTER_PROJECTS", projects: [10000] },
        "SCRUM",
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
  });
});
