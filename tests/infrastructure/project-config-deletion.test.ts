import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForgeProjectConfigRepository } from "../../src/infrastructure/storage/forge-project-config-repository";
import { toSafeError } from "../../src/shared/errors";
import { config } from "../fixtures/release";

const storage = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  get: vi.fn<(key: string) => Promise<unknown>>(),
  delete: vi.fn<(key: string) => Promise<void>>(),
  set: vi.fn(),
}));
vi.mock("@forge/kvs", () => ({ kvs: storage }));

const secrets = ["SECRET_JQL", "SECRET_LABEL", "SECRET_APPROVAL_MARKER"];
const sensitiveConfig = config({
  releaseScopeJql: "project = DEMO AND labels = SECRET_JQL",
  blockerLabels: ["SECRET_LABEL"],
  approvalMarker: "SECRET_APPROVAL_MARKER",
});

beforeEach(() => {
  vi.resetAllMocks();
  storage.values.clear();
  storage.values.set("schema-version", 2);
  storage.values.set("project-config:10000", sensitiveConfig);
  storage.values.set(
    "project-config:10001",
    config({ projectId: "10001", projectKey: "OTHER" }),
  );
  storage.get.mockImplementation(async (key) => storage.values.get(key));
  storage.delete.mockImplementation(async (key) => {
    storage.values.delete(key);
  });
});
afterEach(() => vi.restoreAllMocks());

describe("Forge project configuration deletion", () => {
  it("deletes the exact project key, preserving other projects and schema-version", async () => {
    const other = storage.values.get("project-config:10001");
    expect(await new ForgeProjectConfigRepository().delete("10000")).toBe(true);
    expect(storage.get).toHaveBeenCalledExactlyOnceWith("project-config:10000");
    expect(storage.delete).toHaveBeenCalledExactlyOnceWith(
      "project-config:10000",
    );
    expect(storage.values.has("project-config:10000")).toBe(false);
    expect(storage.values.get("project-config:10001")).toEqual(other);
    expect(storage.values.get("schema-version")).toBe(2);
    expect(storage.set).not.toHaveBeenCalled();
  });

  it("succeeds when already absent and does not mutate any other key", async () => {
    storage.values.delete("project-config:10000");
    expect(await new ForgeProjectConfigRepository().delete("10000")).toBe(
      false,
    );
    expect(storage.delete).not.toHaveBeenCalled();
    expect(storage.values.size).toBe(2);
  });

  it("can remove invalid stored configuration without field/JQL validation or save", async () => {
    storage.values.set("project-config:10000", { obsolete: "SECRET_JQL" });
    expect(await new ForgeProjectConfigRepository().delete("10000")).toBe(true);
    expect(storage.set).not.toHaveBeenCalled();
  });

  it.each(["get", "delete"] as const)(
    "maps %s failures to a safe storage error without exposing or logging content",
    async (operation) => {
      const logs = [
        vi.spyOn(console, "log"),
        vi.spyOn(console, "info"),
        vi.spyOn(console, "warn"),
        vi.spyOn(console, "error"),
        vi.spyOn(console, "debug"),
      ];
      storage[operation].mockRejectedValueOnce(
        new Error(JSON.stringify(sensitiveConfig)),
      );
      const error: unknown = await new ForgeProjectConfigRepository()
        .delete("10000")
        .catch((failure: unknown) => failure);
      expect(error).toMatchObject({ code: "STORAGE_UNAVAILABLE" });
      expect(toSafeError(error)).toEqual({
        code: "STORAGE_UNAVAILABLE",
        message: "STORAGE_UNAVAILABLE",
      });
      for (const secret of secrets) {
        expect(String(error)).not.toContain(secret);
        expect(JSON.stringify(error)).not.toContain(secret);
        expect(JSON.stringify(logs.map((log) => log.mock.calls))).not.toContain(
          secret,
        );
      }
      for (const log of logs) expect(log).not.toHaveBeenCalled();
      expect(storage.values.get("project-config:10000")).toEqual(
        sensitiveConfig,
      );
      expect(storage.values.get("schema-version")).toBe(2);
    },
  );

  it("does not log configuration during successful deletion", async () => {
    const logs = [
      vi.spyOn(console, "log"),
      vi.spyOn(console, "info"),
      vi.spyOn(console, "warn"),
      vi.spyOn(console, "error"),
      vi.spyOn(console, "debug"),
    ];
    await new ForgeProjectConfigRepository().delete("10000");
    for (const log of logs) expect(log).not.toHaveBeenCalled();
  });
});
