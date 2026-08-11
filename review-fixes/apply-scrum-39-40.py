from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"{label}: erwarteter Block nicht exakt gefunden; nichts geändert.")
    path.write_text(text.replace(old, new, 1))


project_config = Path("src/frontend/pages/project-configuration.tsx")
replace_once(
    project_config,
    '''function toggle(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}
''',
    '''function toggle(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function filterAvailableMetadataIds(
  selectedIds: readonly string[],
  availableItems: ReadonlyArray<{ id: string }>,
): string[] {
  const availableIds = new Set(availableItems.map((item) => item.id));
  return selectedIds.filter((id) => availableIds.has(id));
}
''',
    "SCRUM-39 helper",
)
replace_once(
    project_config,
    '''  const [acceptedStatusIds, setAcceptedStatusIds] = useState<string[]>(
    existing?.acceptedStatusIds ?? [],
  );
  const [includedIssueTypes, setIncludedIssueTypes] = useState<string[]>(
    existing?.includedIssueTypes ?? data.issueTypes.map((type) => type.id),
  );
''',
    '''  const [acceptedStatusIds, setAcceptedStatusIds] = useState<string[]>(
    filterAvailableMetadataIds(existing?.acceptedStatusIds ?? [], data.statuses),
  );
  const [includedIssueTypes, setIncludedIssueTypes] = useState<string[]>(
    existing
      ? filterAvailableMetadataIds(
          existing.includedIssueTypes,
          data.issueTypes,
        )
      : data.issueTypes.map((type) => type.id),
  );
''',
    "SCRUM-39 state initialization",
)

project_test = Path("tests/frontend/project-configuration.test.ts")
replace_once(
    project_test,
    '''import { ProjectConfiguration } from "../../src/frontend/pages/project-configuration";
''',
    '''import {
  filterAvailableMetadataIds,
  ProjectConfiguration,
} from "../../src/frontend/pages/project-configuration";
''',
    "SCRUM-39 test import",
)
replace_once(
    project_test,
    '''describe("Projektkonfiguration – Akzeptanzkriterien-Felder", () => {
''',
    '''describe("Projektkonfiguration – Metadaten-Recovery", () => {
  it("entfernt gelöschte Status-IDs und behält verfügbare Status bei", () => {
    expect(
      filterAvailableMetadataIds(
        ["31", "999"],
        [
          { id: "31" },
          { id: "41" },
        ],
      ),
    ).toEqual(["31"]);
  });

  it("entfernt gelöschte Vorgangstyp-IDs und behält verfügbare Typen bei", () => {
    expect(
      filterAvailableMetadataIds(
        ["10001", "19999", "10003"],
        [
          { id: "10001" },
          { id: "10003" },
        ],
      ),
    ).toEqual(["10001", "10003"]);
  });
});

describe("Projektkonfiguration – Akzeptanzkriterien-Felder", () => {
''',
    "SCRUM-39 regression tests",
)

gateway = Path("src/infrastructure/jira/forge-jira-gateway.ts")
replace_once(
    gateway,
    '''function mapIssue(
  value: unknown,
  acceptanceCriteriaFieldId: string,
): ReleaseIssue | null {
''',
    '''function requireMappedFixVersion(
  value: unknown,
): ReleaseIssue["fixVersions"][number] {
  const version = requireRecord(value, "Issue search fixVersion");
  const id = stringValue(version.id);
  const name = stringValue(version.name);
  if (!id || !name) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "Issue search fixVersion returned an unexpected response.",
    );
  }
  return { id, name };
}

function mapIssue(
  value: unknown,
  acceptanceCriteriaFieldId: string,
): ReleaseIssue | null {
''',
    "SCRUM-40 strict fixVersion mapper",
)
replace_once(
    gateway,
    '''    fixVersions: arrayValue(fields.fixVersions).flatMap((version) => {
      if (!isRecord(version)) return [];
      const versionId = stringValue(version.id);
      const name = stringValue(version.name);
      return versionId && name ? [{ id: versionId, name }] : [];
    }),
''',
    '''    fixVersions: requireArray(
      fields.fixVersions,
      "Issue search fixVersions",
    ).map(requireMappedFixVersion),
''',
    "SCRUM-40 fail-closed fixVersions mapping",
)

jira_errors_test = Path("tests/infrastructure/jira-errors.test.ts")
replace_once(
    jira_errors_test,
    '''  it.each([
    ["fehlendem issuelinks-Feld", undefined],
''',
    '''  it.each([
    ["fehlendem fixVersions-Feld", undefined],
    ["fixVersions als null", null],
    ["fixVersions als String", "invalid"],
    ["nicht-arrayförmigem fixVersions-Feld", {}],
  ])("bricht bei %s fail-closed ab", async (_case, fixVersions) => {
    const fields: Record<string, unknown> = { ...jiraIssue(1).fields };
    if (fixVersions === undefined) {
      delete fields.fixVersions;
    } else {
      fields.fixVersions = fixVersions;
    }

    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () =>
          Promise.resolve({
            issues: [{ ...jiraIssue(1), fields }],
          }),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it.each([
    ["null-Version", null],
    ["Version ohne id", { name: "1.0.0" }],
    ["Version ohne name", { id: "30001" }],
    ["Version mit leerer id", { id: " ", name: "1.0.0" }],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "bricht bei malformed %s vollständig ab",
    async (_case, malformedVersion) => {
      const sourceIssue = {
        ...jiraIssue(1),
        fields: {
          ...jiraIssue(1).fields,
          fixVersions: [malformedVersion],
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
    },
  );

  it("verwirft bei gemischten gültigen und malformed fixVersions das gesamte Ergebnis", async () => {
    const sourceIssue = {
      ...jiraIssue(1),
      fields: {
        ...jiraIssue(1).fields,
        fixVersions: [
          { id: "30001", name: "1.0.0" },
          { id: "30002" },
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
    const sourceIssue = {
      ...jiraIssue(1),
      fields: {
        ...jiraIssue(1).fields,
        fixVersions: [
          { id: "30001", name: "1.0.0" },
          { id: "30002", name: "2.0.0" },
        ],
      },
    };

    const issues = await collectIssueSearchPages(
      {
        jql: "project = DEMO",
        acceptanceCriteriaFieldId: "customfield_10042",
      },
      () => Promise.resolve({ issues: [sourceIssue] }),
    );

    expect(issues[0]?.fixVersions).toEqual([
      { id: "30001", name: "1.0.0" },
      { id: "30002", name: "2.0.0" },
    ]);
  });

  it.each([
    ["fehlendem issuelinks-Feld", undefined],
''',
    "SCRUM-40 regression tests",
)

print("SCRUM-39/40 changes applied successfully.")
