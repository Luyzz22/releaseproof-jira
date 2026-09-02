import { describe, expect, it } from "vitest";
import {
  mapAdministerProjectAuthorization,
  mapProjectAdminProbeStatus,
} from "../../src/infrastructure/jira/forge-jira-gateway";

describe("Jira-Projektadministrationsautorisierung", () => {
  it.each([
    [
      [
        {
          permission: "ADMINISTER_PROJECTS",
          projects: [10000],
          issues: [],
        },
      ],
      true,
    ],
    [
      [
        {
          permission: "ADMINISTER_PROJECTS",
          projects: ["10000"],
          issues: [],
        },
      ],
      true,
    ],
    [
      [
        {
          permission: "ADMINISTER_PROJECTS",
          projects: [],
          issues: [],
        },
      ],
      false,
    ],
    [{ permission: "ADMINISTER_PROJECTS", projects: [10000] }, true],
    [{ permission: "ADMINISTER_PROJECTS", projects: [] }, false],
    [{ permission: "ADMINISTER_PROJECTS" }, false],
  ] satisfies ReadonlyArray<readonly [unknown, boolean]>)(
    "bildet Forge-Authorize-Admin- und Deny-Ergebnisse %# fail-closed ab",
    (value, expected) => {
      expect(mapAdministerProjectAuthorization(value, "10000")).toBe(expected);
    },
  );

  it.each([
    ["einem leeren Grant-Array", []],
    [
      "mehreren Grants",
      [
        {
          permission: "ADMINISTER_PROJECTS",
          projects: [10000],
          issues: [],
        },
        {
          permission: "ADMINISTER_PROJECTS",
          projects: [10000],
          issues: [],
        },
      ],
    ],
    [
      "einem fremden Projekt",
      [
        {
          permission: "ADMINISTER_PROJECTS",
          projects: [10001],
          issues: [],
        },
      ],
    ],
    [
      "mehreren Projekten",
      [
        {
          permission: "ADMINISTER_PROJECTS",
          projects: [10000, 10001],
          issues: [],
        },
      ],
    ],
    [
      "einem fremden Permission-Grant",
      [
        {
          permission: "BROWSE_PROJECTS",
          projects: [10000],
          issues: [],
        },
      ],
    ],
    [
      "einem nicht leeren Issue-Kontext",
      [
        {
          permission: "ADMINISTER_PROJECTS",
          projects: [10000],
          issues: [10010],
        },
      ],
    ],
    [
      "einem malformed Issue-Kontext",
      [
        {
          permission: "ADMINISTER_PROJECTS",
          projects: [10000],
          issues: null,
        },
      ],
    ],
    [
      "einer ungültigen Projekt-ID",
      [
        {
          permission: "ADMINISTER_PROJECTS",
          projects: ["SCRUM"],
          issues: [],
        },
      ],
    ],
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
        [
          {
            permission: "ADMINISTER_PROJECTS",
            projects: [10000],
            issues: [],
          },
        ],
        "SCRUM",
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
  });
});

describe("Jira-Projektadmin-Probe", () => {
  it.each([
    [200, true],
    [401, false],
    [403, false],
  ] satisfies ReadonlyArray<readonly [number, boolean]>)(
    "bildet HTTP %s auf %s ab",
    (status, expected) => {
      expect(mapProjectAdminProbeStatus(status)).toBe(expected);
    },
  );

  it.each([0, 201, 400, 404, 429, 500])(
    "weist unerwarteten HTTP-Status %s fail-closed zurück",
    (status) => {
      expect(() => mapProjectAdminProbeStatus(status)).toThrowError(
        expect.objectContaining({ code: "JIRA_UNAVAILABLE" }),
      );
    },
  );
});

