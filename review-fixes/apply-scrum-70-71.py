from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if text.count(old) != 1:
        raise SystemExit(f"ABORT: expected exactly one match in {path}, found {text.count(old)}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


# SCRUM-70: treat metadata-proven custom-field display names as aliases even
# when the display name itself looks like a technical customfield_* reference.
replace_once(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''  if (expected.custom) {
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
''',
    '''  if (expected.custom) {
    if (identity.encodedName !== null) {
      if (identity.encodedName !== expected.canonical) return false;
      return identity.name === null || expected.names.has(identity.name);
    }
    return identity.name !== null && expected.names.has(identity.name);
  }
''',
)

# SCRUM-71: require the project-detail gateway to bind the returned project to
# both the requested project identifier/key and the expected Forge project ID.
replace_once(
    "src/application/ports.ts",
    "  getProject(projectIdOrKey: string): Promise<JiraProject>;\n",
    "  getProject(projectIdOrKey: string, expectedProjectId: string): Promise<JiraProject>;\n",
)

replace_once(
    "src/application/load-project-data/load-project-data.ts",
    "    jira.getProject(projectKey),\n",
    "    jira.getProject(projectKey, projectId),\n",
)

replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''function requireMappedProject(value: unknown, resource: string): JiraProject {
  const project = mapProject(value);
  if (project) return project;
  throw new AppError(
    "JIRA_UNAVAILABLE",
    `${resource} returned an unexpected response.`,
  );
}
''',
    '''function requireMappedProject(value: unknown, resource: string): JiraProject {
  const project = mapProject(value);
  if (project) return project;
  throw new AppError(
    "JIRA_UNAVAILABLE",
    `${resource} returned an unexpected response.`,
  );
}

export function mapProjectDetail(
  value: unknown,
  requestedProjectIdOrKey: string,
  expectedProjectId: string,
): JiraProject {
  const project = requireMappedProject(value, "Project");
  const requestMatches = /^\\d+$/.test(requestedProjectIdOrKey)
    ? project.id === requestedProjectIdOrKey
    : project.key === requestedProjectIdOrKey;

  if (!requestMatches || project.id !== expectedProjectId) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "Project returned an unexpected response.",
    );
  }

  return project;
}
''',
)

replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''  async getProject(projectIdOrKey: string): Promise<JiraProject> {
    const data = await parseResponse(
      await api
        .asUser()
        .requestJira(route`/rest/api/3/project/${projectIdOrKey}`),
    );
    return requireMappedProject(data, "Project");
  }
''',
    '''  async getProject(
    projectIdOrKey: string,
    expectedProjectId: string,
  ): Promise<JiraProject> {
    const data = await parseResponse(
      await api
        .asUser()
        .requestJira(route`/rest/api/3/project/${projectIdOrKey}`),
    );
    return mapProjectDetail(data, projectIdOrKey, expectedProjectId);
  }
''',
)

# SCRUM-70 regression: a display name may legally look like customfield_*.
marker = '''  it("schützt das Systemfeld project trotz gleichnamigem Custom Field", () => {
'''
insert = '''  it("akzeptiert einen technisch wirkenden Custom-Field-Anzeigenamen über Metadaten", () => {
    const jql = 'project = DEMO AND "customfield_99999" = yes';
    const fields = [
      {
        id: "customfield_10042",
        name: "customfield_99999",
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
                        name: "customfield_99999",
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

  it("weist einen fremden technisch wirkenden Alias trotz passender encodedName fail-closed zurück", () => {
    const jql = 'project = DEMO AND "customfield_99999" = yes';
    const fields = [
      {
        id: "customfield_10042",
        name: "customfield_99999",
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
                        name: "customfield_77777",
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

'''
replace_once(
    "tests/infrastructure/jira-jql-validation.test.ts",
    marker,
    insert + marker,
)

# SCRUM-71 pure boundary regressions.
replace_once(
    "tests/infrastructure/project-metadata-validation.test.ts",
    'import { mapProjectMetadata } from "../../src/infrastructure/jira/forge-jira-gateway";\n',
    '''import {
  mapProjectDetail,
  mapProjectMetadata,
} from "../../src/infrastructure/jira/forge-jira-gateway";
''',
)

project_detail_tests = '''
describe("Jira-Projektdetailbindung", () => {
  const validProject = { id: "10000", key: "DEMO", name: "Demo" };

  it("akzeptiert ein Projektdetail mit passender Forge-Projekt-ID und passendem Schlüssel", () => {
    expect(mapProjectDetail(validProject, "DEMO", "10000")).toEqual(validProject);
  });

  it("weist einen fremden Projektschlüssel fail-closed zurück", () => {
    expect(() =>
      mapProjectDetail(
        { id: "10000", key: "OTHER", name: "Other" },
        "DEMO",
        "10000",
      ),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

  it("weist eine fremde Projekt-ID fail-closed zurück", () => {
    expect(() =>
      mapProjectDetail(
        { id: "10001", key: "DEMO", name: "Demo" },
        "DEMO",
        "10000",
      ),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

  it("weist gleichzeitig fremde Projekt-ID und fremden Schlüssel fail-closed zurück", () => {
    expect(() =>
      mapProjectDetail(
        { id: "10001", key: "OTHER", name: "Other" },
        "DEMO",
        "10000",
      ),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

  it("bindet auch eine numerisch angefragte Projektdetailantwort an die Anfrage", () => {
    expect(mapProjectDetail(validProject, "10000", "10000")).toEqual(validProject);
  });
});
'''
replace_once(
    "tests/infrastructure/project-metadata-validation.test.ts",
    '''const validIssueType = {
  id: "10001",
  name: "Story",
  subtask: false,
  statuses: [{ id: "31", name: "Fertig" }],
};
''',
    '''const validIssueType = {
  id: "10001",
  name: "Story",
  subtask: false,
  statuses: [{ id: "31", name: "Fertig" }],
};
''' + project_detail_tests,
)

# Verify loadProjectData supplies both known context values to the gateway.
replace_once(
    "tests/application/load-project-data.test.ts",
    '''  async getProject(): Promise<JiraProject> {
    this.calls.push("project");
    return { id: "10000", key: "DEMO", name: "Demoagentur" };
  }
''',
    '''  async getProject(
    projectIdOrKey: string,
    expectedProjectId: string,
  ): Promise<JiraProject> {
    this.calls.push(`project:${projectIdOrKey}:${expectedProjectId}`);
    return { id: "10000", key: "DEMO", name: "Demoagentur" };
  }
''',
)

replace_once(
    "tests/application/load-project-data.test.ts",
    '''    expect(jira.calls).toEqual(["project", "metadata", "fields", "versions"]);
''',
    '''    expect(jira.calls).toEqual([
      "project:DEMO:10000",
      "metadata",
      "fields",
      "versions",
    ]);
''',
)

print("SCRUM-70-71 source and regression patches applied")
