import { describe, expect, it } from "vitest";
import type { ProjectConfigRepository } from "../../src/application/ports";
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

  it("setzt bei fehlender Konfiguration beide Zeitstempel neu", async () => {
    const repository = new ControlledProjectConfigRepository(null);
    const now = "2026-08-04T12:00:00.000Z";

    const saved = await saveProjectConfig(
      repository,
      { now: () => now },
      projectConfig,
    );

    expect(saved).toMatchObject({ createdAt: now, updatedAt: now });
    expect(repository.saved).toEqual([saved]);
  });

  it("ersetzt eine beschädigte Konfiguration nach streng fehlgeschlagenem Read", async () => {
    const storageError = new AppError(
      "STORAGE_CORRUPT",
      "Stored config failed validation.",
    );
    const repository = new ControlledProjectConfigRepository(storageError);
    const now = "2026-08-04T12:00:00.000Z";

    await expect(repository.get(projectConfig.projectId)).rejects.toBe(
      storageError,
    );

    const saved = await saveProjectConfig(
      repository,
      { now: () => now },
      projectConfig,
    );

    expect(saved).toMatchObject({ createdAt: now, updatedAt: now });
    expect(repository.saved).toEqual([saved]);
  });

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
        repository,
        { now: () => "2026-08-04T12:00:00.000Z" },
        projectConfig,
      ),
    ).rejects.toBe(error);
    expect(repository.saved).toHaveLength(0);
  });

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
