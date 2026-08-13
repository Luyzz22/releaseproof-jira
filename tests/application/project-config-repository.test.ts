import { describe, expect, it } from "vitest";
import type {
  JiraField,
  JiraGateway,
  JiraJqlValidator,
  ProjectConfigRepository,
  ProjectMetadata,
} from "../../src/application/ports";
import { saveProjectConfig } from "../../src/application/save-project-config/save-project-config";
import type { ProjectConfig } from "../../src/domain/models/readiness";
import { InMemoryProjectConfigRepository } from "../../src/infrastructure/storage/in-memory-project-config-repository";
import { AppError } from "../../src/shared/errors";
import { normalizeStoredProjectConfig } from "../../src/shared/validation";
import { config, projectConfig } from "../fixtures/release";

class ControlledProjectConfigRepository implements ProjectConfigRepository {
  readonly reads: string[] = [];
  readonly saved: ProjectConfig[] = [];

  constructor(private readonly readResult: ProjectConfig | null | Error) {}

  async get(projectId: string): Promise<ProjectConfig | null> {
    this.reads.push(projectId);
    if (this.readResult instanceof Error) throw this.readResult;
    return structuredClone(this.readResult);
  }

  async save(value: ProjectConfig): Promise<void> {
    this.saved.push(structuredClone(value));
  }

  snapshot(): ProjectConfig | null | Error {
    return this.readResult instanceof Error
      ? this.readResult
      : structuredClone(this.readResult);
  }
}

const validMetadata: ProjectMetadata = {
  statuses: [{ id: "31", name: "Fertig" }],
  issueTypes: [
    { id: "10001", name: "Story", subtask: false },
    { id: "10002", name: "Task", subtask: false },
    { id: "10003", name: "Unteraufgabe", subtask: true },
  ],
};

class ControlledJiraConfigGateway
  implements
    Pick<JiraGateway, "listFields" | "getProjectMetadata">,
    JiraJqlValidator
{
  readonly calls: string[] = [];
  readonly metadataCalls: string[] = [];
  readonly jqlCalls: string[] = [];
  readonly jqlFieldCalls: JiraField[][] = [];

  constructor(
    private readonly fields: JiraField[],
    private readonly metadata: ProjectMetadata = validMetadata,
    private readonly jqlValid = true,
  ) {}

  listFields(projectId: string): Promise<JiraField[]> {
    this.calls.push(projectId);
    return Promise.resolve(structuredClone(this.fields));
  }

  getProjectMetadata(projectId: string): Promise<ProjectMetadata> {
    this.metadataCalls.push(projectId);
    return Promise.resolve(structuredClone(this.metadata));
  }

  validateJql(jql: string, fields: readonly JiraField[]): Promise<boolean> {
    this.jqlCalls.push(jql);
    this.jqlFieldCalls.push(fields.map((field) => ({ ...field })));
    return Promise.resolve(this.jqlValid);
  }
}

const supportedDescriptionField: JiraField = {
  id: "description",
  name: "Beschreibung",
  custom: false,
  schemaType: null,
};

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

const rejectedFieldCases: ReadonlyArray<
  readonly [string, string, readonly JiraField[]]
> = [
  [
    "eine unbekannte Feld-ID",
    "customfield_99999",
    [supportedCustomStringField],
  ],
  [
    "ein Custom Number Field",
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
    "ein Custom Boolean Field",
    "customfield_20001",
    [
      {
        id: "customfield_20001",
        name: "Technischer Schalter",
        custom: true,
        schemaType: "boolean",
      },
    ],
  ],
  [
    "ein Custom Date Field",
    "customfield_20002",
    [
      {
        id: "customfield_20002",
        name: "Technisches Datum",
        custom: true,
        schemaType: "date",
      },
    ],
  ],
  [
    "ein Custom User Field",
    "customfield_20003",
    [
      {
        id: "customfield_20003",
        name: "Fachverantwortlicher",
        custom: true,
        schemaType: "user",
      },
    ],
  ],
  [
    "ein Custom Option Field",
    "customfield_20004",
    [
      {
        id: "customfield_20004",
        name: "Freigabeauswahl",
        custom: true,
        schemaType: "option",
      },
    ],
  ],
  [
    "ein Custom Array Field",
    "customfield_20005",
    [
      {
        id: "customfield_20005",
        name: "Technische Liste",
        custom: true,
        schemaType: "array",
      },
    ],
  ],
  [
    "das Systemfeld summary mit schemaType string",
    "summary",
    [
      {
        id: "summary",
        name: "Zusammenfassung",
        custom: false,
        schemaType: "string",
      },
    ],
  ],
];

