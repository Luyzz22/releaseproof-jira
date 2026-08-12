import { describe, expect, it } from "vitest";
import { parsedJqlIsValid } from "../../src/infrastructure/jira/forge-jira-client";

const expectedJql = "project = DEMO AND status = Fertig";
const validStructure = {
  where: {
    clauses: [
      {
        field: { name: "project" },
        operand: { value: "DEMO" },
        operator: "=",
      },
      {
        field: { name: "status" },
        operand: { value: "Fertig" },
        operator: "=",
      },
    ],
    operator: "and",
  },
};

describe("Jira-JQL-Validierungsantwort", () => {
  it("akzeptiert eine gültige einzelne Terminal-Clause", () => {
    const jql = "project = DEMO";

    expect(
      parsedJqlIsValid(
        {
          queries: [
            {
              query: jql,
              structure: {
                where: {
                  field: { name: "project" },
                  operand: { value: "DEMO" },
                  operator: "=",
                },
              },
            },
          ],
        },
        jql,
      ),
    ).toBe(true);
  });

  it("akzeptiert den von Jira unterstützten !~-Operator", () => {
    const jql = "project = DEMO AND summary !~ test";

    expect(
      parsedJqlIsValid(
        {
          queries: [
            {
              query: jql,
              structure: {
                where: {
                  clauses: [
                    {
                      field: { name: "project" },
                      operand: { value: "DEMO" },
                      operator: "=",
                    },
                    {
                      field: { name: "summary" },
                      operand: { value: "test" },
                      operator: "!~",
                    },
                  ],
                  operator: "and",
                },
              },
            },
          ],
        },
        jql,
      ),
    ).toBe(true);
  });

  it("akzeptiert eine von Jira erfolgreich validierte Abfrage", () => {
    expect(
      parsedJqlIsValid(
        {
          queries: [
            {
              query: expectedJql,
              structure: validStructure,
            },
          ],
        },
        expectedJql,
      ),
    ).toBe(true);
  });

  it("akzeptiert semantisch gleiche Jira-Normalisierung", () => {
    expect(
      parsedJqlIsValid(
        {
          queries: [
            {
              query: 'PROJECT = "DEMO" AND STATUS = "Fertig"',
              structure: validStructure,
            },
          ],
        },
        expectedJql,
      ),
    ).toBe(true);
  });

  it("lehnt eine Parserantwort für eine andere JQL fail-closed ab", () => {
    expect(() =>
      parsedJqlIsValid(
        {
          queries: [
            {
              query: "project = OTHER AND status = Fertig",
              structure: validStructure,
            },
          ],
        },
        expectedJql,
      ),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

  it("lehnt einen von Jira nicht unterstützten Feldoperator ab", () => {
    const jql = "project = DEMO AND status ~ Fertig";
    expect(
      parsedJqlIsValid(
        {
          queries: [
            {
              query: jql,
              errors: [
                "The operator '~' is not supported by the 'status' field.",
              ],
            },
          ],
        },
        jql,
      ),
    ).toBe(false);
  });

  it("lehnt einen Jira-Parserfehler ab", () => {
    const jql = "project = DEMO AND unknown = value";
    expect(
      parsedJqlIsValid(
        {
          queries: [
            {
              query: jql,
              errors: ["Field 'unknown' does not exist."],
            },
          ],
        },
        jql,
      ),
    ).toBe(false);
  });

  it("weist Warnungsantworten ohne Parse-Struktur fail-closed zurück", () => {
    const jql = "project = DEMO AND labels = future-label";
    expect(() =>
      parsedJqlIsValid(
        {
          queries: [
            {
              query: jql,
              warnings: ["The value does not currently exist."],
            },
          ],
        },
        jql,
      ),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

  it("akzeptiert Warnungsantworten mit nachgewiesener Parse-Struktur", () => {
    const jql = "project = DEMO AND labels = future-label";
    expect(
      parsedJqlIsValid(
        {
          queries: [
            {
              query: jql,
              warnings: ["The value does not currently exist."],
              structure: validStructure,
            },
          ],
        },
        jql,
      ),
    ).toBe(true);
  });

  it.each([
    [
      "leerem where-Parsebaum",
      { queries: [{ query: "project = DEMO", structure: { where: {} } }] },
    ],
    [
      "leerer Compound-Clause",
      {
        queries: [
          {
            query: "project = DEMO",
            structure: { where: { clauses: [], operator: "and" } },
          },
        ],
      },
    ],
    [
      "Terminal-Clause ohne Operand",
      {
        queries: [
          {
            query: "project = DEMO",
            structure: {
              where: { field: { name: "project" }, operator: "=" },
            },
          },
        ],
      },
    ],
    ["fehlende queries", {}],
    ["queries als Objekt", { queries: {} }],
    ["keine Query", { queries: [] }],
    ["mehrere Queries", { queries: [{}, {}] }],
    ["malformed Query", { queries: [null] }],
    ["Query ohne Erfolgsfelder", { queries: [{}] }],
    ["nur Warnungen ohne Query", { queries: [{ warnings: ["Hinweis"] }] }],
    ["Query-Text ohne Struktur", { queries: [{ query: "project = DEMO" }] }],
    [
      "leere Parse-Struktur",
      { queries: [{ query: "project = DEMO", structure: {} }] },
    ],
    ["Struktur ohne Query-Text", { queries: [{ structure: { where: {} } }] }],
    [
      "leerer Query-Text",
      { queries: [{ query: "   ", structure: { where: {} } }] },
    ],
    ["errors als null", { queries: [{ errors: null }] }],
    ["malformed error", { queries: [{ errors: [null] }] }],
    [
      "malformed warning",
      {
        queries: [
          {
            query: "project = DEMO",
            warnings: [null],
            structure: { where: {} },
          },
        ],
      },
    ],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "bricht bei %s fail-closed ab",
    (_case, value) => {
      expect(() => parsedJqlIsValid(value, "project = DEMO")).toThrowError(
        expect.objectContaining({ code: "JIRA_UNAVAILABLE" }),
      );
    },
  );
});
