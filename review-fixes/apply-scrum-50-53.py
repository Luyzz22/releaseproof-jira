from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:80]!r}")
    file.write_text(text.replace(old, new, 1))


# SCRUM-50: require a populated Jira JQL parse clause tree.
client = "src/infrastructure/jira/forge-jira-client.ts"
marker = "export function parsedJqlIsValid(\n"
helpers = '''const JQL_COMPOUND_OPERATORS = new Set(["and", "or", "not"]);\nconst JQL_FIELD_VALUE_OPERATORS = new Set([\n  "=",\n  "!=",\n  ">",\n  "<",\n  ">=",\n  "<=",\n  "in",\n  "not in",\n  "~",\n  "~=",\n  "is",\n  "is not",\n]);\n\nfunction isNonEmptyString(value: unknown): value is string {\n  return typeof value === "string" && value.trim().length > 0;\n}\n\nfunction isValidJqlUnitaryOperand(value: unknown): boolean {\n  if (!isRecord(value)) return false;\n  if (isNonEmptyString(value.value)) return true;\n  if (value.keyword === "empty") return true;\n  return (\n    isNonEmptyString(value.function) &&\n    Array.isArray(value.arguments) &&\n    value.arguments.every((argument) => typeof argument === "string")\n  );\n}\n\nfunction isValidJqlOperand(value: unknown): boolean {\n  if (isValidJqlUnitaryOperand(value)) return true;\n  if (!isRecord(value) || !Array.isArray(value.values) || value.values.length === 0) {\n    return false;\n  }\n  return value.values.every(isValidJqlUnitaryOperand);\n}\n\nfunction isValidJqlWhereClause(value: unknown): boolean {\n  if (!isRecord(value)) return false;\n\n  if (value.clauses !== undefined) {\n    return (\n      Array.isArray(value.clauses) &&\n      value.clauses.length > 0 &&\n      isNonEmptyString(value.operator) &&\n      JQL_COMPOUND_OPERATORS.has(value.operator) &&\n      value.clauses.every(isValidJqlWhereClause)\n    );\n  }\n\n  const field = isRecord(value.field) ? value.field : null;\n  return (\n    field !== null &&\n    isNonEmptyString(field.name) &&\n    isNonEmptyString(value.operator) &&\n    JQL_FIELD_VALUE_OPERATORS.has(value.operator) &&\n    isValidJqlOperand(value.operand)\n  );\n}\n\n'''
replace_once(client, marker, helpers + marker)
replace_once(
    client,
    '  const structure = requireRecord(query.structure, "JQL validation structure");\n  requireRecord(structure.where, "JQL validation where structure");\n\n  return true;\n',
    '  const structure = requireRecord(query.structure, "JQL validation structure");\n  const where = requireRecord(structure.where, "JQL validation where structure");\n  if (!isValidJqlWhereClause(where)) {\n    throw new AppError(\n      "JIRA_UNAVAILABLE",\n      "JQL validation returned an unexpected response.",\n    );\n  }\n\n  return true;\n',
)

