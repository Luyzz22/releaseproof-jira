import { describe, expect, it } from "vitest";
import {
  isLastPage,
  mapFieldSearchPage,
  mapProjectSearchPage,
  mapVersionDetail,
  mapVersionSearchPage,
} from "../../src/infrastructure/jira/forge-jira-gateway";

const project = { id: "10000", key: "DEMO", name: "Demo" };
const field = {
  id: "customfield_10042",
  name: "Akzeptanzkriterien",
  schema: { type: "string" },
};
const version = {
  id: "30001",
  name: "1.0.0",
  projectId: 10000,
  released: false,
  archived: false,
};

describe("paginierte Jira-Metadatengrenze", () => {
  it("bildet vollständige Projekt-, Feld- und Versionsseiten ab", () => {
    expect(mapProjectSearchPage({ values: [project], isLast: true })).toEqual([
      project,
    ]);
    expect(mapFieldSearchPage({ values: [field], isLast: true })).toEqual([
      {
        id: "customfield_10042",
        name: "Akzeptanzkriterien",
        custom: true,
        schemaType: "string",
      },
    ]);
    expect(mapVersionSearchPage({ values: [version], isLast: true })).toEqual([
      {
        ...version,
        projectId: "10000",
      },
    ]);
  });

  it.each([
    ["fehlendem values-Feld", { isLast: true }],
    ["values als Objekt", { values: {}, isLast: true }],
    ["values als null", { values: null, isLast: true }],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "weist Projektseite mit %s fail-closed zurück",
    (_case, payload) => {
      expect(() => mapProjectSearchPage(payload)).toThrowError(
        expect.objectContaining({ code: "JIRA_UNAVAILABLE" }),
      );
    },
  );

  it("weist ein einzelnes malformed Projekt-Element zurück", () => {
    expect(() =>
      mapProjectSearchPage({
        values: [project, { id: "10001" }],
        isLast: true,
      }),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

  it("leitet custom bei paginierten Jira-Feldern aus der Feld-ID ab", () => {
    expect(
      mapFieldSearchPage({
        values: [
          field,
          {
            id: "summary",
            name: "Summary",
            schema: { type: "string", system: "summary" },
          },
        ],
        isLast: true,
      }),
    ).toEqual([
      {
        id: "customfield_10042",
        name: "Akzeptanzkriterien",
        custom: true,
        schemaType: "string",
      },
      {
        id: "summary",
        name: "Summary",
        custom: false,
        schemaType: "string",
      },
    ]);
  });

  it.each([
    ["fehlender ID", { ...field, id: undefined }],
    ["fehlender Name", { ...field, name: undefined }],
    ["fehlendes Schema", { ...field, schema: undefined }],
    ["fehlender Schema-Typ", { ...field, schema: {} }],
    ["malformed Schema-Typ", { ...field, schema: { type: {} } }],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "weist Feld mit %s fail-closed zurück",
    (_case, malformedField) => {
      expect(() =>
        mapFieldSearchPage({ values: [malformedField], isLast: true }),
      ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
    },
  );

  it("akzeptiert vollständige numerische Pagination ohne isLast", () => {
    expect(
      isLastPage(
        {
          values: [],
          startAt: 0,
          maxResults: 50,
          total: 0,
        },
        "Project search",
      ),
    ).toBe(true);
  });

  it("akzeptiert konsistente kombinierte Pagination-Metadaten", () => {
    expect(
      isLastPage(
        {
          values: [],
          isLast: true,
          startAt: 100,
          maxResults: 50,
          total: 150,
        },
        "Project search",
      ),
    ).toBe(true);

    expect(
      isLastPage(
        {
          values: [],
          isLast: false,
          startAt: 0,
          maxResults: 100,
          total: 150,
        },
        "Project search",
      ),
    ).toBe(false);
  });

  it.each([
    [
      "isLast=true trotz numerisch weiterer Seite",
      {
        values: [],
        isLast: true,
        startAt: 0,
        maxResults: 100,
        total: 150,
      },
    ],
    [
      "isLast=false trotz numerisch letzter Seite",
      {
        values: [],
        isLast: false,
        startAt: 100,
        maxResults: 50,
        total: 150,
      },
    ],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "weist widersprüchliche Pagination mit %s fail-closed zurück",
    (_case, payload) => {
      expect(() => isLastPage(payload, "Project search")).toThrowError(
        expect.objectContaining({ code: "JIRA_UNAVAILABLE" }),
      );
    },
  );

  it.each([
    ["nicht-booleschem isLast", { values: [], isLast: "true" }],
    [
      "negativem startAt",
      { values: [], startAt: -1, maxResults: 50, total: 1 },
    ],
    ["maxResults null", { values: [], startAt: 0, maxResults: null, total: 1 }],
    ["maxResults 0", { values: [], startAt: 0, maxResults: 0, total: 1 }],
    ["unvollständiger Pagination", { values: [], startAt: 0, total: 1 }],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "weist Seite mit %s fail-closed zurück",
    (_case, payload) => {
      expect(() => isLastPage(payload, "Project search")).toThrowError(
        expect.objectContaining({ code: "JIRA_UNAVAILABLE" }),
      );
    },
  );

  it.each([
    ["nichtnumerischer ID", { ...version, id: "broken" }],
    ["nichtnumerischer projectId", { ...version, projectId: "broken" }],
    ["fehlendem released", { ...version, released: undefined }],
    ["falsch typisiertem released", { ...version, released: "false" }],
    ["fehlendem archived", { ...version, archived: undefined }],
    ["falsch typisiertem archived", { ...version, archived: 0 }],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "weist Version mit %s fail-closed zurück",
    (_case, malformedVersion) => {
      expect(() =>
        mapVersionSearchPage({ values: [malformedVersion], isLast: true }),
      ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
    },
  );

  it("bindet eine Version-Detailantwort an die angefragte ID", () => {
    expect(mapVersionDetail(version, "30001")).toEqual({
      ...version,
      projectId: "10000",
    });
    expect(() =>
      mapVersionDetail({ ...version, id: "30002" }, "30001"),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

  it("verwirft bei gemischten gültigen und malformed Versionen die gesamte Seite", () => {
    expect(() =>
      mapVersionSearchPage({
        values: [version, { ...version, id: "30002", archived: null }],
        isLast: true,
      }),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });
});
