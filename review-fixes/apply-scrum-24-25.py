from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    content = file_path.read_text()
    count = content.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one match in {path}, found {count}")
    file_path.write_text(content.replace(old, new, 1))


# SCRUM-24: reject whitespace-only Jira evidence and fail closed on malformed
# linked-issue resolution payloads.
replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}''',
    '''function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}''',
)
replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''        status: mapStatus(fields.status),
        resolution: mapResolution(fields.resolution),
      }
    : null;''',
    '''        status: mapStatus(fields.status),
        resolution: requireNullableResolution(
          fields.resolution,
          "Issue search linked issue resolution",
        ),
      }
    : null;''',
)

# SCRUM-25: expose a parser-backed field-reference check for the controlled JQL
# subset. Project/key aliases are explicit; all other fields must resolve against
# Jira field metadata by id or display name.
replace_once(
    "src/shared/validation.ts",
    '''export function validateReleaseScopeJql(
  value: string,
  expectedProjectKey: string,
): ReleaseScopeJqlValidation {''',
    '''interface JiraFieldReference {
  id: string;
  name: string;
}

function normalizedJqlFieldReference(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function hasOnlyKnownReleaseScopeJqlFields(
  value: string,
  fields: readonly JiraFieldReference[],
): boolean {
  const tokenized = tokenizeJql(value);
  if (!tokenized.ok) return false;

  const parsed = parseConjunctiveJql(tokenized.tokens);
  if (!parsed.ok) return false;

  const knownFields = new Set(["project", "key", "issuekey"]);
  for (const field of fields) {
    knownFields.add(normalizedJqlFieldReference(field.id));
    knownFields.add(normalizedJqlFieldReference(field.name));
  }

  return parsed.clauses.every((clause) =>
    knownFields.has(normalizedJqlFieldReference(clause.field.value)),
  );
}

export function validateReleaseScopeJql(
  value: string,
  expectedProjectKey: string,
): ReleaseScopeJqlValidation {''',
)

replace_once(
    "src/application/save-project-config/save-project-config.ts",
    '''import type { ProjectConfigInput } from "../../shared/validation";''',
    '''import {
  hasOnlyKnownReleaseScopeJqlFields,
  type ProjectConfigInput,
} from "../../shared/validation";''',
)
replace_once(
    "src/application/save-project-config/save-project-config.ts",
    '''  if (
    !hasSupportedAcceptanceCriteriaField(
      fields,
      input.acceptanceCriteriaFieldId,
    )
  ) {
    throw new AppError(
      "INVALID_INPUT",
      "Acceptance criteria field is not a supported text field.",
    );
  }
  let existing: ProjectConfig | null;''',
    '''  if (
    !hasSupportedAcceptanceCriteriaField(
      fields,
      input.acceptanceCriteriaFieldId,
    )
  ) {
    throw new AppError(
      "INVALID_INPUT",
      "Acceptance criteria field is not a supported text field.",
    );
  }
  if (
    input.releaseScopeMode === "JQL_SCOPE" &&
    (input.releaseScopeJql === undefined ||
      !hasOnlyKnownReleaseScopeJqlFields(input.releaseScopeJql, fields))
  ) {
    throw new AppError(
      "INVALID_INPUT",
      "Release scope references an unknown Jira field.",
    );
  }

  let existing: ProjectConfig | null;''',
)

replace_once(
    "src/application/analyze-release/analyze-release.ts",
    '''import { validateReleaseScopeJql } from "../../shared/validation";''',
    '''import {
  hasOnlyKnownReleaseScopeJqlFields,
  validateReleaseScopeJql,
} from "../../shared/validation";''',
)
replace_once(
    "src/application/analyze-release/analyze-release.ts",
    '''  if (
    !hasSupportedAcceptanceCriteriaField(
      fields,
      config.acceptanceCriteriaFieldId,
    )
  ) {
    throw new AppError(
      "STORAGE_CORRUPT",
      "Stored acceptance criteria field is not a supported text field.",
    );
  }
  const version = await jira.getVersion(input.versionId);''',
    '''  if (
    !hasSupportedAcceptanceCriteriaField(
      fields,
      config.acceptanceCriteriaFieldId,
    )
  ) {
    throw new AppError(
      "STORAGE_CORRUPT",
      "Stored acceptance criteria field is not a supported text field.",
    );
  }
  if (
    config.releaseScopeMode === "JQL_SCOPE" &&
    (config.releaseScopeJql === undefined ||
      !hasOnlyKnownReleaseScopeJqlFields(config.releaseScopeJql, fields))
  ) {
    throw new AppError(
      "STORAGE_CORRUPT",
      "Stored JQL scope references an unknown Jira field.",
    );
  }

  const version = await jira.getVersion(input.versionId);''',
)

