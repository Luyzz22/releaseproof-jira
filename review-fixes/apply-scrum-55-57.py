from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ABORT: expected exactly one match in {path}, found {count}")
    file_path.write_text(text.replace(old, new, 1))


# SCRUM-55: make custom-field identity unambiguous when encodedName is present.
replace_once(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''function jiraFieldCandidates(value: unknown): string[] | null {
  if (!isRecord(value)) return null;
  const candidates = [value.name, value.encodedName]
    .filter(isNonEmptyString)
    .map(normalizedJqlFieldCandidate);
  return candidates.length > 0 ? [...new Set(candidates)] : null;
}
''',
    '''interface JiraFieldIdentity {
  name: string | null;
  encodedName: string | null;
}

function isCustomFieldReference(value: string): boolean {
  return /^customfield_\\d+$/.test(value);
}

function jiraFieldIdentity(value: unknown): JiraFieldIdentity | null {
  if (!isRecord(value)) return null;

  const name = isNonEmptyString(value.name)
    ? normalizedJqlFieldCandidate(value.name)
    : null;
  const encodedName = isNonEmptyString(value.encodedName)
    ? normalizedJqlFieldCandidate(value.encodedName)
    : null;
  if (name === null && encodedName === null) return null;

  if (
    name !== null &&
    encodedName !== null &&
    isCustomFieldReference(name) &&
    isCustomFieldReference(encodedName) &&
    name !== encodedName
  ) {
    return null;
  }

  return { name, encodedName };
}

function jiraFieldMatchesExpected(
  identity: JiraFieldIdentity,
  expectedField: string,
): boolean {
  const expected = normalizedJqlFieldCandidate(expectedField);

  if (isCustomFieldReference(expected)) {
    if (identity.encodedName !== null) {
      if (identity.encodedName !== expected) return false;
      return (
        identity.name === null ||
        !isCustomFieldReference(identity.name) ||
        identity.name === expected
      );
    }
    return identity.name === expected;
  }

  if (identity.name !== null) return identity.name === expected;
  return identity.encodedName === expected;
}
''',
)

replace_once(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''interface JiraWhereSemanticClause {
  fieldCandidates: string[];
  operator: string;
  values: string[];
}
''',
    '''interface JiraWhereSemanticClause {
  fieldIdentity: JiraFieldIdentity;
  operator: string;
  values: string[];
}
''',
)

replace_once(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''  const fieldCandidates = jiraFieldCandidates(value.field);
  if (!fieldCandidates || typeof value.operator !== "string") return null;
  const operator = value.operator.toLocaleLowerCase("en-US");

  if (JQL_COMPARISON_OPERATORS.has(operator)) {
    const operand = jiraSingleOperandValue(value.operand);
    return operand === null
      ? null
      : [{ fieldCandidates, operator, values: [operand] }];
  }
''',
    '''  const fieldIdentity = jiraFieldIdentity(value.field);
  if (!fieldIdentity || typeof value.operator !== "string") return null;
  const operator = value.operator.toLocaleLowerCase("en-US");

  if (JQL_COMPARISON_OPERATORS.has(operator)) {
    const operand = jiraSingleOperandValue(value.operand);
    return operand === null
      ? null
      : [{ fieldIdentity, operator, values: [operand] }];
  }
''',
)

replace_once(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''            fieldCandidates,
            operator: operator.toUpperCase(),
            values: operands,
''',
    '''            fieldIdentity,
            operator: operator.toUpperCase(),
            values: operands,
''',
)

replace_once(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''        fieldCandidates,
        operator: operator === "is" ? "IS EMPTY" : "IS NOT EMPTY",
        values: [],
''',
    '''        fieldIdentity,
        operator: operator === "is" ? "IS EMPTY" : "IS NOT EMPTY",
        values: [],
''',
)

replace_once(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''    const expectedField = normalizedJqlFieldCandidate(expectedClause.field);
    return (
      actualClause.fieldCandidates.includes(expectedField) &&
      actualClause.operator === expectedClause.operator &&
      sameStrings(expectedClause.values, actualClause.values)
    );
''',
    '''    return (
      jiraFieldMatchesExpected(actualClause.fieldIdentity, expectedClause.field) &&
      actualClause.operator === expectedClause.operator &&
      sameStrings(expectedClause.values, actualClause.values)
    );
''',
)

# SCRUM-56: reject contradictory boolean/numeric pagination metadata.
replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''  if (typeof page.isLast === "boolean") {
    return page.isLast;
  }

  if (startAt !== null && maxResults !== null && total !== null) {
    return startAt + maxResults >= total;
  }
''',
    '''  const hasCompleteNumericPagination =
    startAt !== null && maxResults !== null && total !== null;
  const numericIsLast = hasCompleteNumericPagination
    ? startAt + maxResults >= total
    : null;

  if (typeof page.isLast === "boolean") {
    if (numericIsLast !== null && page.isLast !== numericIsLast) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        `${resource} returned contradictory pagination metadata.`,
      );
    }
    return page.isLast;
  }

  if (numericIsLast !== null) {
    return numericIsLast;
  }
''',
)

# SCRUM-57: fixVersions from issue search must use numeric Jira IDs.
replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''  if (!id || !name) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "Issue search fixVersion returned an unexpected response.",
    );
  }
  return { id, name };
''',
    '''  if (!id || !/^\\d+$/.test(id) || !name) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "Issue search fixVersion returned an unexpected response.",
    );
  }
  return { id, name };
''',
)

# SCRUM-55 regressions.
replace_once(
    "tests/infrastructure/jira-jql-validation.test.ts",
    '''  it.each([\n    [\n      "leerem where-Parsebaum",\n''',
    '''  it("weist widersprüchliche Custom-Field-Identität fail-closed zurück", () => {
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
''',
)

# SCRUM-56 regressions.
replace_once(
    "tests/infrastructure/jira-page-boundary-validation.test.ts",
    '''  it.each([\n    ["nicht-booleschem isLast", { values: [], isLast: "true" }],\n''',
    '''  it("akzeptiert konsistente kombinierte Pagination-Metadaten", () => {
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
''',
)

# SCRUM-57 regressions.
replace_once(
    "tests/infrastructure/jira-errors.test.ts",
    '''    ["Version mit leerer id", { id: " ", name: "1.0.0" }],\n  ] satisfies ReadonlyArray<readonly [string, unknown]>)(\n''',
    '''    ["Version mit leerer id", { id: " ", name: "1.0.0" }],
    ["Version mit nichtnumerischer id", { id: "30001x", name: "1.0.0" }],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
''',
)

replace_once(
    "tests/infrastructure/jira-errors.test.ts",
    '''  it("behält vollständige fixVersions-Evidence unverändert", async () => {\n''',
    '''  it("verwirft bei gemischten numerischen und nichtnumerischen fixVersions das gesamte Ergebnis", async () => {
    const sourceIssue = {
      ...jiraIssue(1),
      fields: {
        ...jiraIssue(1).fields,
        fixVersions: [
          { id: "30001", name: "1.0.0" },
          { id: "30002x", name: "2.0.0" },
        ],
      },
    };

    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () => Promise.resolve({ issues: [sourceIssue] }),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("behält vollständige fixVersions-Evidence unverändert", async () => {
''',
)

print("SCRUM-55-57 changes applied successfully.")
