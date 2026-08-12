from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if text.count(old) != 1:
        raise SystemExit(f"ABORT: expected exactly one match in {path}, found {text.count(old)}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


# SCRUM-64: a canonical custom-field encodedName must never satisfy an expected system-field clause.
replace_once(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''  if (identity.name !== null) return identity.name === expected;\n  return identity.encodedName === expected;\n''',
    '''  if (\n    identity.encodedName !== null &&\n    isCustomFieldReference(identity.encodedName)\n  ) {\n    return false;\n  }\n\n  if (identity.name !== null) return identity.name === expected;\n  return identity.encodedName === expected;\n''',
)

# SCRUM-65: bind paginated metadata to the offset that was actually requested.
replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''export function isLastPage(value: unknown, resource: string): boolean {\n  const page = requireRecord(value, resource);\n  const values = requireArray(page.values, `${resource} values`);\n''',
    '''export function isLastPage(\n  value: unknown,\n  resource: string,\n  expectedStartAt?: number,\n): boolean {\n  const page = requireRecord(value, resource);\n  const values = requireArray(page.values, `${resource} values`);\n''',
)

replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''  const maxResults =\n    page.maxResults === undefined\n      ? null\n      : requirePageInteger(page.maxResults, resource, "maxResults", true);\n''',
    '''  if (expectedStartAt !== undefined) {\n    if (!Number.isInteger(expectedStartAt) || expectedStartAt < 0) {\n      throw new AppError(\n        "JIRA_UNAVAILABLE",\n        `${resource} received an invalid expected pagination offset.`,\n      );\n    }\n    if (startAt !== null && startAt !== expectedStartAt) {\n      throw new AppError(\n        "JIRA_UNAVAILABLE",\n        `${resource} returned pagination metadata for an unexpected offset.`,\n      );\n    }\n    if (expectedStartAt > 0 && startAt === null) {\n      throw new AppError(\n        "JIRA_UNAVAILABLE",\n        `${resource} returned pagination metadata without the requested offset.`,\n      );\n    }\n  }\n\n  const maxResults =\n    page.maxResults === undefined\n      ? null\n      : requirePageInteger(page.maxResults, resource, "maxResults", true);\n''',
)

for resource in ("Project search", "Field search", "Version search"):
    replace_once(
        "src/infrastructure/jira/forge-jira-gateway.ts",
        f'''      if (isLastPage(data, "{resource}")) {{\n''',
        f'''      if (isLastPage(data, "{resource}", startAt)) {{\n''',
    )

# SCRUM-66: project metadata issue-type IDs must be numeric Jira IDs.
replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''    if (!id || !name || typeof issueType.subtask !== "boolean") {\n''',
    '''    if (\n      !id ||\n      !/^\\d+$/.test(id) ||\n      !name ||\n      typeof issueType.subtask !== "boolean"\n    ) {\n''',
)

# SCRUM-64 regression coverage.
jql_test = Path("tests/infrastructure/jira-jql-validation.test.ts")
jql_text = jql_test.read_text(encoding="utf-8")
jql_insert = r'''

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
'''
if not jql_text.endswith("\n});\n"):
    raise SystemExit("ABORT: unexpected jira-jql-validation.test.ts ending")
jql_test.write_text(jql_text[:-5] + jql_insert + "\n});\n", encoding="utf-8")

# SCRUM-65 regression coverage.
page_test = Path("tests/infrastructure/jira-page-boundary-validation.test.ts")
page_text = page_test.read_text(encoding="utf-8")
page_anchor = '''  it("weist eine terminal deklarierte, aber unvollständig gelieferte Seite zurück", () => {\n'''
page_insert = '''  it("bindet numerische Pagination an den angeforderten Offset", () => {\n    const payload = {\n      values: Array.from({ length: 50 }, () => null),\n      isLast: true,\n      startAt: 100,\n      maxResults: 100,\n      total: 150,\n    };\n\n    expect(isLastPage(payload, "Project search", 100)).toBe(true);\n    expect(() => isLastPage(payload, "Project search", 0)).toThrowError(\n      expect.objectContaining({ code: "JIRA_UNAVAILABLE" }),\n    );\n  });\n\n  it("verlangt auf Folgeseiten startAt zur Offset-Bindung", () => {\n    expect(() =>\n      isLastPage(\n        { values: [], isLast: true },\n        "Version search",\n        100,\n      ),\n    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));\n\n    expect(isLastPage({ values: [], isLast: true }, "Version search", 0)).toBe(\n      true,\n    );\n  });\n\n'''
if page_anchor not in page_text:
    raise SystemExit("ABORT: pagination test anchor not found")
page_test.write_text(page_text.replace(page_anchor, page_insert + page_anchor, 1), encoding="utf-8")

# SCRUM-66 regression coverage.
replace_once(
    "tests/infrastructure/project-metadata-validation.test.ts",
    '''  it.each([\n    ["fehlendes subtask-Flag", [{ id: "10001", name: "Story", statuses: [] }]],\n''',
    '''  it.each([\n    [\n      "nichtnumerische Vorgangstyp-ID",\n      [{ id: "Story", name: "Story", subtask: false, statuses: [] }],\n    ],\n    ["fehlendes subtask-Flag", [{ id: "10001", name: "Story", statuses: [] }]],\n''',
)

print("SCRUM-64-66 source and regression patches applied")
