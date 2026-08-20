import { describe, expect, it } from "vitest";
import { loadProjectConfig } from "../../src/application/load-project-config/load-project-config";
import { loadProjectData } from "../../src/application/load-project-data/load-project-data";
import type {
  JiraGateway,
  JiraProject,
  JiraVersion,
  ProjectConfigRepository,
  ProjectMetadata,
} from "../../src/application/ports";
import type {
  ProjectConfig,
  ReleaseIssue,
} from "../../src/domain/models/readiness";
import { AppError } from "../../src/shared/errors";
import { projectConfig } from "../fixtures/release";

class BootstrapJiraGateway implements JiraGateway {
  readonly calls: string[] = [];

  async listProjects(): Promise<JiraProject[]> {
    return [];
  }

  async getProject(
    projectIdOrKey: string,
    expectedProjectId: string,
  ): Promise<JiraProject> {
    this.calls.push(`project:${projectIdOrKey}:${expectedProjectId}`);
    return { id: "10000", key: "DEMO", name: "Demoagentur" };
  }

  async getProjectMetadata(): Promise<ProjectMetadata> {
    this.calls.push("metadata");
    return {
      statuses: [{ id: "31", name: "Fertig" }],
      issueTypes: [
        { id: "10001", name: "Story", subtask: false },
        { id: "10003", name: "Subtask", subtask: true },
      ],
    };
  }

  async listFields() {
    this.calls.push("fields");
    return [
      {
        id: "customfield_10042",
        name: "Akzeptanzkriterien",
        custom: true,
        schemaType: "string",
      },
    ];
  }

  async listVersions(
    projectIdOrKey: string,
    expectedProjectId: string,
  ): Promise<JiraVersion[]> {
    this.calls.push(`versions:${projectIdOrKey}:${expectedProjectId}`);
    return [
      {
        id: "30001",
        name: "Kundenrelease 2.4",
        projectId: "10000",
        released: false,
        archived: false,
      },
    ];
  }

  async getVersion(): Promise<JiraVersion> {
    throw new Error("Not used");
  }

  async listIssuesForVersion(): Promise<ReleaseIssue[]> {
    throw new Error("Not used");
  }

  async listIssuesForJqlScope(): Promise<ReleaseIssue[]> {
    throw new Error("Not used");
  }
}

class BootstrapConfigRepository implements ProjectConfigRepository {
  constructor(private readonly readResult: ProjectConfig | null | Error) {}

  async get(): Promise<ProjectConfig | null> {
    if (this.readResult instanceof Error) throw this.readResult;
    return structuredClone(this.readResult);
  }

  async save(): Promise<void> {
    throw new Error("Not used");
  }
}

async function bootstrap(readResult: ProjectConfig | null | Error) {
  const jira = new BootstrapJiraGateway();
  const data = await loadProjectData(
    jira,
    new BootstrapConfigRepository(readResult),
    "10000",
    "DEMO",
  );
  return { data, jira };
}

describe("Load Project Data Recovery", () => {
  it("lässt den normalen Konfigurations-Lesepfad weiterhin streng", async () => {
    const error = new AppError(
      "STORAGE_CORRUPT",
      "Stored config failed validation.",
    );

    await expect(
      loadProjectConfig(new BootstrapConfigRepository(error), "10000"),
    ).rejects.toBe(error);
  });

  it("liefert eine gültige Konfiguration ohne Recovery-Hinweis", async () => {
    const { data } = await bootstrap(projectConfig);

    expect(data.config).toEqual(projectConfig);
    expect(data.configRecoveryRequired).toBe(false);
  });

  it("behandelt eine fehlende Konfiguration als normalen Erststart", async () => {
    const { data } = await bootstrap(null);

    expect(data.config).toBeNull();
    expect(data.configRecoveryRequired).toBe(false);
  });

  it("lädt bei beschädigter Konfiguration weiterhin alle Jira-Metadaten", async () => {
    const { data, jira } = await bootstrap(
      new AppError("STORAGE_CORRUPT", "Stored config failed validation."),
    );

    expect(data.config).toBeNull();
    expect(data.configRecoveryRequired).toBe(true);
    expect(jira.calls).toEqual([
      "project:DEMO:10000",
      "metadata",
      "fields",
      "versions:DEMO:10000",
    ]);
    expect(data.statuses).toHaveLength(1);
    expect(data.issueTypes).toHaveLength(1);
    expect(data.fields).toHaveLength(1);
    expect(data.versions).toHaveLength(1);
  });

  it("propagiert STORAGE_UNAVAILABLE unverändert", async () => {
    const error = new AppError("STORAGE_UNAVAILABLE", "KVS read failed.");

    await expect(bootstrap(error)).rejects.toBe(error);
  });
});
