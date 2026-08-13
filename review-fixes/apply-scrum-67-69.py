from pathlib import Path


def replace_exact(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"ABORT: expected block not found in {path}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


# SCRUM-67: carry already-loaded Jira field metadata into strict JQL parse validation.
replace_exact(
    "src/application/ports.ts",
    '''export interface JiraJqlValidator {
  validateJql(jql: string): Promise<boolean>;
}
''',
    '''export interface JiraJqlValidator {
  validateJql(jql: string, fields: readonly JiraField[]): Promise<boolean>;
}
''',
)

replace_exact(
    "src/application/save-project-config/save-project-config.ts",
    '''    if (!(await jira.validateJql(input.releaseScopeJql))) {
''',
    '''    if (!(await jira.validateJql(input.releaseScopeJql, fields))) {
''',
)

replace_exact(
    "src/application/analyze-release/analyze-release.ts",
    '''    if (!(await jira.validateJql(config.releaseScopeJql))) {
''',
    '''    if (!(await jira.validateJql(config.releaseScopeJql, fields))) {
''',
)

replace_exact(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''import type { JiraJqlValidator } from "../../application/ports";
''',
    '''import type { JiraField, JiraJqlValidator } from "../../application/ports";
''',
)

replace_exact(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''function jiraFieldIdentity(value: unknown): JiraFieldIdentity | null {
  if (!isRecord(value)) return null;

  const name = isNonEmptyString(value.name)
    ? normalizedJqlFieldCandidate(value.name)
    : null;
  const encodedName = isNonEmptyString(value.encodedName)
    ? normalizedJqlFieldCandidate(value.encodedName)
    : null;
  if (name === null && encodedName === null) return null;

  if (name !== null && encodedName !== null) {
    if (isCustomFieldReference(encodedName)) {
      if (isCustomFieldReference(name) && name !== encodedName) return null;
    } else if (name !== encodedName) {
      return null;
    }
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

  if (
    identity.encodedName !== null &&
    isCustomFieldReference(identity.encodedName)
  ) {
    return false;
  }

  if (identity.name !== null) return identity.name === expected;
  return identity.encodedName === expected;
}
''',
    '''function jiraFieldIdentity(value: unknown): JiraFieldIdentity | null {
  if (!isRecord(value)) return null;

  const name = isNonEmptyString(value.name)
    ? normalizedJqlFieldCandidate(value.name)
    : null;
  const encodedName = isNonEmptyString(value.encodedName)
    ? normalizedJqlFieldCandidate(value.encodedName)
    : null;
  if (name === null && encodedName === null) return null;

  return { name, encodedName };
}

interface ExpectedJiraFieldIdentity {
  canonical: string;
  names: ReadonlySet<string>;
  custom: boolean;
}

const CONTROLLED_SYSTEM_FIELD_REFERENCES = new Set(["project", "key"]);

function expectedJiraFieldIdentity(
  expectedField: string,
  fields: readonly JiraField[],
): ExpectedJiraFieldIdentity | null {
  const expected = normalizedJqlFieldCandidate(expectedField);

  if (CONTROLLED_SYSTEM_FIELD_REFERENCES.has(expected)) {
    return {
      canonical: expected,
      names: new Set([expected]),
      custom: false,
    };
  }

  const idMatches = fields.filter(
    (field) => normalizedJqlFieldCandidate(field.id) === expected,
  );
  const candidates =
    idMatches.length > 0
      ? idMatches
      : fields.filter(
          (field) => normalizedJqlFieldCandidate(field.name) === expected,
        );

  if (candidates.length === 0) {
    return {
      canonical: expected,
      names: new Set([expected]),
      custom: isCustomFieldReference(expected),
    };
  }

  const canonicalIds = new Set(
    candidates.map((field) => normalizedJqlFieldCandidate(field.id)),
  );
  if (canonicalIds.size !== 1) return null;

  const canonical = canonicalIds.values().next().value;
  if (typeof canonical !== "string") return null;

  const names = new Set<string>([expected, canonical]);
  for (const field of fields) {
    if (normalizedJqlFieldCandidate(field.id) === canonical) {
      names.add(normalizedJqlFieldCandidate(field.name));
    }
  }

  return {
    canonical,
    names,
    custom: isCustomFieldReference(canonical),
  };
}

function jiraFieldMatchesExpected(
  identity: JiraFieldIdentity,
  expectedField: string,
  fields: readonly JiraField[],
): boolean {
  const expected = expectedJiraFieldIdentity(expectedField, fields);
  if (!expected) return false;

  if (expected.custom) {
    if (identity.encodedName !== null) {
      if (identity.encodedName !== expected.canonical) return false;
      return (
        identity.name === null ||
        !isCustomFieldReference(identity.name) ||
        identity.name === expected.canonical
      );
    }
    return identity.name !== null && expected.names.has(identity.name);
  }

  if (identity.encodedName !== null) {
    if (isCustomFieldReference(identity.encodedName)) return false;
    if (!expected.names.has(identity.encodedName)) return false;
  }
  if (identity.name !== null && !expected.names.has(identity.name)) {
    return false;
  }

  return identity.name !== null || identity.encodedName !== null;
}
''',
)

replace_exact(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''function jiraWhereSemanticallyMatches(
  value: unknown,
  requestedJql: string,
): boolean {
''',
    '''function jiraWhereSemanticallyMatches(
  value: unknown,
  requestedJql: string,
  fields: readonly JiraField[],
): boolean {
''',
)

replace_exact(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''      jiraFieldMatchesExpected(
        actualClause.fieldIdentity,
        expectedClause.field,
      ) &&
''',
    '''      jiraFieldMatchesExpected(
        actualClause.fieldIdentity,
        expectedClause.field,
        fields,
      ) &&
''',
)

replace_exact(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''export function parsedJqlIsValid(
  value: unknown,
  requestedJql: string,
): boolean {
''',
    '''export function parsedJqlIsValid(
  value: unknown,
  requestedJql: string,
  fields: readonly JiraField[] = [],
): boolean {
''',
)

replace_exact(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''  if (!jiraWhereSemanticallyMatches(where, requestedJql)) {
''',
    '''  if (!jiraWhereSemanticallyMatches(where, requestedJql, fields)) {
''',
)

replace_exact(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''  async validateJql(jql: string): Promise<boolean> {
''',
    '''  async validateJql(
    jql: string,
    fields: readonly JiraField[],
  ): Promise<boolean> {
''',
)

replace_exact(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''    return parsedJqlIsValid(data, jql);
''',
    '''    return parsedJqlIsValid(data, jql, fields);
''',
)

# SCRUM-68: advance pagination from the confirmed delivered page, not PAGE_SIZE.
replace_exact(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''  throw new AppError(
    "JIRA_UNAVAILABLE",
    `${resource} returned incomplete pagination metadata.`,
  );
}

function mapProject(value: unknown): JiraProject | null {
''',
    '''  throw new AppError(
    "JIRA_UNAVAILABLE",
    `${resource} returned incomplete pagination metadata.`,
  );
}

export function nextPageStartAt(
  currentStartAt: number,
  pageLength: number,
  resource: string,
): number {
  if (
    !Number.isInteger(currentStartAt) ||
    currentStartAt < 0 ||
    !Number.isInteger(pageLength) ||
    pageLength <= 0
  ) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      `${resource} returned a non-advancing pagination page.`,
    );
  }

  const nextStartAt = currentStartAt + pageLength;
  if (!Number.isSafeInteger(nextStartAt)) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      `${resource} returned an invalid pagination range.`,
    );
  }
  return nextStartAt;
}

function mapProject(value: unknown): JiraProject | null {
''',
)

# SCRUM-69: project IDs are Jira numeric IDs at both list and detail boundaries.
replace_exact(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''  const id = stringValue(value.id);
  const key = stringValue(value.key);
  const name = stringValue(value.name);
  return id && key && name ? { id, key, name } : null;
}
''',
    '''  const id = stringValue(value.id);
  const key = stringValue(value.key);
  const name = stringValue(value.name);
  return id && /^\\d+$/.test(id) && key && name ? { id, key, name } : null;
}
''',
)

replace_exact(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''  async listProjects(): Promise<JiraProject[]> {
    const projects: JiraProject[] = [];
    let complete = false;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const startAt = page * PAGE_SIZE;
      const data = await parseResponse(
        await api
          .asUser()
          .requestJira(
            route`/rest/api/3/project/search?startAt=${startAt}&maxResults=${PAGE_SIZE}`,
          ),
      );
      projects.push(...mapProjectSearchPage(data));
      if (isLastPage(data, "Project search", startAt)) {
        complete = true;
        break;
      }
    }
    if (!complete) throwPaginationLimit("Project pagination");
    return projects;
  }
''',
    '''  async listProjects(): Promise<JiraProject[]> {
    const projects: JiraProject[] = [];
    let complete = false;
    let startAt = 0;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const data = await parseResponse(
        await api
          .asUser()
          .requestJira(
            route`/rest/api/3/project/search?startAt=${startAt}&maxResults=${PAGE_SIZE}`,
          ),
      );
      const pageProjects = mapProjectSearchPage(data);
      projects.push(...pageProjects);
      if (isLastPage(data, "Project search", startAt)) {
        complete = true;
        break;
      }
      startAt = nextPageStartAt(startAt, pageProjects.length, "Project search");
    }
    if (!complete) throwPaginationLimit("Project pagination");
    return projects;
  }
''',
)

replace_exact(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''  async listFields(projectId: string): Promise<JiraField[]> {
    const fields: JiraField[] = [];
    let complete = false;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const startAt = page * PAGE_SIZE;
      const data = await parseResponse(
        await api
          .asUser()
          .requestJira(
            route`/rest/api/3/field/search?startAt=${startAt}&maxResults=${PAGE_SIZE}&projectIds=${projectId}`,
          ),
      );
      fields.push(...mapFieldSearchPage(data));
      if (isLastPage(data, "Field search", startAt)) {
        complete = true;
        break;
      }
    }
    if (!complete) throwPaginationLimit("Field pagination");
    return fields;
  }
''',
    '''  async listFields(projectId: string): Promise<JiraField[]> {
    const fields: JiraField[] = [];
    let complete = false;
    let startAt = 0;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const data = await parseResponse(
        await api
          .asUser()
          .requestJira(
            route`/rest/api/3/field/search?startAt=${startAt}&maxResults=${PAGE_SIZE}&projectIds=${projectId}`,
          ),
      );
      const pageFields = mapFieldSearchPage(data);
      fields.push(...pageFields);
      if (isLastPage(data, "Field search", startAt)) {
        complete = true;
        break;
      }
      startAt = nextPageStartAt(startAt, pageFields.length, "Field search");
    }
    if (!complete) throwPaginationLimit("Field pagination");
    return fields;
  }
''',
)

replace_exact(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''  async listVersions(projectIdOrKey: string): Promise<JiraVersion[]> {
    const versions: JiraVersion[] = [];
    let complete = false;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const startAt = page * PAGE_SIZE;
      const data = await parseResponse(
        await api
          .asUser()
          .requestJira(
            route`/rest/api/3/project/${projectIdOrKey}/version?startAt=${startAt}&maxResults=${PAGE_SIZE}&orderBy=-releaseDate`,
          ),
      );
      versions.push(...mapVersionSearchPage(data));
      if (isLastPage(data, "Version search", startAt)) {
        complete = true;
        break;
      }
    }
    if (!complete) throwPaginationLimit("Version pagination");
    return versions;
  }
''',
    '''  async listVersions(projectIdOrKey: string): Promise<JiraVersion[]> {
    const versions: JiraVersion[] = [];
    let complete = false;
    let startAt = 0;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const data = await parseResponse(
        await api
          .asUser()
          .requestJira(
            route`/rest/api/3/project/${projectIdOrKey}/version?startAt=${startAt}&maxResults=${PAGE_SIZE}&orderBy=-releaseDate`,
          ),
      );
      const pageVersions = mapVersionSearchPage(data);
      versions.push(...pageVersions);
      if (isLastPage(data, "Version search", startAt)) {
        complete = true;
        break;
      }
      startAt = nextPageStartAt(startAt, pageVersions.length, "Version search");
    }
    if (!complete) throwPaginationLimit("Version pagination");
    return versions;
  }
