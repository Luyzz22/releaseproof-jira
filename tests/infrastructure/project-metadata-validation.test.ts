import { describe, expect, it } from "vitest";
import {
  mapProjectDetail,
  mapProjectMetadata,
} from "../../src/infrastructure/jira/forge-jira-gateway";

const validIssueType = {
  id: "10001",
  name: "Story",
  subtask: false,
  statuses: [{ id: "31", name: "Fertig" }],
};

describe("Jira-Projektdetailbindung", () => {
  const validProject = { id: "10000", key: "DEMO", name: "Demo" };

  it("akzeptiert ein Projektdetail mit passender Forge-Projekt-ID und passendem Schlüssel", () => {
    expect(mapProjectDetail(validProject, "DEMO", "10000")).toEqual(
      validProject,
    );
  });

  it("weist einen fremden Projektschlüssel fail-closed zurück", () => {
    expect(() =>
      mapProjectDetail(
        { id: "10000", key: "OTHER", name: "Other" },
        "DEMO",
        "10000",
      ),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

  it("weist eine fremde Projekt-ID fail-closed zurück", () => {
    expect(() =>
      mapProjectDetail(
        { id: "10001", key: "DEMO", name: "Demo" },
        "DEMO",
        "10000",
      ),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

  it("weist gleichzeitig fremde Projekt-ID und fremden Schlüssel fail-closed zurück", () => {
    expect(() =>
      mapProjectDetail(
        { id: "10001", key: "OTHER", name: "Other" },
        "DEMO",
        "10000",
      ),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

  it("bindet auch eine numerisch angefragte Projektdetailantwort an die Anfrage", () => {
    expect(mapProjectDetail(validProject, "10000", "10000")).toEqual(
      validProject,
    );
  });
});

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
