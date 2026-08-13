from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ABORT: {path}: expected replacement exactly once, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


# SCRUM-75: reject ambiguous Jira metadata aliases for one canonical field ID.
replace_once(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''  const names = new Set<string>([expected, canonical]);
  for (const field of fields) {
    if (normalizedJqlFieldCandidate(field.id) === canonical) {
      names.add(normalizedJqlFieldCandidate(field.name));
    }
  }
''',
    '''  const canonicalFieldNames = new Set(
    fields
      .filter((field) => normalizedJqlFieldCandidate(field.id) === canonical)
      .map((field) => normalizedJqlFieldCandidate(field.name)),
  );
  if (canonicalFieldNames.size > 1) return null;

  const names = new Set<string>([expected, canonical, ...canonicalFieldNames]);
''',
)

# SCRUM-76: retain emitted continuation tokens and fail closed on repeats/cycles.
replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''  const issues: ReleaseIssue[] = [];
  let nextPageToken: string | undefined;
  const fields = Array.from(
''',
    '''  const issues: ReleaseIssue[] = [];
  let nextPageToken: string | undefined;
  const seenPageTokens = new Set<string>();
  const fields = Array.from(
''',
)

replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''    if (pageToken === undefined) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        "Issue search returned an unexpected response.",
      );
    }

    issues.push(...pageIssues);
    nextPageToken = pageToken;
''',
    '''    if (pageToken === undefined) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        "Issue search returned an unexpected response.",
      );
    }

    if (seenPageTokens.has(pageToken)) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        "Issue search returned a non-advancing pagination token.",
      );
    }
    seenPageTokens.add(pageToken);

    issues.push(...pageIssues);
    nextPageToken = pageToken;
''',
)

# SCRUM-75 regressions.
replace_once(
    "tests/infrastructure/jira-jql-validation.test.ts",
    '''  it("schützt das Systemfeld project trotz gleichnamigem Custom Field", () => {
''',
    '''  it("weist widersprüchliche Metadaten-Aliase für dieselbe kanonische Feld-ID fail-closed zurück", () => {
    const jql = 'project = DEMO AND "Acceptance Criteria" = yes';
    const fields = [
      {
        id: "customfield_10042",
        name: "Acceptance Criteria",
        custom: true,
        schemaType: "string",
      },
      {
        id: "customfield_10042",
        name: "Status",
        custom: true,
        schemaType: "string",
      },
    ];

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
                        name: "Status",
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
        fields,
      ),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

  it("akzeptiert normalisiert identische Metadaten-Duplikate für dieselbe Feld-ID", () => {
    const jql = 'project = DEMO AND "Acceptance Criteria" = yes';
    const fields = [
      {
        id: "customfield_10042",
        name: "Acceptance Criteria",
        custom: true,
        schemaType: "string",
      },
      {
        id: "customfield_10042",
        name: " acceptance criteria ",
        custom: true,
        schemaType: "string",
      },
    ];

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
        fields,
      ),
    ).toBe(true);
  });

  it("schützt das Systemfeld project trotz gleichnamigem Custom Field", () => {
''',
)

# SCRUM-76 regressions.
replace_once(
    "tests/infrastructure/jira-errors.test.ts",
    '''  it("fordert description bei einem Custom Field nicht zusätzlich an", async () => {
''',
    '''  it("bricht bei einem unmittelbar wiederholten Enhanced-JQL-Token fail-closed ab", async () => {
    let calls = 0;

    await expect(
      collectIssueSearchPagesRaw(
        {
          jql: "project = DEMO",
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        (request) => {
          calls += 1;
          return Promise.resolve(
            request.nextPageToken
              ? {
                  issues: [jiraIssue(2)],
                  isLast: false,
                  nextPageToken: "page-2",
                }
              : {
                  issues: [jiraIssue(1)],
                  isLast: false,
                  nextPageToken: "page-2",
                },
          );
        },
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });

    expect(calls).toBe(2);
  });

  it("bricht bei einem zyklischen Enhanced-JQL-Token fail-closed ab", async () => {
    let calls = 0;

    await expect(
      collectIssueSearchPagesRaw(
        {
          jql: "project = DEMO",
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        (request) => {
          calls += 1;
          if (!request.nextPageToken) {
            return Promise.resolve({
              issues: [jiraIssue(1)],
              isLast: false,
              nextPageToken: "page-2",
            });
          }
          if (request.nextPageToken === "page-2") {
            return Promise.resolve({
              issues: [jiraIssue(2)],
              isLast: false,
              nextPageToken: "page-3",
            });
          }
          return Promise.resolve({
            issues: [jiraIssue(3)],
            isLast: false,
            nextPageToken: "page-2",
          });
        },
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });

    expect(calls).toBe(3);
  });

  it("akzeptiert eine fortschreitende dreiseitige Enhanced-JQL-Pagination", async () => {
    const issues = await collectIssueSearchPagesRaw(
      {
        jql: "project = DEMO",
        projectKey: "DEMO",
        acceptanceCriteriaFieldId: "customfield_10042",
      },
      (request) => {
        if (!request.nextPageToken) {
          return Promise.resolve({
            issues: [jiraIssue(1)],
            isLast: false,
            nextPageToken: "page-2",
          });
        }
        if (request.nextPageToken === "page-2") {
          return Promise.resolve({
            issues: [jiraIssue(2)],
            isLast: false,
            nextPageToken: "page-3",
          });
        }
        return Promise.resolve({ issues: [jiraIssue(3)], isLast: true });
      },
    );

    expect(issues.map((item) => item.key)).toEqual([
      "DEMO-1",
      "DEMO-2",
      "DEMO-3",
    ]);
  });

  it("fordert description bei einem Custom Field nicht zusätzlich an", async () => {
''',
)

print("SCRUM-75-76 source and regression patches applied")
