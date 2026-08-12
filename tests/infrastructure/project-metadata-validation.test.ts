import { describe, expect, it } from "vitest";
import { mapProjectMetadata } from "../../src/infrastructure/jira/forge-jira-gateway";

const validIssueType = {
  id: "10001",
  name: "Story",
  subtask: false,
  statuses: [{ id: "31", name: "Fertig" }],
};

describe("Jira-Projektmetadaten", () => {
  it("bildet vollständige Projektmetadaten ab", () => {
    expect(mapProjectMetadata([validIssueType])).toEqual({
      issueTypes: [{ id: "10001", name: "Story", subtask: false }],
      statuses: [{ id: "31", name: "Fertig" }],
    });
  });

  it("akzeptiert ein explizit leeres Status-Array", () => {
    expect(
      mapProjectMetadata([
        { id: "10001", name: "Story", subtask: false, statuses: [] },
      ]),
    ).toEqual({
      issueTypes: [{ id: "10001", name: "Story", subtask: false }],
      statuses: [],
    });
  });

  it.each([
    [
      "nichtnumerische Vorgangstyp-ID",
      [{ id: "Story", name: "Story", subtask: false, statuses: [] }],
    ],
    ["fehlendes subtask-Flag", [{ id: "10001", name: "Story", statuses: [] }]],
    [
      "falsch typisiertes subtask-Flag",
      [{ id: "10001", name: "Story", subtask: "false", statuses: [] }],
    ],
    [
      "fehlendes statuses-Feld",
      [{ id: "10001", name: "Story", subtask: false }],
    ],
    [
      "statuses als Objekt",
      [{ id: "10001", name: "Story", subtask: false, statuses: {} }],
    ],
    [
      "Status ohne ID",
      [
        {
          id: "10001",
          name: "Story",
          subtask: false,
          statuses: [{ name: "Fertig" }],
        },
      ],
    ],
    [
      "Status ohne Namen",
      [
        {
          id: "10001",
          name: "Story",
          subtask: false,
          statuses: [{ id: "31" }],
        },
      ],
    ],
    [
      "Status mit nichtnumerischer ID",
      [
        {
          id: "10001",
          name: "Story",
          subtask: false,
          statuses: [{ id: "done", name: "Fertig" }],
        },
      ],
    ],
    [
      "gemischte gültige und ungültige Vorgangstypen",
      [validIssueType, { id: "10002", name: "Unteraufgabe", statuses: [] }],
    ],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "bricht bei %s fail-closed ab",
    (_case, value) => {
      expect(() => mapProjectMetadata(value)).toThrowError(
        expect.objectContaining({ code: "JIRA_UNAVAILABLE" }),
      );
    },
  );
});