# Regression coverage for whitespace-only labels/resolutions/relationships.
replace_once(
    "tests/infrastructure/jira-evidence-validation.test.ts",
    '''    ["Objekt", { value: "release-blocker" }],
    ["leerer String", ""],''',
    '''    ["Objekt", { value: "release-blocker" }],
    ["leerer String", ""],
    ["Whitespace-only String", "   "],''',
)
replace_once(
    "tests/infrastructure/jira-evidence-validation.test.ts",
    '''    [
      "Subtask mit malformed Resolution",
      {
        id: "30001",
        key: "DEMO-2",
        fields: {
          status: { id: "31", name: "Fertig" },
          resolution: { id: "1" },
        },
      },
    ],''',
    '''    [
      "Subtask mit malformed Resolution",
      {
        id: "30001",
        key: "DEMO-2",
        fields: {
          status: { id: "31", name: "Fertig" },
          resolution: { id: "1" },
        },
      },
    ],
    [
      "Subtask mit Whitespace-only Resolution-ID",
      {
        id: "30001",
        key: "DEMO-2",
        fields: {
          status: { id: "31", name: "Fertig" },
          resolution: { id: "   ", name: "Erledigt" },
        },
      },
    ],
    [
      "Subtask mit Whitespace-only Resolution-Name",
      {
        id: "30001",
        key: "DEMO-2",
        fields: {
          status: { id: "31", name: "Fertig" },
          resolution: { id: "1", name: "   " },
        },
      },
    ],''',
)
replace_once(
    "tests/infrastructure/jira-evidence-validation.test.ts",
    '''    [
      "nur einem Type-Namen ohne outward-Beschreibung",
      {
        type: { name: "Relates" },
        outwardIssue: outwardNonBlockingLink().outwardIssue,
      },
    ],''',
    '''    [
      "nur einem Type-Namen ohne outward-Beschreibung",
      {
        type: { name: "Relates" },
        outwardIssue: outwardNonBlockingLink().outwardIssue,
      },
    ],
    [
      "Whitespace-only Relationship-Beschreibung",
      {
        type: { name: "Blocks", inward: "   ", outward: "blocks" },
        inwardIssue: inwardBlockingLink().inwardIssue,
      },
    ],''',
)
replace_once(
    "tests/infrastructure/jira-evidence-validation.test.ts",
    '''  it("bricht bei gleichzeitigem inward- und outward-Ziel ab", async () => {''',
    '''  it.each([
    ["Whitespace-only Resolution-ID", "   ", "Erledigt"],
    ["Whitespace-only Resolution-Name", "1", "   "],
  ])("bricht bei Link mit %s ab", async (_case, id, name) => {
    const link = inwardBlockingLink();
    await expect(
      mapFields({
        ...baseIssue().fields,
        issuelinks: [
          {
            ...link,
            inwardIssue: {
              ...link.inwardIssue,
              fields: {
                ...link.inwardIssue.fields,
                resolution: { id, name },
              },
            },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("bricht bei gleichzeitigem inward- und outward-Ziel ab", async () => {''',
)

# Regression coverage for JQL field metadata validation before persistence.
replace_once(
    "tests/application/project-config-repository.test.ts",
    '''const supportedCustomStringField: JiraField = {
  id: projectConfig.acceptanceCriteriaFieldId,
  name: "Akzeptanzkriterien",
  custom: true,
  schemaType: "string",
};''',
    '''const supportedCustomStringField: JiraField = {
  id: projectConfig.acceptanceCriteriaFieldId,
  name: "Akzeptanzkriterien",
  custom: true,
  schemaType: "string",
};

const statusJqlField: JiraField = {
  id: "status",
  name: "Status",
  custom: false,
  schemaType: "status",
};''',
)
replace_once(
    "tests/application/project-config-repository.test.ts",
    '''  it.each([
    [
      "technischen Storage-Ausfall",''',
    '''  it("lehnt ein unbekanntes JQL-Feld vor jedem KVS-Zugriff ab", async () => {
    const existing = structuredClone(projectConfig);
    const repository = new ControlledProjectConfigRepository(existing);
    const jira = jiraFields();

    await expect(
      saveProjectConfig(
        jira,
        repository,
        { now: () => "2026-08-10T13:00:00.000Z" },
        {
          ...projectConfig,
          releaseScopeJql: "project = DEMO AND definitelyNotAField = foo",
        },
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    expect(jira.calls).toEqual([projectConfig.projectId]);
    expect(repository.reads).toHaveLength(0);
    expect(repository.saved).toHaveLength(0);
    expect(repository.snapshot()).toEqual(existing);
  });

  it.each([
    ["Systemfeld key", "project = DEMO AND key = DEMO-42"],
    ["Jira-Feld-ID", "project = DEMO AND status = Fertig"],
    ["Jira-Feldname", 'project = DEMO AND "Status" = Fertig'],
    [
      "Custom-Field-ID",
      `project = DEMO AND ${projectConfig.acceptanceCriteriaFieldId} = vorhanden`,
    ],
  ])("akzeptiert ein bekanntes JQL-Feld über %s", async (_case, releaseScopeJql) => {
    const repository = new ControlledProjectConfigRepository(null);
    const jira = jiraFields([supportedCustomStringField, statusJqlField]);

    const saved = await saveProjectConfig(
      jira,
      repository,
      { now: () => "2026-08-10T13:00:00.000Z" },
      { ...projectConfig, releaseScopeJql },
    );

    expect(saved.releaseScopeJql).toBe(releaseScopeJql);
    expect(repository.saved).toEqual([saved]);
  });

  it.each([
    [
      "technischen Storage-Ausfall",''',
)

replace_once(
    "tests/application/analyze-release.test.ts",
    '''      expect(jira.issueSearchCalls).toHaveLength(0);
    },
  );''',
    '''      expect(jira.issueSearchCalls).toHaveLength(0);
    },
  );

  it("bricht bei unbekanntem gespeichertem JQL-Feld vor Version und Issue-Suche ab", async () => {
    const repository = new InMemoryProjectConfigRepository();
    await repository.save(
      config({
        releaseScopeJql: "project = DEMO AND definitelyNotAField = foo",
      }),
    );
    const jira = new FakeJiraGateway(
      [issue()],
      [issue()],
      [supportedCustomStringField],
    );

    await expect(
      analyzeRelease(jira, repository, clock, {
        projectId: "10000",
        projectKey: "DEMO",
        versionId: "30001",
      }),
    ).rejects.toMatchObject({ code: "STORAGE_CORRUPT" });

    expect(jira.getVersionCalls).toHaveLength(0);
    expect(jira.issueSearchCalls).toHaveLength(0);
  });''',
)

print("SCRUM-24/25 changes applied successfully.")
