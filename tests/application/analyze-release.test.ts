import { describe, expect, it } from "vitest";
import { analyzeRelease } from "../../src/application/analyze-release/analyze-release";
import type {
  JiraGateway,
  JiraField,
  JiraProject,
  JiraVersion,
  ProjectMetadata,
} from "../../src/application/ports";
import type { ReleaseIssue } from "../../src/domain/models/readiness";
import { InMemoryProjectConfigRepository } from "../../src/infrastructure/storage/in-memory-project-config-repository";
import { config, issue, projectConfig } from "../fixtures/release";

class FakeJiraGateway implements JiraGateway {
  readonly getVersionCalls: string[] = [];
  readonly issueSearchCalls: string[] = [];
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
  ) {}

  async listProjects(): Promise<JiraProject[]> {
    return [{ id: "10000", key: "DEMO", name: "Demoagentur" }];
  }
  async getProject(): Promise<JiraProject> {
    return { id: "10000", key: "DEMO", name: "Demoagentur" };
  }
  async getProjectMetadata(): Promise<ProjectMetadata> {
    return { statuses: [], issueTypes: [] };
  }
  async listFields() {
    return this.fields;
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

const supportedCustomStringField: JiraField = {
  id: projectConfig.acceptanceCriteriaFieldId,
  name: "Akzeptanzkriterien",
  custom: true,
  schemaType: "string",
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
  it("nutzt Jira-Fake, filtert Issue-Typen und aggregiert", async () => {
    const repository = new InMemoryProjectConfigRepository();
    await repository.save(projectConfig);
    const result = await analyzeRelease(
      new FakeJiraGateway(),
      repository,
      clock,
      {
        projectId: "10000",
        projectKey: "DEMO",
        versionId: "30001",
      },
    );
    expect(result.totalIssues).toBe(1);
    expect(result.release.issues[0]?.key).toBe("DEMO-42");
    expect(result.release.releaseScopeMode).toBe("JQL_SCOPE");
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
});
