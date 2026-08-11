from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"Expected exactly one match in {path}, found {text.count(old)}")
    file_path.write_text(text.replace(old, new, 1))


gateway = "src/infrastructure/jira/forge-jira-gateway.ts"

replace_once(
    gateway,
    '''function mapIssue(
  value: unknown,
  acceptanceCriteriaFieldId: string,
): ReleaseIssue | null {''',
    '''function hasAcceptanceCriteriaEvidence(
  value: unknown,
  fieldId: string,
): boolean {
  if (fieldId !== "description") {
    return jiraValueToText(value) !== null;
  }
  if (value === null) return false;
  if (
    !isRecord(value) ||
    value.type !== "doc" ||
    value.version !== 1 ||
    !Array.isArray(value.content)
  ) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "Issue search description returned an unexpected response.",
    );
  }
  return jiraValueToText(value) !== null;
}

function mapIssue(
  value: unknown,
  acceptanceCriteriaFieldId: string,
): ReleaseIssue | null {''',
)

replace_once(
    gateway,
    '''  if (!id || !key || !issueTypeId || !issueTypeName) return null;

  return {''',
    '''  if (
    !id ||
    !key ||
    !issueTypeId ||
    !/^\\d+$/.test(issueTypeId) ||
    !issueTypeName
  ) {
    return null;
  }

  return {''',
)

replace_once(
    gateway,
    '''    hasAcceptanceCriteria:
      jiraValueToText(fields[acceptanceCriteriaFieldId]) !== null,''',
    '''    hasAcceptanceCriteria: hasAcceptanceCriteriaEvidence(
      fields[acceptanceCriteriaFieldId],
      acceptanceCriteriaFieldId,
    ),''',
)

acceptance_test = "tests/infrastructure/acceptance-criteria-evidence.test.ts"

replace_once(
    acceptance_test,
    '''async function mapAcceptanceCriteria(value: unknown) {
  const issues = await collectIssueSearchPages(
    {
      jql: "project = DEMO",
      acceptanceCriteriaFieldId: "customfield_10042",
    },
    () => Promise.resolve({ issues: [issueWithAcceptanceCriteria(value)] }),
  );
  return issues[0]?.hasAcceptanceCriteria;
}

describe("Akzeptanzkriterien-Evidence", () => {''',
    '''async function mapAcceptanceCriteria(value: unknown) {
  const issues = await collectIssueSearchPages(
    {
      jql: "project = DEMO",
      acceptanceCriteriaFieldId: "customfield_10042",
    },
    () => Promise.resolve({ issues: [issueWithAcceptanceCriteria(value)] }),
  );
  return issues[0]?.hasAcceptanceCriteria;
}

async function mapDescriptionAcceptanceCriteria(value: unknown) {
  const baseIssue = issueWithAcceptanceCriteria(null);
  const issues = await collectIssueSearchPages(
    {
      jql: "project = DEMO",
      acceptanceCriteriaFieldId: "description",
    },
    () =>
      Promise.resolve({
        issues: [
          {
            ...baseIssue,
            fields: { ...baseIssue.fields, description: value },
          },
        ],
      }),
  );
  return issues[0]?.hasAcceptanceCriteria;
}

describe("Akzeptanzkriterien-Evidence", () => {''',
)

replace_once(
    acceptance_test,
    '''describe("Akzeptanzkriterien-Evidence", () => {
  it.each([''',
    '''describe("Akzeptanzkriterien-Evidence", () => {
  it.each([
    ["direktem String", "Kriterium"],
    ["ADF ohne version", { type: "doc", content: [] }],
    [
      "ADF mit nicht-arrayförmigem content",
      { type: "doc", version: 1, content: {} },
    ],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "weist description mit %s fail-closed zurück",
    async (_case, value) => {
      await expect(mapDescriptionAcceptanceCriteria(value)).rejects.toMatchObject({
        code: "JIRA_UNAVAILABLE",
      });
    },
  );

  it("akzeptiert sichtbaren Text in einer gültigen ADF-description", async () => {
    await expect(
      mapDescriptionAcceptanceCriteria({
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Kriterium" }],
          },
        ],
      }),
    ).resolves.toBe(true);
  });

  it.each([
    ["null", null],
    ["leerem ADF", { type: "doc", version: 1, content: [] }],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "wertet description mit %s als nicht vorhandenen Nachweis",
    async (_case, value) => {
      await expect(mapDescriptionAcceptanceCriteria(value)).resolves.toBe(false);
    },
  );

  it.each([''',
)

jira_errors_test = "tests/infrastructure/jira-errors.test.ts"

replace_once(
    jira_errors_test,
    '''  [
    "Vorgang ohne gültigen Issue-Typ",
    {
      ...jiraIssue(2),
      fields: {
        ...jiraIssue(2).fields,
        issuetype: null,
      },
    },
  ],
];''',
    '''  [
    "Vorgang ohne gültigen Issue-Typ",
    {
      ...jiraIssue(2),
      fields: {
        ...jiraIssue(2).fields,
        issuetype: null,
      },
    },
  ],
  [
    "Vorgang mit nichtnumerischer Issue-Typ-ID",
    {
      ...jiraIssue(2),
      fields: {
        ...jiraIssue(2).fields,
        issuetype: { id: "Story", name: "Story" },
      },
    },
  ],
];''',
)

replace_once(
    jira_errors_test,
    '''  it.each(malformedIssueCases)(
    "bricht bei %s vollständig ab",''',
    '''  it("behält eine numerische Issue-Typ-ID unverändert", async () => {
    const issues = await collectIssueSearchPages(
      {
        jql: "project = DEMO",
        acceptanceCriteriaFieldId: "customfield_10042",
      },
      () => Promise.resolve({ issues: [jiraIssue(1)] }),
    );

    expect(issues[0]?.issueType).toEqual({ id: "10001", name: "Story" });
  });

  it.each(malformedIssueCases)(
    "bricht bei %s vollständig ab",''',
)

print("SCRUM-42/43 changes applied successfully.")
