import { describe, expect, it } from "vitest";
import { saveProjectConfig } from "../../src/application/save-project-config/save-project-config";
import { InMemoryProjectConfigRepository } from "../../src/infrastructure/storage/in-memory-project-config-repository";
import { normalizeStoredProjectConfig } from "../../src/shared/validation";
import { config, projectConfig } from "../fixtures/release";

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
