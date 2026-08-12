from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise RuntimeError(f"expected block not found in {path}: {old[:80]!r}")
    write(path, text.replace(old, new, 1))


# SCRUM-60: fixVersion is forbidden only as a parsed clause field, not as a value.
validation = "src/shared/validation.ts"
replace_once(
    validation,
    '''  const { tokens } = tokenized;\n  if (\n    tokens.some((token) => {\n      const field = normalizedFieldName(token.value);\n      return field === "fixversion" || field === "fixversions";\n    })\n  ) {\n    return {\n      valid: false,\n      code: "FIX_VERSION_FORBIDDEN",\n      message: "Der Release-Umfang darf keine fixVersion-Bedingung enthalten.",\n    };\n  }\n\n  if (tokens.some((token) => isKeyword(token, "OR"))) {\n''',
    '''  const { tokens } = tokenized;\n\n  if (tokens.some((token) => isKeyword(token, "OR"))) {\n''',
)
replace_once(
    validation,
    '''  const parsed = parseConjunctiveJql(tokens);\n  if (!parsed.ok) {\n    return {\n      valid: false,\n      code: "SYNTAX_INVALID",\n      message:\n        "Der Release-Umfang ist syntaktisch unvollständig oder verwendet eine nicht unterstützte JQL-Form.",\n    };\n  }\n\n  const [projectClause] = parsed.clauses;\n''',
    '''  const parsed = parseConjunctiveJql(tokens);\n  if (!parsed.ok) {\n    return {\n      valid: false,\n      code: "SYNTAX_INVALID",\n      message:\n        "Der Release-Umfang ist syntaktisch unvollständig oder verwendet eine nicht unterstützte JQL-Form.",\n    };\n  }\n\n  if (\n    parsed.clauses.some((clause) => {\n      const field = normalizedFieldName(clause.field.value);\n      return field === "fixversion" || field === "fixversions";\n    })\n  ) {\n    return {\n      valid: false,\n      code: "FIX_VERSION_FORBIDDEN",\n      message: "Der Release-Umfang darf keine fixVersion-Bedingung enthalten.",\n    };\n  }\n\n  const [projectClause] = parsed.clauses;\n''',
)

# SCRUM-59: name/encodedName must be consistent for system fields too.
client = "src/infrastructure/jira/forge-jira-client.ts"
replace_once(
    client,
    '''  if (\n    name !== null &&\n    encodedName !== null &&\n    isCustomFieldReference(name) &&\n    isCustomFieldReference(encodedName) &&\n    name !== encodedName\n  ) {\n    return null;\n  }\n\n  return { name, encodedName };\n''',
    '''  if (name !== null && encodedName !== null) {\n    if (isCustomFieldReference(encodedName)) {\n      if (isCustomFieldReference(name) && name !== encodedName) return null;\n    } else if (name !== encodedName) {\n      return null;\n    }\n  }\n\n  return { name, encodedName };\n''',
)