function jiraFields(
  fields: readonly JiraField[] = [supportedCustomStringField],
  metadata: ProjectMetadata = validMetadata,
  jqlValid = true,
) {
  return new ControlledJiraConfigGateway([...fields], metadata, jqlValid);
}

describe("In-Memory ProjectConfig Repository", () => {
  it("speichert und lädt eine defensive Kopie", async () => {
    const repository = new InMemoryProjectConfigRepository();
    await repository.save(projectConfig);
    const loaded = await repository.get(projectConfig.projectId);
    expect(loaded).toEqual(projectConfig);
    loaded!.blockerLabels.push("mutiert");
    expect(
      (await repository.get(projectConfig.projectId))?.blockerLabels,
    ).not.toContain("mutiert");
  });

  it("bewahrt createdAt beim Aktualisieren und dedupliziert Werte", async () => {
    const repository = new InMemoryProjectConfigRepository();
    await repository.save(projectConfig);
    const saved = await saveProjectConfig(
      jiraFields(),
      repository,
      { now: () => "2026-07-11T10:00:00.000Z" },
      {
        ...projectConfig,
        acceptedStatusIds: ["31", "31"],
        blockerLabels: ["release-blocker", "release-blocker"],
      },
    );
    expect(saved.createdAt).toBe(projectConfig.createdAt);
    expect(saved.updatedAt).toBe("2026-07-11T10:00:00.000Z");
    expect(saved.acceptedStatusIds).toEqual(["31"]);
  });

  it.each([
    ["description mit schemaType null", supportedDescriptionField],
    ["ein Custom Field mit schemaType string", supportedCustomStringField],
  ])("speichert %s", async (_case, field) => {
    const repository = new ControlledProjectConfigRepository(null);
    const jira = jiraFields([field]);
    const now = "2026-08-04T12:00:00.000Z";

    const saved = await saveProjectConfig(
      jira,
      repository,
      { now: () => now },
      { ...projectConfig, acceptanceCriteriaFieldId: field.id },
    );

    expect(jira.calls).toEqual([projectConfig.projectId]);
    expect(jira.metadataCalls).toEqual([projectConfig.projectId]);
    expect(repository.reads).toEqual([projectConfig.projectId]);
    expect(saved).toMatchObject({
      acceptanceCriteriaFieldId: field.id,
      createdAt: now,
      updatedAt: now,
    });
    expect(repository.saved).toEqual([saved]);
  });

  it("ersetzt eine beschädigte Konfiguration nach streng fehlgeschlagenem Read", async () => {
    const storageError = new AppError(
      "STORAGE_CORRUPT",
      "Stored config failed validation.",
    );
    const repository = new ControlledProjectConfigRepository(storageError);
    const jira = jiraFields();
    const now = "2026-08-04T12:00:00.000Z";

    const saved = await saveProjectConfig(
      jira,
      repository,
      { now: () => now },
      projectConfig,
    );

    expect(jira.calls).toEqual([projectConfig.projectId]);
    expect(jira.metadataCalls).toEqual([projectConfig.projectId]);
    expect(repository.reads).toEqual([projectConfig.projectId]);
    expect(saved).toMatchObject({ createdAt: now, updatedAt: now });
    expect(repository.saved).toEqual([saved]);
  });

  it.each([
    ["unbekannte Status-ID", { acceptedStatusIds: ["99999"] }],
    ["unbekannte Vorgangstyp-ID", { includedIssueTypes: ["99999"] }],
    [
      "gemischte gültige und unbekannte Vorgangstyp-IDs",
      { includedIssueTypes: ["10001", "99999"] },
    ],
    ["Unteraufgaben-Typ als Hauptvorgang", { includedIssueTypes: ["10003"] }],
  ])("lehnt %s vor jedem KVS-Zugriff ab", async (_case, overrides) => {
    const existing = structuredClone(projectConfig);
    const repository = new ControlledProjectConfigRepository(existing);
    const jira = jiraFields();

    await expect(
      saveProjectConfig(
        jira,
        repository,
        { now: () => "2026-08-10T14:00:00.000Z" },
        { ...projectConfig, ...overrides },
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    expect(repository.reads).toHaveLength(0);
    expect(repository.saved).toHaveLength(0);
    expect(jira.jqlCalls).toHaveLength(0);
  });

  it("lehnt ein unbekanntes JQL-Feld vor jedem KVS-Zugriff ab", async () => {
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
    expect(jira.jqlCalls).toHaveLength(0);
  });

  it("lehnt eine von Jira als ungültig bewertete Feld-Operator-Kombination vor KVS ab", async () => {
    const repository = new ControlledProjectConfigRepository(projectConfig);
    const jira = jiraFields(
      [supportedCustomStringField, statusJqlField],
      validMetadata,
      false,
    );
    const releaseScopeJql = "project = DEMO AND status ~ Fertig";

    await expect(
      saveProjectConfig(
        jira,
        repository,
        { now: () => "2026-08-10T14:00:00.000Z" },
        { ...projectConfig, releaseScopeJql },
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    expect(jira.jqlCalls).toEqual([releaseScopeJql]);
    expect(repository.reads).toHaveLength(0);
    expect(repository.saved).toHaveLength(0);
  });

  it.each([
    ["Systemfeld key", "project = DEMO AND key = DEMO-42"],
    ["Jira-Feld-ID", "project = DEMO AND status = Fertig"],
    ["Jira-Feldname", 'project = DEMO AND "Status" = Fertig'],
    [
      "Custom-Field-Anzeigename",
      'project = DEMO AND "Akzeptanzkriterien" = vorhanden',
    ],
    [
      "Custom-Field-ID",
      `project = DEMO AND ${projectConfig.acceptanceCriteriaFieldId} = vorhanden`,
    ],
  ])(
    "akzeptiert ein bekanntes JQL-Feld über %s",
    async (_case, releaseScopeJql) => {
      const repository = new ControlledProjectConfigRepository(null);
      const jira = jiraFields([supportedCustomStringField, statusJqlField]);

      const saved = await saveProjectConfig(
        jira,
        repository,
        { now: () => "2026-08-10T13:00:00.000Z" },
        { ...projectConfig, releaseScopeJql },
      );

      expect(jira.jqlCalls).toEqual([releaseScopeJql]);
      expect(jira.jqlFieldCalls).toEqual([
        [supportedCustomStringField, statusJqlField],
      ]);
      expect(saved.releaseScopeJql).toBe(releaseScopeJql);
      expect(repository.saved).toEqual([saved]);
    },
  );

  it.each([
    [
      "technischen Storage-Ausfall",
      new AppError("STORAGE_UNAVAILABLE", "KVS read failed."),
    ],
    ["unbekannten Fehler", new Error("Unexpected read failure")],
  ])("propagiert %s und führt keinen Save aus", async (_case, error) => {
    const repository = new ControlledProjectConfigRepository(error);

    await expect(
      saveProjectConfig(
        jiraFields(),
        repository,
        { now: () => "2026-08-04T12:00:00.000Z" },
        projectConfig,
      ),
    ).rejects.toBe(error);
    expect(repository.saved).toHaveLength(0);
  });

  it.each(rejectedFieldCases)(
    "lehnt %s vor jedem KVS-Zugriff ab",
    async (_case, fieldId, fields) => {
      const existing = structuredClone(projectConfig);
      const repository = new ControlledProjectConfigRepository(existing);
      const jira = jiraFields(fields);

      await expect(
        saveProjectConfig(
          jira,
          repository,
          { now: () => "2026-08-05T12:00:00.000Z" },
          { ...projectConfig, acceptanceCriteriaFieldId: fieldId },
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });

      expect(jira.calls).toEqual([projectConfig.projectId]);
      expect(repository.reads).toHaveLength(0);
      expect(repository.saved).toHaveLength(0);
      expect(repository.snapshot()).toEqual(existing);
    },
  );

  it("normalisiert einen alten KVS-Datensatz ohne Scope-Felder auf VERSION_ONLY", () => {
    const legacy = Object.fromEntries(
      Object.entries(projectConfig).filter(
        ([key]) => key !== "releaseScopeMode" && key !== "releaseScopeJql",
      ),
    );
    expect(normalizeStoredProjectConfig(legacy)).toEqual(
      config({ releaseScopeMode: "VERSION_ONLY" }),
    );
  });

  it("speichert und lädt beide Scope-Modi ohne Issue-Snapshots", async () => {
    for (const value of [
      config({ releaseScopeMode: "VERSION_ONLY" }),
      projectConfig,
    ]) {
      const repository = new InMemoryProjectConfigRepository();
      await repository.save(value);
      expect(await repository.get(value.projectId)).toEqual(value);
    }
  });
});
