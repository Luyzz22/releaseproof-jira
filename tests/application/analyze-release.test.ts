import { describe, expect, it } from "vitest";
import { analyzeRelease } from "../../src/application/analyze-release/analyze-release";
import type {
  JiraField,
  JiraGateway,
  JiraJqlValidator,
  JiraProject,
  JiraVersion,
  ProjectMetadata,
} from "../../src/application/ports";
import type { ReleaseIssue } from "../../src/domain/models/readiness";
import { InMemoryProjectConfigRepository } from "../../src/infrastructure/storage/in-memory-project-config-repository";
import { config, issue, projectConfig } from "../fixtures/release";

const validMetadata: ProjectMetadata = {
  statuses: [{ id: "31", name: "Fertig" }],
  issueTypes: [
    { id: "10001", name: "Story", subtask: false },
    { id: "10002", name: "Task", subtask: false },
    { id: "10003", name: "Unteraufgabe", subtask: true },
  ],
};

class FakeJiraGateway implements JiraGateway, JiraJqlValidator {
  readonly getVersionCalls: string[] = [];
  readonly issueSearchCalls: string[] = [];
  readonly metadataCalls: string[] = [];
  readonly jqlValidationCalls: string[] = [];
  readonly version: JiraVersion = {
    id: "30001",
    name: "Kundenrelease 2.4",
    projectId: "10000",
    released: false,
    archived: false,
  };

  constructor(
    private readonly jqlIssues: ReleaseIssue[] = [
      issue(),
      issue({ key: "DEMO-99", issueType: { id: "99999", name: "Epic" } }),
    ],
    private readonly versionIssues: ReleaseIssue[] = [issue()],
    private readonly fields: JiraField[] = [
      {
        id: "customfield_10042",
        name: "Akzeptanzkriterien",
        custom: true,
        schemaType: "string",
      },
    ],
    private readonly metadata: ProjectMetadata = validMetadata,
    private readonly jqlValid = true,
  ) {}

  async listProjects(): Promise<JiraProject[]> {
    return [{ id: "10000", key: "DEMO", name: "Demoagentur" }];
  }
  async getProject(): Promise<JiraProject> {
    return { id: "10000", key: "DEMO", name: "Demoagentur" };
  }
  async getProjectMetadata(projectId: string): Promise<ProjectMetadata> {
    this.metadataCalls.push(projectId);
    return structuredClone(this.metadata);
  }
  async listFields() {
    return this.fields;
  }
  async validateJql(jql: string): Promise<boolean> {
    this.jqlValidationCalls.push(jql);
    return this.jqlValid;
  }
  async listVersions(): Promise<JiraVersion[]> {
    return [this.version];
  }
  async getVersion(versionId: string): Promise<JiraVersion> {
    this.getVersionCalls.push(versionId);
    return this.version;
  }
  async listIssuesForVersion() {
    this.issueSearchCalls.push("VERSION_ONLY");
    return this.versionIssues;
  }
  async listIssuesForJqlScope() {
    this.issueSearchCalls.push("JQL_SCOPE");
    return this.jqlIssues;
  }
}

const clock = { now: () => "2026-07-11T09:00:00.000Z" };
const sensitiveDescription = "SENSITIVE_DESCRIPTION_DO_NOT_EXPOSE";
const sensitiveAcceptanceCriteria =
  "SENSITIVE_ACCEPTANCE_CRITERIA_DO_NOT_EXPOSE";

async function analyzeSensitiveIssue() {
  const repository = new InMemoryProjectConfigRepository();
  await repository.save(projectConfig);
  const sensitiveIssue = {
    ...issue({
      labels: ["internal-label"],
      fixVersions: [{ id: "30001", name: "Kundenrelease 2.4" }],
      subtasks: [
        {
          id: "21001",
          key: "DEMO-43",
          status: { id: "31", name: "Fertig" },
          resolution: { id: "1", name: "Erledigt" },
        },
      ],
      linkedIssues: [
        {
          id: "22001",
          key: "DEMO-7",
          relationship: "is blocked by",
          direction: "inward",
          isBlocking: true,
          status: { id: "31", name: "Fertig" },
          resolution: { id: "1", name: "Erledigt" },
        },
      ],
      resolution: { id: "1", name: "Erledigt" },
    }),
    description: sensitiveDescription,
    acceptanceCriteria: sensitiveAcceptanceCriteria,
  };

  return analyzeRelease(
    new FakeJiraGateway([sensitiveIssue], [sensitiveIssue]),
    repository,
    clock,
    {
      projectId: "10000",
      projectKey: "DEMO",
      versionId: "30001",
    },
  );
}

const supportedCustomStringField: JiraField = {
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
};

const storedFieldFailureCases: ReadonlyArray<
  readonly [string, string, readonly JiraField[]]