# SCRUM-61/62/58: pagination count, numeric status IDs and project-bound issue hits.
gateway = "src/infrastructure/jira/forge-jira-gateway.ts"
old_is_last = '''export function isLastPage(value: unknown, resource: string): boolean {\n  const page = requireRecord(value, resource);\n\n  if (page.isLast !== undefined && typeof page.isLast !== "boolean") {\n    throw new AppError(\n      "JIRA_UNAVAILABLE",\n      `${resource} returned invalid isLast pagination metadata.`,\n    );\n  }\n\n  const startAt =\n    page.startAt === undefined\n      ? null\n      : requirePageInteger(page.startAt, resource, "startAt");\n  const maxResults =\n    page.maxResults === undefined\n      ? null\n      : requirePageInteger(page.maxResults, resource, "maxResults", true);\n  const total =\n    page.total === undefined\n      ? null\n      : requirePageInteger(page.total, resource, "total");\n\n  const hasCompleteNumericPagination =\n    startAt !== null && maxResults !== null && total !== null;\n  const numericIsLast = hasCompleteNumericPagination\n    ? startAt + maxResults >= total\n    : null;\n\n  if (typeof page.isLast === "boolean") {\n    if (numericIsLast !== null && page.isLast !== numericIsLast) {\n      throw new AppError(\n        "JIRA_UNAVAILABLE",\n        `${resource} returned contradictory pagination metadata.`,\n      );\n    }\n    return page.isLast;\n  }\n\n  if (numericIsLast !== null) {\n    return numericIsLast;\n  }\n\n  throw new AppError(\n    "JIRA_UNAVAILABLE",\n    `${resource} returned incomplete pagination metadata.`,\n  );\n}\n'''
new_is_last = '''export function isLastPage(value: unknown, resource: string): boolean {\n  const page = requireRecord(value, resource);\n  const values = requireArray(page.values, `${resource} values`);\n\n  if (page.isLast !== undefined && typeof page.isLast !== "boolean") {\n    throw new AppError(\n      "JIRA_UNAVAILABLE",\n      `${resource} returned invalid isLast pagination metadata.`,\n    );\n  }\n\n  const startAt =\n    page.startAt === undefined\n      ? null\n      : requirePageInteger(page.startAt, resource, "startAt");\n  const maxResults =\n    page.maxResults === undefined\n      ? null\n      : requirePageInteger(page.maxResults, resource, "maxResults", true);\n  const total =\n    page.total === undefined\n      ? null\n      : requirePageInteger(page.total, resource, "total");\n\n  const hasCompleteNumericPagination =\n    startAt !== null && maxResults !== null && total !== null;\n  let numericIsLast: boolean | null = null;\n\n  if (hasCompleteNumericPagination) {\n    if (\n      values.length > maxResults ||\n      startAt + values.length > total ||\n      (startAt + values.length < total && values.length < maxResults)\n    ) {\n      throw new AppError(\n        "JIRA_UNAVAILABLE",\n        `${resource} returned contradictory pagination metadata.`,\n      );\n    }\n    numericIsLast = startAt + values.length >= total;\n  }\n\n  if (typeof page.isLast === "boolean") {\n    if (numericIsLast !== null && page.isLast !== numericIsLast) {\n      throw new AppError(\n        "JIRA_UNAVAILABLE",\n        `${resource} returned contradictory pagination metadata.`,\n      );\n    }\n    return page.isLast;\n  }\n\n  if (numericIsLast !== null) {\n    return numericIsLast;\n  }\n\n  throw new AppError(\n    "JIRA_UNAVAILABLE",\n    `${resource} returned incomplete pagination metadata.`,\n  );\n}\n'''
replace_once(gateway, old_is_last, new_is_last)
replace_once(
    gateway,
    '''function mapStatus(value: unknown): StatusRef | null {\n  if (!isRecord(value)) return null;\n  const id = stringValue(value.id);\n  const name = stringValue(value.name);\n  return id && name ? { id, name } : null;\n}\n''',
    '''function mapStatus(value: unknown): StatusRef | null {\n  if (!isRecord(value)) return null;\n  const id = stringValue(value.id);\n  const name = stringValue(value.name);\n  return id && /^\\d+$/.test(id) && name ? { id, name } : null;\n}\n\nfunction requireMappedStatus(value: unknown, resource: string): StatusRef {\n  const status = mapStatus(value);\n  if (status) return status;\n  throw new AppError(\n    "JIRA_UNAVAILABLE",\n    `${resource} returned an unexpected response.`,\n  );\n}\n''',
)
replace_once(
    gateway,
    '''        status: mapStatus(fields.status),\n        resolution: requireNullableResolution(\n''',
    '''        status: requireMappedStatus(\n          fields.status,\n          "Issue search linked issue status",\n        ),\n        resolution: requireNullableResolution(\n''',
)
replace_once(
    gateway,
    '''function mapIssue(\n  value: unknown,\n  acceptanceCriteriaFieldId: string,\n): ReleaseIssue | null {\n''',
    '''function issueKeyBelongsToProject(key: string, projectKey: string): boolean {\n  const prefix = `${projectKey}-`;\n  return key.startsWith(prefix) && /^\\d+$/.test(key.slice(prefix.length));\n}\n\nfunction mapIssue(\n  value: unknown,\n  acceptanceCriteriaFieldId: string,\n  expectedProjectKey: string,\n): ReleaseIssue | null {\n''',
)
replace_once(
    gateway,
    '''  const issueTypeId = stringValue(issueType.id);\n  const issueTypeName = stringValue(issueType.name);\n  if (\n    !id ||\n    !key ||\n    !issueTypeId ||\n    !/^\\d+$/.test(issueTypeId) ||\n    !issueTypeName\n  ) {\n    return null;\n  }\n\n  return {\n''',
    '''  const issueTypeId = stringValue(issueType.id);\n  const issueTypeName = stringValue(issueType.name);\n  const status = mapStatus(fields.status);\n  if (\n    !id ||\n    !key ||\n    !issueKeyBelongsToProject(key, expectedProjectKey) ||\n    !issueTypeId ||\n    !/^\\d+$/.test(issueTypeId) ||\n    !issueTypeName ||\n    !status\n  ) {\n    return null;\n  }\n\n  return {\n''',
)
replace_once(gateway, '''    status: mapStatus(fields.status),\n''', '''    status,\n''')
replace_once(
    gateway,
    '''function requireMappedIssue(\n  value: unknown,\n  acceptanceCriteriaFieldId: string,\n): ReleaseIssue {\n  const issue = mapIssue(value, acceptanceCriteriaFieldId);\n''',
    '''function requireMappedIssue(\n  value: unknown,\n  acceptanceCriteriaFieldId: string,\n  expectedProjectKey: string,\n): ReleaseIssue {\n  const issue = mapIssue(value, acceptanceCriteriaFieldId, expectedProjectKey);\n''',
)
replace_once(
    gateway,
    '''  input: {\n    jql: string;\n    acceptanceCriteriaFieldId: string;\n  },\n''',
    '''  input: {\n    jql: string;\n    projectKey: string;\n    acceptanceCriteriaFieldId: string;\n  },\n''',
)
replace_once(
    gateway,
    '''    const pageIssues = requireArray(pageData.issues, "Issue search").map(\n      (item) => requireMappedIssue(item, input.acceptanceCriteriaFieldId),\n    );\n''',
    '''    const pageIssues = requireArray(pageData.issues, "Issue search").map(\n      (item) =>\n        requireMappedIssue(\n          item,\n          input.acceptanceCriteriaFieldId,\n          input.projectKey,\n        ),\n    );\n''',
)
replace_once(
    gateway,
    '''    return this.listIssuesByJql(\n      buildVersionJql(input.projectKey, input.versionId),\n      input.acceptanceCriteriaFieldId,\n    );\n''',
    '''    return this.listIssuesByJql(\n      buildVersionJql(input.projectKey, input.versionId),\n      input.acceptanceCriteriaFieldId,\n      input.projectKey,\n    );\n''',
)
replace_once(
    gateway,
    '''    return this.listIssuesByJql(\n      input.releaseScopeJql,\n      input.acceptanceCriteriaFieldId,\n    );\n''',
    '''    return this.listIssuesByJql(\n      input.releaseScopeJql,\n      input.acceptanceCriteriaFieldId,\n      input.projectKey,\n    );\n''',
)
replace_once(
    gateway,
    '''  private async listIssuesByJql(\n    jql: string,\n    acceptanceCriteriaFieldId: string,\n  ): Promise<ReleaseIssue[]> {\n    return collectIssueSearchPages(\n      { jql, acceptanceCriteriaFieldId },\n''',
    '''  private async listIssuesByJql(\n    jql: string,\n    acceptanceCriteriaFieldId: string,\n    projectKey: string,\n  ): Promise<ReleaseIssue[]> {\n    return collectIssueSearchPages(\n      { jql, projectKey, acceptanceCriteriaFieldId },\n''',
)