''',
)

# SCRUM-67 regressions: metadata-backed custom display names and system-field protection.
replace_exact(
    "tests/infrastructure/jira-jql-validation.test.ts",
    '''  it("akzeptiert encodedName als semantische Feld-ID", () => {
''',
    '''  it("akzeptiert ein Custom Field über den bekannten Anzeigenamen", () => {
    const jql = 'project = DEMO AND "Acceptance Criteria" = yes';
    const fields = [
      {
        id: "customfield_10042",
        name: "Acceptance Criteria",
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
    const jql = "project = DEMO";
    const fields = [
      {
        id: "customfield_10042",
        name: "project",
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
                  field: {
                    name: "project",
                    encodedName: "customfield_10042",
                  },
                  operand: { value: "DEMO" },
                  operator: "=",
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

  it("akzeptiert encodedName als semantische Feld-ID", () => {
''',
)

# SCRUM-68/69 focused pure boundary regressions.
replace_exact(
    "tests/infrastructure/jira-page-boundary-validation.test.ts",
    '''  isLastPage,
  mapFieldSearchPage,
''',
    '''  isLastPage,
  mapFieldSearchPage,
  nextPageStartAt,
''',
)

replace_exact(
    "tests/infrastructure/jira-page-boundary-validation.test.ts",
    '''  it("weist ein einzelnes malformed Projekt-Element zurück", () => {
    expect(() =>
      mapProjectSearchPage({
        values: [project, { id: "10001" }],
        isLast: true,
      }),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

''',
    '''  it("weist ein einzelnes malformed Projekt-Element zurück", () => {
    expect(() =>
      mapProjectSearchPage({
        values: [project, { id: "10001" }],
        isLast: true,
      }),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

  it("weist eine nichtnumerische Projekt-ID fail-closed zurück", () => {
    expect(() =>
      mapProjectSearchPage({
        values: [{ ...project, id: "broken" }],
        isLast: true,
      }),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

''',
)

replace_exact(
    "tests/infrastructure/jira-page-boundary-validation.test.ts",
    '''  it("akzeptiert vollständige numerische Pagination ohne isLast", () => {
''',
    '''  it("leitet den nächsten Offset aus der tatsächlich gelieferten Seite ab", () => {
    expect(nextPageStartAt(0, 50, "Project search")).toBe(50);
    expect(nextPageStartAt(50, 50, "Project search")).toBe(100);
  });

  it("weist eine nicht fortschreitende Pagination fail-closed zurück", () => {
    expect(() => nextPageStartAt(50, 0, "Field search")).toThrowError(
      expect.objectContaining({ code: "JIRA_UNAVAILABLE" }),
    );
  });

  it("akzeptiert vollständige numerische Pagination ohne isLast", () => {
''',
)

# Verify Save passes current Jira fields into the strict validator, including display-name scope.
replace_exact(
    "tests/application/project-config-repository.test.ts",
    '''  readonly metadataCalls: string[] = [];
  readonly jqlCalls: string[] = [];
''',
    '''  readonly metadataCalls: string[] = [];
  readonly jqlCalls: string[] = [];
  readonly jqlFieldCalls: JiraField[][] = [];
''',
)

replace_exact(
    "tests/application/project-config-repository.test.ts",
    '''  validateJql(jql: string): Promise<boolean> {
    this.jqlCalls.push(jql);
    return Promise.resolve(this.jqlValid);
  }
''',
    '''  validateJql(jql: string, fields: readonly JiraField[]): Promise<boolean> {
    this.jqlCalls.push(jql);
    this.jqlFieldCalls.push(fields.map((field) => ({ ...field })));
    return Promise.resolve(this.jqlValid);
  }
''',
)

replace_exact(
    "tests/application/project-config-repository.test.ts",
    '''    ["Jira-Feldname", 'project = DEMO AND "Status" = Fertig'],
    [
      "Custom-Field-ID",
''',
    '''    ["Jira-Feldname", 'project = DEMO AND "Status" = Fertig'],
    [
      "Custom-Field-Anzeigename",
      'project = DEMO AND "Akzeptanzkriterien" = vorhanden',
    ],
    [
      "Custom-Field-ID",
''',
)

replace_exact(
    "tests/application/project-config-repository.test.ts",
    '''      expect(jira.jqlCalls).toEqual([releaseScopeJql]);
      expect(saved.releaseScopeJql).toBe(releaseScopeJql);
''',
    '''      expect(jira.jqlCalls).toEqual([releaseScopeJql]);
      expect(jira.jqlFieldCalls).toEqual([
        [supportedCustomStringField, statusJqlField],
      ]);
      expect(saved.releaseScopeJql).toBe(releaseScopeJql);
''',
)

# Verify Analyze passes the same already-loaded field metadata into validation.
replace_exact(
    "tests/application/analyze-release.test.ts",
    '''  readonly metadataCalls: string[] = [];
  readonly jqlValidationCalls: string[] = [];
''',
    '''  readonly metadataCalls: string[] = [];
  readonly jqlValidationCalls: string[] = [];
  readonly jqlValidationFieldCalls: JiraField[][] = [];
''',
)

replace_exact(
    "tests/application/analyze-release.test.ts",
    '''  async validateJql(jql: string): Promise<boolean> {
    this.jqlValidationCalls.push(jql);
    return this.jqlValid;
  }
''',
    '''  async validateJql(
    jql: string,
    fields: readonly JiraField[],
  ): Promise<boolean> {
    this.jqlValidationCalls.push(jql);
    this.jqlValidationFieldCalls.push(fields.map((field) => ({ ...field })));
    return this.jqlValid;
  }
''',
)

replace_exact(
    "tests/application/analyze-release.test.ts",
    '''    expect(jira.jqlValidationCalls).toEqual([projectConfig.releaseScopeJql]);
''',
    '''    expect(jira.jqlValidationCalls).toEqual([projectConfig.releaseScopeJql]);
    expect(jira.jqlValidationFieldCalls).toEqual([
      [
        {
          id: "customfield_10042",
          name: "Akzeptanzkriterien",
          custom: true,
          schemaType: "string",
        },
      ],
    ]);
''',
)

print("SCRUM-67-69 source and regression patches applied")
