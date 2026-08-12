from pathlib import Path


def replace_between(text: str, start: str, end: str, replacement: str) -> str:
    start_index = text.find(start)
    if start_index == -1:
        raise SystemExit(f"ABORT: start marker not found: {start}")
    end_index = text.find(end, start_index)
    if end_index == -1:
        raise SystemExit(f"ABORT: end marker not found: {end}")
    return text[:start_index] + replacement + text[end_index:]


# 1) Expose the existing controlled-JQL parser as canonical clause semantics.
validation_path = Path("src/shared/validation.ts")
validation = validation_path.read_text()

old_semantics = '''function normalizedReleaseScopeJqlSemantics(value: string): string | null {
  const tokenized = tokenizeJql(value);
  if (!tokenized.ok) return null;

  const parsed = parseConjunctiveJql(tokenized.tokens);
  if (!parsed.ok) return null;

  return JSON.stringify(
    parsed.clauses.map((clause) => ({
      field: normalizedJqlFieldReference(clause.field.value),
      operator: clause.operator,
      values: clause.values.map((valueToken) => valueToken.value),
    })),
  );
}
'''

new_semantics = '''export interface ReleaseScopeJqlSemanticClause {
  field: string;
  operator: string;
  values: string[];
}

export function parseReleaseScopeJqlSemantics(
  value: string,
): ReleaseScopeJqlSemanticClause[] | null {
  const tokenized = tokenizeJql(value);
  if (!tokenized.ok) return null;

  const parsed = parseConjunctiveJql(tokenized.tokens);
  if (!parsed.ok) return null;

  return parsed.clauses.map((clause) => ({
    field: normalizedJqlFieldReference(clause.field.value),
    operator: clause.operator,
    values: clause.values.map((valueToken) => valueToken.value),
  }));
}

function normalizedReleaseScopeJqlSemantics(value: string): string | null {
  const semantics = parseReleaseScopeJqlSemantics(value);
  return semantics === null ? null : JSON.stringify(semantics);
}
'''

if old_semantics not in validation:
    raise SystemExit("ABORT: expected normalizedReleaseScopeJqlSemantics block not found")
validation = validation.replace(old_semantics, new_semantics, 1)
validation_path.write_text(validation)


# 2) Bind Jira's parsed where-tree to those canonical semantics.
client_path = Path("src/infrastructure/jira/forge-jira-client.ts")
client = client_path.read_text()

old_import = '''import { releaseScopeJqlSemanticallyMatches } from "../../shared/validation";'''
new_import = '''import {
  parseReleaseScopeJqlSemantics,
  releaseScopeJqlSemanticallyMatches,
} from "../../shared/validation";'''
if old_import not in client:
    raise SystemExit("ABORT: expected validation import not found")
client = client.replace(old_import, new_import, 1)