# SCRUM-63: never silently truncate acceptance-criteria evidence.
adf = "src/infrastructure/jira/adf-to-text.ts"
replace_once(
    adf,
    '''import { Validator } from "jsonschema";\nimport adfSchema from "./adf-schema.json";\n''',
    '''import { Validator } from "jsonschema";\nimport { AppError } from "../../shared/errors";\nimport adfSchema from "./adf-schema.json";\n''',
)
replace_once(
    adf,
    '''interface CollectionState {\n  nodes: number;\n  textLength: number;\n}\n''',
    '''interface CollectionState {\n  nodes: number;\n  textLength: number;\n  textLimitExceeded: boolean;\n}\n''',
)
replace_once(
    adf,
    '''  if (state.nodes > MAX_NODES || state.textLength >= MAX_TEXT_LENGTH) {\n    return;\n  }\n''',
    '''  if (state.nodes > MAX_NODES || state.textLimitExceeded) {\n    return;\n  }\n''',
)
replace_once(
    adf,
    '''  if (value.type === "text" && typeof value.text === "string") {\n    const remaining = MAX_TEXT_LENGTH - state.textLength;\n    const text = value.text.slice(0, remaining);\n\n    output.push(text);\n    state.textLength += text.length;\n    return;\n  }\n''',
    '''  if (value.type === "text" && typeof value.text === "string") {\n    const remaining = MAX_TEXT_LENGTH - state.textLength;\n    if (value.text.length > remaining) {\n      state.textLimitExceeded = true;\n      return;\n    }\n\n    output.push(value.text);\n    state.textLength += value.text.length;\n    return;\n  }\n''',
)
replace_once(
    adf,
    '''    if (state.nodes > MAX_NODES || state.textLength >= MAX_TEXT_LENGTH) {\n      break;\n    }\n''',
    '''    if (state.nodes > MAX_NODES || state.textLimitExceeded) {\n      break;\n    }\n''',
)
replace_once(
    adf,
    '''export function jiraValueToText(value: unknown): string | null {\n  if (typeof value === "string") {\n    return normalizeExtractedText(value.slice(0, MAX_TEXT_LENGTH));\n  }\n\n  if (!isRecord(value) || value.type !== "doc") return null;\n\n  const output: string[] = [];\n  collectAdfNode(value, output, { nodes: 0, textLength: 0 });\n\n  return normalizeExtractedText(output.join(" "));\n}\n''',
    '''export function jiraValueToText(value: unknown): string | null {\n  if (typeof value === "string") {\n    if (value.length > MAX_TEXT_LENGTH) {\n      throw new AppError(\n        "JIRA_UNAVAILABLE",\n        "Jira text evidence exceeded the configured processing limit.",\n      );\n    }\n    return normalizeExtractedText(value);\n  }\n\n  if (!isRecord(value) || value.type !== "doc") return null;\n\n  const output: string[] = [];\n  const state: CollectionState = {\n    nodes: 0,\n    textLength: 0,\n    textLimitExceeded: false,\n  };\n  collectAdfNode(value, output, state);\n\n  if (state.textLimitExceeded) {\n    throw new AppError(\n      "JIRA_UNAVAILABLE",\n      "Jira text evidence exceeded the configured processing limit.",\n    );\n  }\n\n  return normalizeExtractedText(output.join(" "));\n}\n''',
)

