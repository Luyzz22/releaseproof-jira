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

  it("akzeptiert Warnungsantworten mit semantisch passender Parse-Struktur", () => {
    const jql = "project = DEMO AND labels = future-label";
    expect(
      parsedJqlIsValid(
        {
          queries: [
            {
              query: jql,
              warnings: ["The value does not currently exist."],
              structure: {
                where: {
                  clauses: [
                    {
                      field: { name: "project" },
                      operand: { value: "DEMO" },
                      operator: "=",
                    },
                    {
                      field: { name: "labels" },
                      operand: { value: "future-label" },
                      operator: "=",
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

  it.each([
    [
      "abweichendem Projektwert",
      "project = DEMO AND status = Fertig",
      {
        clauses: [
          {
            field: { name: "project" },
            operand: { value: "OTHER" },
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
    ],
    [
      "abweichendem Feldoperator",
      "project = DEMO AND status ~ Fertig",
      {
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
    ],
    [
      "abweichendem Operand",
      "project = DEMO AND status = Fertig",
      {
        clauses: [
          {
            field: { name: "project" },
            operand: { value: "DEMO" },
            operator: "=",
          },
          {
            field: { name: "status" },
            operand: { value: "Offen" },
            operator: "=",
          },
        ],
        operator: "and",
      },
    ],
    [
      "fehlender zweiter Clause",
      "project = DEMO AND status = Fertig",
      {
        field: { name: "project" },
        operand: { value: "DEMO" },
        operator: "=",
      },
    ],
    [
      "vertauschter Clause-Reihenfolge",
      "project = DEMO AND status = Fertig",
      {
        clauses: [
          {
            field: { name: "status" },
            operand: { value: "Fertig" },
            operator: "=",
          },
          {
            field: { name: "project" },
            operand: { value: "DEMO" },
            operator: "=",
          },
        ],
        operator: "and",
      },
    ],
    [
      "OR-Compound trotz passender Terminal-Clauses",
      "project = DEMO AND status = Fertig",
      {
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
        operator: "or",
      },
    ],
  ] satisfies ReadonlyArray<readonly [string, string, unknown]>)(
    "weist formal gültigen Parsebaum mit %s fail-closed zurück",
    (_case, jql, where) => {
      expect(() =>
        parsedJqlIsValid(
          { queries: [{ query: jql, structure: { where } }] },
          jql,
        ),
      ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
    },
  );

  it("akzeptiert eine semantisch passende IN-Liste", () => {
    const jql = "project = DEMO AND labels IN (urgent, blocker)";
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
                      field: { name: "labels" },
                      operand: {
                        values: [{ value: "urgent" }, { value: "blocker" }],
                      },
                      operator: "in",
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

  it("akzeptiert IS EMPTY semantisch gebunden", () => {
    const jql = "project = DEMO AND assignee IS EMPTY";
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
                      field: { name: "assignee" },
                      operand: { keyword: "empty" },
                      operator: "is",
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

  it("akzeptiert rekursiv verschachtelte AND-Clauses bei identischer Semantik", () => {
    const jql = "project = DEMO AND labels = urgent AND status = Fertig";
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
                      clauses: [
                        {
                          field: { name: "labels" },
                          operand: { value: "urgent" },
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

  it("akzeptiert encodedName als semantische Feld-ID", () => {
    const jql = "project = DEMO AND customfield_10042 = yes";
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
                      field: {
                        name: "Acceptance Criteria",
                        encodedName: "customfield_10042",
                      },
                      operand: { value: "yes" },
                      operator: "=",
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

  it("weist widersprüchliche Custom-Field-Identität fail-closed zurück", () => {
    const jql = "project = DEMO AND customfield_10042 = yes";

    expect(() =>
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
                      field: {
                        name: "customfield_10042",
                        encodedName: "customfield_99999",
                      },
                      operand: { value: "yes" },
                      operator: "=",
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
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

  it("akzeptiert konsistente technische Custom-Field-Aliase", () => {
    const jql = "project = DEMO AND customfield_10042 = yes";

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
                      field: {
                        name: "customfield_10042",
                        encodedName: "cf[10042]",
                      },
                      operand: { value: "yes" },
                      operator: "=",
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

  it("akzeptiert issuekey als kontrollierten Alias für key", () => {
    const jql = "project = DEMO AND key = DEMO-1";

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
                      field: { name: "issuekey" },
                      operand: { value: "DEMO-1" },
                      operator: "=",
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

  it("weist widersprüchliche Systemfeld-Identität fail-closed zurück", () => {
    const jql = "project = DEMO";
    expect(() =>
      parsedJqlIsValid(
        {
          queries: [
            {
              query: jql,
              structure: {
                where: {
                  field: { name: "project", encodedName: "status" },
                  operand: { value: "DEMO" },
                  operator: "=",
                },
              },
            },
          ],
        },
        jql,
      ),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

  it("akzeptiert konsistente Systemfeld-Identität und kontrollierte Aliase", () => {
    const projectJql = "project = DEMO";
    expect(
      parsedJqlIsValid(
        {
          queries: [
            {
              query: projectJql,
              structure: {
                where: {
                  field: { name: "project", encodedName: "project" },
                  operand: { value: "DEMO" },
                  operator: "=",
                },
              },
            },
          ],
        },
        projectJql,
      ),
    ).toBe(true);

    const keyJql = "project = DEMO AND key = DEMO-1";
    expect(
      parsedJqlIsValid(
        {
          queries: [
            {
              query: keyJql,
              structure: {
                where: {
                  clauses: [
                    {
                      field: { name: "project", encodedName: "project" },
                      operand: { value: "DEMO" },
                      operator: "=",
                    },
                    {
                      field: { name: "issuekey", encodedName: "key" },
                      operand: { value: "DEMO-1" },
                      operator: "=",
                    },
                  ],
                  operator: "and",
                },
              },
            },
          ],
        },
        keyJql,
      ),
    ).toBe(true);
  });

  it.each([
    [
      "project-Systemfeld",
      "project = DEMO",
      {
        field: { name: "project", encodedName: "customfield_10042" },
        operand: { value: "DEMO" },
        operator: "=",
      },
    ],
    [
      "status-Systemfeld",
      "project = DEMO AND status = Fertig",
      {
        clauses: [
          {
            field: { name: "project" },
            operand: { value: "DEMO" },
            operator: "=",
          },
          {
            field: { name: "status", encodedName: "customfield_10042" },
            operand: { value: "Fertig" },
            operator: "=",
          },
        ],
        operator: "and",
      },
    ],
  ] satisfies ReadonlyArray<readonly [string, string, unknown]>)(
    "weist Custom-ID für %s fail-closed zurück",
    (_case, jql, where) => {
      expect(() =>
        parsedJqlIsValid(
          { queries: [{ query: jql, structure: { where } }] },
          jql,
        ),
      ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
    },
  );
});