# SCRUM-51 + SCRUM-53: strict acceptance-criteria shapes and version identity.
gateway = "src/infrastructure/jira/forge-jira-gateway.ts"
replace_once(
    gateway,
    '''  if (\n    !id ||\n    !name ||\n    !projectId ||\n    typeof value.released !== "boolean" ||\n    typeof value.archived !== "boolean"\n  ) {\n''',
    '''  if (\n    !id ||\n    !/^\\d+$/.test(id) ||\n    !name ||\n    !projectId ||\n    !/^\\d+$/.test(projectId) ||\n    typeof value.released !== "boolean" ||\n    typeof value.archived !== "boolean"\n  ) {\n''',
)
replace_once(
    gateway,
    '''function requireMappedVersion(value: unknown, resource: string): JiraVersion {\n  const version = mapVersion(value);\n  if (version) return version;\n  throw new AppError(\n    "JIRA_UNAVAILABLE",\n    `${resource} returned an unexpected response.`,\n  );\n}\n''',
    '''function requireMappedVersion(value: unknown, resource: string): JiraVersion {\n  const version = mapVersion(value);\n  if (version) return version;\n  throw new AppError(\n    "JIRA_UNAVAILABLE",\n    `${resource} returned an unexpected response.`,\n  );\n}\n\nexport function mapVersionDetail(\n  value: unknown,\n  requestedVersionId: string,\n): JiraVersion {\n  const version = requireMappedVersion(value, "Version");\n  if (version.id !== requestedVersionId) {\n    throw new AppError(\n      "JIRA_UNAVAILABLE",\n      "Version returned an unexpected response.",\n    );\n  }\n  return version;\n}\n''',
)
old_acceptance = '''function hasAcceptanceCriteriaEvidence(\n  value: unknown,\n  fieldId: string,\n): boolean {\n  if (value === null) return false;\n\n  if (isRecord(value) && value.type === "doc") {\n    if (!isStructurallyValidAdfDocument(value)) {\n      throw new AppError(\n        "JIRA_UNAVAILABLE",\n        fieldId === "description"\n          ? "Issue search description returned an unexpected response."\n          : "Issue search acceptance criteria returned an unexpected response.",\n      );\n    }\n    return jiraValueToText(value) !== null;\n  }\n\n  if (fieldId === "description") {\n    throw new AppError(\n      "JIRA_UNAVAILABLE",\n      "Issue search description returned an unexpected response.",\n    );\n  }\n\n  return jiraValueToText(value) !== null;\n}\n'''
new_acceptance = '''function hasAcceptanceCriteriaEvidence(\n  value: unknown,\n  fieldId: string,\n): boolean {\n  if (value === null) return false;\n\n  if (typeof value === "string") {\n    if (fieldId === "description") {\n      throw new AppError(\n        "JIRA_UNAVAILABLE",\n        "Issue search description returned an unexpected response.",\n      );\n    }\n    return jiraValueToText(value) !== null;\n  }\n\n  if (isRecord(value) && value.type === "doc") {\n    if (!isStructurallyValidAdfDocument(value)) {\n      throw new AppError(\n        "JIRA_UNAVAILABLE",\n        fieldId === "description"\n          ? "Issue search description returned an unexpected response."\n          : "Issue search acceptance criteria returned an unexpected response.",\n      );\n    }\n    return jiraValueToText(value) !== null;\n  }\n\n  throw new AppError(\n    "JIRA_UNAVAILABLE",\n    fieldId === "description"\n      ? "Issue search description returned an unexpected response."\n      : "Issue search acceptance criteria returned an unexpected response.",\n  );\n}\n'''
replace_once(gateway, old_acceptance, new_acceptance)
replace_once(
    gateway,
    '    return requireMappedVersion(data, "Version");\n',
    '    return mapVersionDetail(data, versionId);\n',
)

# SCRUM-52: apply the 10k work budget to the complete JSON structure.
adf = "src/infrastructure/jira/adf-to-text.ts"
old_guard = '''function hasSafeAdfNodeCount(value: unknown): boolean {\n  const stack: unknown[] = [value];\n  let scheduledEntries = 1;\n\n  while (stack.length > 0) {\n    const current = stack.pop();\n\n    if (!isRecord(current)) continue;\n    if (current.content === undefined) continue;\n    if (!Array.isArray(current.content)) return false;\n\n    if (scheduledEntries + current.content.length > MAX_NODES) {\n      return false;\n    }\n    scheduledEntries += current.content.length;\n\n    for (const child of current.content) {\n      stack.push(child);\n    }\n  }\n\n  return true;\n}\n'''
new_guard = '''function hasSafeAdfStructureSize(value: unknown): boolean {\n  const stack: unknown[] = [value];\n  let scheduledEntries = 1;\n\n  while (stack.length > 0) {\n    const current = stack.pop();\n\n    if (Array.isArray(current)) {\n      if (scheduledEntries + current.length > MAX_NODES) return false;\n      scheduledEntries += current.length;\n      for (const item of current) stack.push(item);\n      continue;\n    }\n\n    if (!isRecord(current)) continue;\n\n    const values = Object.values(current);\n    if (scheduledEntries + values.length > MAX_NODES) return false;\n    scheduledEntries += values.length;\n    for (const item of values) stack.push(item);\n  }\n\n  return true;\n}\n'''
replace_once(adf, old_guard, new_guard)
replace_once(adf, '!hasSafeAdfNodeCount(value)', '!hasSafeAdfStructureSize(value)')