> = [
  [
    "einem Zahlenfeld",
    "customfield_20000",
    [
      {
        id: "customfield_20000",
        name: "Technischer Zahlenwert",
        custom: true,
        schemaType: "number",
      },
    ],
  ],
  [
    "einem Optionsfeld",
    "customfield_20001",
    [
      {
        id: "customfield_20001",
        name: "Freigabeauswahl",
        custom: true,
        schemaType: "option",
      },
    ],
  ],
  [
    "einer unbekannten Feld-ID",
    "customfield_99999",
    [supportedCustomStringField],
  ],
];

describe("Analyze Release Use Case", () => {
  it("überträgt keinen vollständigen description-Quelltext im öffentlichen Analysewert", async () => {
    const result = await analyzeSensitiveIssue();

    expect(JSON.stringify(result)).not.toContain(sensitiveDescription);
  });

  it("überträgt keinen vollständigen acceptanceCriteria-Quelltext im öffentlichen Analysewert", async () => {
    const result = await analyzeSensitiveIssue();

    expect(JSON.stringify(result)).not.toContain(sensitiveAcceptanceCriteria);
  });

  it("überträgt keine internen Jira-Issue-Daten im öffentlichen Analysewert", async () => {
    const result = await analyzeSensitiveIssue();

    expect(Object.keys(result.release).sort()).toEqual(
      [
        "issues",
        "projectKey",
        "releaseScopeJql",
        "releaseScopeMode",
        "versionName",
      ].sort(),
    );
    expect(Object.keys(result.release.issues[0] ?? {}).sort()).toEqual(
      ["issueTypeName", "key", "statusName", "summary", "updatedAt"].sort(),
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.results[0]?.evidence).toHaveLength(7);
    expect(JSON.stringify(result)).not.toContain("internal-label");
  });

  it("nutzt Jira-Fake, filtert Issue-Typen und aggregiert", async () => {
    const repository = new InMemoryProjectConfigRepository();
    await repository.save(projectConfig);
    const jira = new FakeJiraGateway();
    const result = await analyzeRelease(jira, repository, clock, {
      projectId: "10000",
      projectKey: "DEMO",
      versionId: "30001",
    });
    expect(result.totalIssues).toBe(1);
    expect(result.release.issues[0]?.key).toBe("DEMO-42");
    expect(result.release.releaseScopeMode).toBe("JQL_SCOPE");
    expect(jira.jqlValidationCalls).toEqual([projectConfig.releaseScopeJql]);
  });

  it.each([
    [
      "description mit aktuellem schemaType null",
      "description",
      {
        id: "description",
        name: "Beschreibung",
        custom: false,
        schemaType: null,
      } satisfies JiraField,
    ],
    [
      "ein Custom Field mit aktuellem schemaType string",
      supportedCustomStringField.id,
      supportedCustomStringField,
    ],
  ])("analysiert eine Konfiguration mit %s", async (_case, fieldId, field) => {
    const repository = new InMemoryProjectConfigRepository();
    await repository.save(config({ acceptanceCriteriaFieldId: fieldId }));
    const jira = new FakeJiraGateway([issue()], [issue()], [field]);

    const result = await analyzeRelease(jira, repository, clock, {
      projectId: "10000",
      projectKey: "DEMO",
      versionId: "30001",
    });

    expect(result.totalIssues).toBe(1);
    expect(jira.getVersionCalls).toEqual(["30001"]);
    expect(jira.issueSearchCalls).toEqual(["JQL_SCOPE"]);
  });

  it("fordert vor der Analyse eine Konfiguration", async () => {
    const promise = analyzeRelease(
      new FakeJiraGateway(),
      new InMemoryProjectConfigRepository(),
      clock,
      { projectId: "10000", projectKey: "DEMO", versionId: "30001" },
    );
    await expect(promise).rejects.toMatchObject({ code: "CONFIG_REQUIRED" });
  });

  it("nutzt VERSION_ONLY und markiert die Versionsregel als nicht anwendbar", async () => {
    const repository = new InMemoryProjectConfigRepository();
    await repository.save(config({ releaseScopeMode: "VERSION_ONLY" }));
    const jira = new FakeJiraGateway();
    const result = await analyzeRelease(jira, repository, clock, {
      projectId: "10000",
      projectKey: "DEMO",
      versionId: "30001",
    });

    expect(jira.jqlValidationCalls).toHaveLength(0);
    expect(jira.issueSearchCalls).toEqual(["VERSION_ONLY"]);
    expect(
      result.results[0]?.evidence.find(
        (item) => item.ruleId === "correct-fix-version",
      )?.status,
    ).toBe("NOT_APPLICABLE");
    expect(result.score).toBe(100);
  });

  it.each([
    ["fehlender", []],
    ["falscher", [{ id: "39999", name: "Anderes Release" }]],
  ])(
    "behält einen Vorgang mit %s Version im JQL_SCOPE und bewertet ihn negativ",
    async (_case, fixVersions) => {
      const repository = new InMemoryProjectConfigRepository();
      await repository.save(projectConfig);
      const jira = new FakeJiraGateway([issue({ fixVersions })]);
      const result = await analyzeRelease(jira, repository, clock, {
        projectId: "10000",
        projectKey: "DEMO",
        versionId: "30001",
      });

      expect(jira.issueSearchCalls).toEqual(["JQL_SCOPE"]);
      expect(result.totalIssues).toBe(1);
      expect(result.release.issues[0]?.key).toBe("DEMO-42");
      expect(
        result.results[0]?.evidence.find(
          (item) => item.ruleId === "correct-fix-version",
        )?.status,
      ).toBe("INCOMPLETE");
      expect(result.score).toBe(90);
    },
  );

  it("übernimmt nur die vom expliziten Scope gelieferten Vorgänge", async () => {
    const repository = new InMemoryProjectConfigRepository();
    await repository.save(projectConfig);
    const jira = new FakeJiraGateway([
      issue({ key: "DEMO-42" }),
      issue({ key: "DEMO-43" }),
    ]);
    const result = await analyzeRelease(jira, repository, clock, {
      projectId: "10000",
      projectKey: "DEMO",
      versionId: "30001",
    });

    expect(result.release.issues.map((item) => item.key)).toEqual([
      "DEMO-42",
      "DEMO-43",
    ]);
    expect(result.release.issues).not.toContainEqual(
      expect.objectContaining({ key: "DEMO-99" }),
    );
    expect(result.score).toBe(100);
  });

  it.each(storedFieldFailureCases)(
    "bricht die Analyse bei %s vor Version und Issue-Suche ab",
    async (_case, fieldId, fields) => {
      const repository = new InMemoryProjectConfigRepository();
      await repository.save(config({ acceptanceCriteriaFieldId: fieldId }));
      const jira = new FakeJiraGateway([issue()], [issue()], [...fields]);

      await expect(
        analyzeRelease(jira, repository, clock, {
          projectId: "10000",
          projectKey: "DEMO",
          versionId: "30001",
        }),
      ).rejects.toMatchObject({ code: "STORAGE_CORRUPT" });

      expect(jira.getVersionCalls).toHaveLength(0);
      expect(jira.issueSearchCalls).toHaveLength(0);
    },
  );

  it.each([
    ["unbekannter Status-ID", { acceptedStatusIds: ["99999"] }],
    ["unbekannter Vorgangstyp-ID", { includedIssueTypes: ["99999"] }],
    [
      "gemischten gültigen und unbekannten Vorgangstyp-IDs",
      { includedIssueTypes: ["10001", "99999"] },
    ],
    ["Unteraufgaben-Typ als Hauptvorgang", { includedIssueTypes: ["10003"] }],
  ])(
    "bricht bei gespeicherter %s vor Version und Issue-Suche ab",
    async (_case, overrides) => {
      const repository = new InMemoryProjectConfigRepository();
      await repository.save(config(overrides));
      const jira = new FakeJiraGateway();

      await expect(
        analyzeRelease(jira, repository, clock, {
          projectId: "10000",
          projectKey: "DEMO",
          versionId: "30001",
        }),
      ).rejects.toMatchObject({ code: "STORAGE_CORRUPT" });

      expect(jira.getVersionCalls).toHaveLength(0);
      expect(jira.issueSearchCalls).toHaveLength(0);
      expect(jira.jqlValidationCalls).toHaveLength(0);
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
    expect(jira.jqlValidationCalls).toHaveLength(0);
  });

  it("bricht bei von Jira abgelehntem gespeichertem JQL vor Version und Issue-Suche ab", async () => {
    const repository = new InMemoryProjectConfigRepository();
    const releaseScopeJql = "project = DEMO AND status ~ Fertig";
    await repository.save(config({ releaseScopeJql }));
    const jira = new FakeJiraGateway(
      [issue()],
      [issue()],
      [supportedCustomStringField, statusJqlField],
      validMetadata,
      false,
    );

    await expect(
      analyzeRelease(jira, repository, clock, {
        projectId: "10000",
        projectKey: "DEMO",
        versionId: "30001",
      }),
    ).rejects.toMatchObject({ code: "STORAGE_CORRUPT" });

    expect(jira.jqlValidationCalls).toEqual([releaseScopeJql]);
    expect(jira.getVersionCalls).toHaveLength(0);
    expect(jira.issueSearchCalls).toHaveLength(0);
  });
});