# Make project identity explicit in every direct test use of collectIssueSearchPages.
for path in Path("tests").rglob("*.ts"):
    text = path.read_text(encoding="utf-8")
    if "collectIssueSearchPages(" not in text:
        continue
    updated = re.sub(
        r'(\n\s*jql:\s*[^\n]+,\n)(\s*)(acceptanceCriteriaFieldId:)',
        lambda m: f'{m.group(1)}{m.group(2)}projectKey: "DEMO",\n{m.group(2)}{m.group(3)}',
        text,
    )
    path.write_text(updated, encoding="utf-8")

# SCRUM-59 regressions.
path = "tests/infrastructure/jira-jql-validation.test.ts"
text = read(path)
marker = "\n});\n"
pos = text.rfind(marker)
if pos < 0:
    raise RuntimeError(f"describe end not found in {path}")
addition = r'''

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
'''
write(path, text[:pos] + addition + text[pos:])

# SCRUM-60 regressions.
path = "tests/shared/release-scope-validation.test.ts"
text = read(path)
needle = '''  it("akzeptiert Sonderzeichen weiterhin in gequoteten Values", () => {\n    expect(\n      validateReleaseScopeJql(\n        'project = SCRUM AND status = "foo;bar/baz@example.com"',\n        "SCRUM",\n      ),\n    ).toEqual({ valid: true });\n  });\n'''
if needle not in text:
    raise RuntimeError(f"insert point not found in {path}")