semantic_helpers = '''const JQL_COMPARISON_OPERATORS = new Set([
  "=",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "~",
  "!~",
]);
const JQL_LIST_OPERATORS = new Set(["in", "not in"]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizedJqlFieldCandidate(value: string): string {
  const normalized = value.trim().toLocaleLowerCase("en-US");
  const customFieldMatch = /^cf\\[(\\d+)\\]$/.exec(normalized);
  if (customFieldMatch) return `customfield_${customFieldMatch[1]}`;
  return normalized === "issuekey" ? "key" : normalized;
}

function jiraFieldCandidates(value: unknown): string[] | null {
  if (!isRecord(value)) return null;
  const candidates = [value.name, value.encodedName]
    .filter(isNonEmptyString)
    .map(normalizedJqlFieldCandidate);
  return candidates.length > 0 ? [...new Set(candidates)] : null;
}

function jiraSingleOperandValue(value: unknown): string | null {
  if (!isRecord(value) || typeof value.value !== "string") return null;
  return value.value;
}

function jiraListOperandValues(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.values) || value.values.length === 0) {
    return null;
  }

  const values: string[] = [];
  for (const entry of value.values) {
    if (!isRecord(entry) || typeof entry.value !== "string") return null;
    values.push(entry.value);
  }
  return values;
}

interface JiraWhereSemanticClause {
  fieldCandidates: string[];
  operator: string;
  values: string[];
}

function jiraWhereClauseSemantics(
  value: unknown,
): JiraWhereSemanticClause[] | null {
  if (!isRecord(value)) return null;

  if (value.clauses !== undefined) {
    if (
      !Array.isArray(value.clauses) ||
      value.clauses.length === 0 ||
      typeof value.operator !== "string" ||
      value.operator.toLocaleLowerCase("en-US") !== "and"
    ) {
      return null;
    }

    const clauses: JiraWhereSemanticClause[] = [];
    for (const child of value.clauses) {
      const childClauses = jiraWhereClauseSemantics(child);
      if (!childClauses) return null;
      clauses.push(...childClauses);
    }
    return clauses;
  }

  const fieldCandidates = jiraFieldCandidates(value.field);
  if (!fieldCandidates || typeof value.operator !== "string") return null;
  const operator = value.operator.toLocaleLowerCase("en-US");

  if (JQL_COMPARISON_OPERATORS.has(operator)) {
    const operand = jiraSingleOperandValue(value.operand);
    return operand === null
      ? null
      : [{ fieldCandidates, operator, values: [operand] }];
  }

  if (JQL_LIST_OPERATORS.has(operator)) {
    const operands = jiraListOperandValues(value.operand);
    return operands === null
      ? null
      : [{ fieldCandidates, operator: operator.toUpperCase(), values: operands }];
  }

  if (operator === "is" || operator === "is not") {
    const operand = isRecord(value.operand) ? value.operand : null;
    if (
      !operand ||
      typeof operand.keyword !== "string" ||
      operand.keyword.toLocaleLowerCase("en-US") !== "empty"
    ) {
      return null;
    }
    return [
      {
        fieldCandidates,
        operator: operator === "is" ? "IS EMPTY" : "IS NOT EMPTY",
        values: [],
      },
    ];
  }

  return null;
}

function sameStrings(expected: readonly string[], actual: readonly string[]): boolean {
  return (
    expected.length === actual.length &&
    expected.every((value, index) => value === actual[index])
  );
}

function jiraWhereSemanticallyMatches(
  value: unknown,
  requestedJql: string,
): boolean {
  const expected = parseReleaseScopeJqlSemantics(requestedJql);
  const actual = jiraWhereClauseSemantics(value);
  if (!expected || !actual || expected.length !== actual.length) return false;

  return expected.every((expectedClause, index) => {
    const actualClause = actual[index];
    if (!actualClause) return false;
    const expectedField = normalizedJqlFieldCandidate(expectedClause.field);
    return (
      actualClause.fieldCandidates.includes(expectedField) &&
      actualClause.operator === expectedClause.operator &&
      sameStrings(expectedClause.values, actualClause.values)
    );
  });
}

'''

client = replace_between(
    client,
    'const JQL_COMPOUND_OPERATORS = new Set(["and", "or", "not"]);',
    'export function parsedJqlIsValid(',
    semantic_helpers,
)

old_check = '''  if (!isValidJqlWhereClause(where)) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "JQL validation returned an unexpected response.",
    );
  }
'''
new_check = '''  if (!jiraWhereSemanticallyMatches(where, requestedJql)) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "JQL validation returned an unexpected response.",
    );
  }
'''
if old_check not in client:
    raise SystemExit("ABORT: expected where validation check not found")
client = client.replace(old_check, new_check, 1)
client_path.write_text(client)


# 3) Update the warning control case and add semantic tree-binding regressions.
test_path = Path("tests/infrastructure/jira-jql-validation.test.ts")
test = test_path.read_text()

old_warning = '''  it("akzeptiert Warnungsantworten mit nachgewiesener Parse-Struktur", () => {
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
'''

new_warning = '''  it("akzeptiert Warnungsantworten mit semantisch passender Parse-Struktur", () => {
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
'''
if old_warning not in test:
    raise SystemExit("ABORT: expected warning test not found")
test = test.replace(old_warning, new_warning, 1)

marker = '''  it.each([\n    [\n      "leerem where-Parsebaum",'''
if marker not in test:
    raise SystemExit("ABORT: semantic regression insertion marker not found")

regressions = '''  it.each([
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
  ] satisfies ReadonlyArray<readonly [string, string, unknown]>) (
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

'''

test = test.replace(marker, regressions + marker, 1)
test_path.write_text(test)

print("SCRUM-54 changes applied successfully.")
