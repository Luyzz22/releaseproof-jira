import { describe, expect, it } from "vitest";
import { mapAdministerProjectPermission } from "../../src/infrastructure/jira/forge-jira-gateway";

describe("Jira-Projektadministrationsberechtigung", () => {
  it.each([
    [true, true],
    [false, false],
  ])("bildet havePermission=%s exakt ab", (havePermission, expected) => {
    expect(
      mapAdministerProjectPermission({
        permissions: {
          ADMINISTER_PROJECTS: {
            id: "23",
            key: "ADMINISTER_PROJECTS",
            name: "Administer projects",
            type: "PROJECT",
            havePermission,
          },
        },
      }),
    ).toBe(expected);
  });

  it.each([
    ["fehlendem permissions-Objekt", {}],
    ["fehlender ADMINISTER_PROJECTS-Berechtigung", { permissions: {} }],
    [
      "falschem Permission-Key",
      {
        permissions: {
          ADMINISTER_PROJECTS: {
            key: "BROWSE_PROJECTS",
            havePermission: true,
          },
        },
      },
    ],
    [
      "fehlendem Permission-Typ",
      {
        permissions: {
          ADMINISTER_PROJECTS: {
            key: "ADMINISTER_PROJECTS",
            havePermission: true,
          },
        },
      },
    ],
    [
      "falschem Permission-Typ",
      {
        permissions: {
          ADMINISTER_PROJECTS: {
            key: "ADMINISTER_PROJECTS",
            type: "GLOBAL",
            havePermission: true,
          },
        },
      },
    ],
    [
      "fehlendem havePermission",
      {
        permissions: {
          ADMINISTER_PROJECTS: { key: "ADMINISTER_PROJECTS" },
        },
      },
    ],
    [
      "nicht-booleschem havePermission",
      {
        permissions: {
          ADMINISTER_PROJECTS: {
            key: "ADMINISTER_PROJECTS",
            havePermission: "true",
          },
        },
      },
    ],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "weist %s fail-closed zurück",
    (_case, value) => {
      expect(() => mapAdministerProjectPermission(value)).toThrowError(
        expect.objectContaining({ code: "JIRA_UNAVAILABLE" }),
      );
    },
  );
});