text = text.replace(
    needle,
    needle
    + r'''

  it.each([
    'project = SCRUM AND labels = "fixVersion"',
    "project = SCRUM AND labels = fixVersion",
    'project = SCRUM AND summary ~ "fixVersions"',
  ])("erlaubt fixVersion ausschließlich als Klauselwert: %s", (jql) => {
    expect(validateReleaseScopeJql(jql, "SCRUM")).toEqual({ valid: true });
  });
''',
    1,
)
write(path, text)

# SCRUM-61 pagination regressions and update existing fixtures to carry the delivered count.
path = "tests/infrastructure/jira-page-boundary-validation.test.ts"
text = read(path)
text = text.replace(
    '''          values: [],\n          isLast: true,\n          startAt: 100,\n          maxResults: 50,\n          total: 150,\n''',
    '''          values: Array.from({ length: 50 }, () => null),\n          isLast: true,\n          startAt: 100,\n          maxResults: 50,\n          total: 150,\n''',
    1,
)
text = text.replace(
    '''          values: [],\n          isLast: false,\n          startAt: 0,\n          maxResults: 100,\n          total: 150,\n''',
    '''          values: Array.from({ length: 100 }, () => null),\n          isLast: false,\n          startAt: 0,\n          maxResults: 100,\n          total: 150,\n''',
    1,
)
# Replace the second contradictory fixture only (the one at startAt 100).
text = text.replace(
    '''        values: [],\n        isLast: false,\n        startAt: 100,\n        maxResults: 50,\n        total: 150,\n''',
    '''        values: Array.from({ length: 50 }, () => null),\n        isLast: false,\n        startAt: 100,\n        maxResults: 50,\n        total: 150,\n''',
    1,
)
needle = '''  it.each([\n    ["nicht-booleschem isLast", { values: [], isLast: "true" }],\n'''
if needle not in text:
    raise RuntimeError(f"pagination insert point not found in {path}")
text = text.replace(
    needle,
    r'''  it("weist eine terminal deklarierte, aber unvollständig gelieferte Seite zurück", () => {
    expect(() =>
      isLastPage(
        {
          values: Array.from({ length: 50 }, () => null),
          isLast: true,
          startAt: 0,
          maxResults: 100,
          total: 100,
        },
        "Project search",
      ),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

  it("akzeptiert eine tatsächlich vollständige partielle letzte Seite", () => {
    expect(
      isLastPage(
        {
          values: Array.from({ length: 50 }, () => null),
          isLast: true,
          startAt: 100,
          maxResults: 100,
          total: 150,
        },
        "Project search",
      ),
    ).toBe(true);
  });

''' + needle,
    1,
)
write(path, text)

# SCRUM-62 project metadata regression.
path = "tests/infrastructure/project-metadata-validation.test.ts"
text = read(path)
needle = '''    [\n      "Status ohne Namen",\n      [\n        {\n          id: "10001",\n          name: "Story",\n          subtask: false,\n          statuses: [{ id: "31" }],\n        },\n      ],\n    ],\n'''
if needle not in text:
    raise RuntimeError(f"status metadata insert point not found in {path}")
text = text.replace(
    needle,
    needle
    + '''    [\n      "Status mit nichtnumerischer ID",\n      [\n        {\n          id: "10001",\n          name: "Story",\n          subtask: false,\n          statuses: [{ id: "done", name: "Fertig" }],\n        },\n      ],\n    ],\n''',
    1,
)
write(path, text)

# SCRUM-58/62 issue-boundary regressions.
path = "tests/infrastructure/jira-errors.test.ts"
text = read(path)
marker = "\n});\n"
pos = text.rfind(marker)
if pos < 0:
    raise RuntimeError(f"describe end not found in {path}")