# JQL regression fixtures.
jql_test = "tests/infrastructure/jira-jql-validation.test.ts"
replace_once(
    jql_test,
    'const expectedJql = "project = DEMO AND status = Fertig";\n',
    '''const expectedJql = "project = DEMO AND status = Fertig";\nconst validStructure = {\n  where: {\n    clauses: [\n      {\n        field: { name: "project" },\n        operand: { value: "DEMO" },\n        operator: "=",\n      },\n      {\n        field: { name: "status" },\n        operand: { value: "Fertig" },\n        operator: "=",\n      },\n    ],\n    operator: "and",\n  },\n};\n''',
)
# Replace all three success fixtures that previously contained only an operator.
text = Path(jql_test).read_text()
text = text.replace('structure: { where: { operator: "and" } },', 'structure: validStructure,')
Path(jql_test).write_text(text)
replace_once(
    jql_test,
    '  it.each([\n    ["fehlende queries", {}],\n',
    '''  it.each([\n    [\n      "leerem where-Parsebaum",\n      { queries: [{ query: "project = DEMO", structure: { where: {} } }] },\n    ],\n    [\n      "leerer Compound-Clause",\n      {\n        queries: [\n          {\n            query: "project = DEMO",\n            structure: { where: { clauses: [], operator: "and" } },\n          },\n        ],\n      },\n    ],\n    [\n      "Terminal-Clause ohne Operand",\n      {\n        queries: [\n          {\n            query: "project = DEMO",\n            structure: {\n              where: { field: { name: "project" }, operator: "=" },\n            },\n          },\n        ],\n      },\n    ],\n    ["fehlende queries", {}],\n''',
)

# Acceptance-criteria malformed custom field shapes.
acceptance_test = "tests/infrastructure/acceptance-criteria-evidence.test.ts"
replace_once(
    acceptance_test,
    '  it.each([\n    ["direktem String", "Kriterium"],\n',
    '''  it.each([\n    ["undefined", undefined],\n    ["einem Array", ["Kriterium"]],\n    ["einer Zahl", 42],\n    ["einem Boolean", true],\n    ["einem Nicht-ADF-Objekt", { value: "Kriterium" }],\n  ] satisfies ReadonlyArray<readonly [string, unknown]>)(\n    "weist Custom-Textfeld mit %s fail-closed zurück",\n    async (_case, value) => {\n      await expect(mapAcceptanceCriteria(value)).rejects.toMatchObject({\n        code: "JIRA_UNAVAILABLE",\n      });\n    },\n  );\n\n  it.each([\n    ["direktem String", "Kriterium"],\n''',
)

# ADF oversized marks regression.
adf_test = "tests/infrastructure/adf-to-text.test.ts"
replace_once(
    adf_test,
    '  it("übernimmt einen direkten String", () => {\n',
    '''  it("stoppt übergroße marks-Arrays vor der Schema-Validierung", () => {\n    const validateSpy = vi.spyOn(Validator.prototype, "validate");\n\n    try {\n      expect(\n        isStructurallyValidAdfDocument({\n          type: "doc",\n          version: 1,\n          content: [\n            {\n              type: "paragraph",\n              content: [\n                {\n                  type: "text",\n                  text: "Kriterium",\n                  marks: Array.from({ length: 10_000 }, () => ({\n                    type: "strong",\n                  })),\n                },\n              ],\n            },\n          ],\n        }),\n      ).toBe(false);\n      expect(validateSpy).not.toHaveBeenCalled();\n    } finally {\n      validateSpy.mockRestore();\n    }\n  });\n\n  it("übernimmt einen direkten String", () => {\n''',
)

# Version boundary regressions.
version_test = "tests/infrastructure/jira-page-boundary-validation.test.ts"
replace_once(
    version_test,
    '  mapVersionSearchPage,\n',
    '  mapVersionDetail,\n  mapVersionSearchPage,\n',
)
replace_once(
    version_test,
    '    ["fehlendem released", { ...version, released: undefined }],\n',
    '''    ["nichtnumerischer ID", { ...version, id: "broken" }],\n    ["nichtnumerischer projectId", { ...version, projectId: "broken" }],\n    ["fehlendem released", { ...version, released: undefined }],\n''',
)
replace_once(
    version_test,
    '  it("verwirft bei gemischten gültigen und malformed Versionen die gesamte Seite", () => {\n',
    '''  it("bindet eine Version-Detailantwort an die angefragte ID", () => {\n    expect(mapVersionDetail(version, "30001")).toEqual({\n      ...version,\n      projectId: "10000",\n    });\n    expect(() => mapVersionDetail({ ...version, id: "30002" }, "30001")).toThrowError(\n      expect.objectContaining({ code: "JIRA_UNAVAILABLE" }),\n    );\n  });\n\n  it("verwirft bei gemischten gültigen und malformed Versionen die gesamte Seite", () => {\n''',
)

print("SCRUM-50/53 changes applied successfully.")