addition = r'''

  it("bindet jeden Suchtreffer an den erwarteten Projektschlüssel", async () => {
    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () => Promise.resolve({ issues: [{ ...jiraIssue(1), key: "OTHER-1" }] }),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("verwirft eine gemischte Seite vollständig bei projektfremdem Treffer", async () => {
    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () =>
          Promise.resolve({
            issues: [jiraIssue(1), { ...jiraIssue(2), key: "OTHER-2" }],
          }),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("weist eine nichtnumerische Hauptstatus-ID fail-closed zurück", async () => {
    const source = jiraIssue(1);
    source.fields.status = { id: "done", name: "Fertig" };
    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () => Promise.resolve({ issues: [source] }),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("weist nichtnumerische Status-IDs in Subtasks und Links fail-closed zurück", async () => {
    const subtaskIssue = jiraIssue(1);
    subtaskIssue.fields.subtasks = [
      {
        id: "2",
        key: "DEMO-2",
        fields: {
          status: { id: "done", name: "Fertig" },
          resolution: null,
        },
      },
    ];
    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () => Promise.resolve({ issues: [subtaskIssue] }),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });

    const linkedIssue = jiraIssue(1);
    const link = blockingIssueLink();
    link.inwardIssue.fields.status = { id: "done", name: "Offen" };
    linkedIssue.fields.issuelinks = [link];
    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () => Promise.resolve({ issues: [linkedIssue] }),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });
'''
write(path, text[:pos] + addition + text[pos:])

# SCRUM-63 utility and full boundary regressions.
path = "tests/infrastructure/adf-to-text.test.ts"
text = read(path)
replace_old = '''  it("begrenzt einen direkten String auf 50.000 Zeichen", () => {\n    expect(jiraValueToText("x".repeat(60_000))).toHaveLength(50_000);\n  });\n'''
replace_new = '''  it("weist einen direkten String über 50.000 Zeichen fail-closed zurück", () => {\n    expect(() => jiraValueToText("x".repeat(50_001))).toThrowError(\n      expect.objectContaining({ code: "JIRA_UNAVAILABLE" }),\n    );\n  });\n'''
if replace_old not in text:
    raise RuntimeError(f"direct text limit test not found in {path}")
text = text.replace(replace_old, replace_new, 1)
replace_old = '''  it("begrenzt ADF-Text auf 50.000 Zeichen", () => {\n    const text = jiraValueToText({\n      type: "doc",\n      content: [\n        {\n          type: "paragraph",\n          content: [{ type: "text", text: "x".repeat(60_000) }],\n        },\n      ],\n    });\n    expect(text).toHaveLength(50_000);\n  });\n'''
replace_new = '''  it("weist ADF-Text über 50.000 Zeichen fail-closed zurück", () => {\n    expect(() =>\n      jiraValueToText({\n        type: "doc",\n        version: 1,\n        content: [\n          {\n            type: "paragraph",\n            content: [{ type: "text", text: "x".repeat(50_001) }],\n          },\n        ],\n      }),\n    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));\n  });\n'''
if replace_old not in text:
    raise RuntimeError(f"ADF text limit test not found in {path}")
text = text.replace(replace_old, replace_new, 1)
write(path, text)

path = "tests/infrastructure/acceptance-criteria-evidence.test.ts"
text = read(path)
marker = "\n});\n"
pos = text.rfind(marker)
if pos < 0:
    raise RuntimeError(f"describe end not found in {path}")
addition = r'''

  it("bricht bei direkter Acceptance-Criteria-Evidence über 50.000 Zeichen fail-closed ab", async () => {
    await expect(mapAcceptanceCriteria("x".repeat(50_001))).rejects.toMatchObject({
      code: "JIRA_UNAVAILABLE",
    });
  });

  it("bricht bei ADF-Acceptance-Criteria-Evidence über 50.000 Zeichen fail-closed ab", async () => {
    await expect(
      mapAcceptanceCriteria({
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "x".repeat(50_001) }],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("akzeptiert sichtbare Acceptance-Criteria-Evidence exakt am Textlimit", async () => {
    await expect(mapAcceptanceCriteria("x".repeat(50_000))).resolves.toBe(true);
  });
'''
write(path, text[:pos] + addition + text[pos:])

print("SCRUM-58-63 source and regression patches applied")
