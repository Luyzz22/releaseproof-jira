import { describe, expect, it, vi } from "vitest";
import { deleteProjectConfig } from "../../src/application/delete-project-config/delete-project-config";
import { InMemoryProjectConfigRepository } from "../../src/infrastructure/storage/in-memory-project-config-repository";
import { AppError } from "../../src/shared/errors";
import { config } from "../fixtures/release";

describe("Delete project configuration", () => {
  it("authorizes the exact project before any storage access and deletes only that project", async () => {
    const repository = new InMemoryProjectConfigRepository();
    const first = config();
    const other = config({ projectId: "10001", projectKey: "OTHER" });
    await repository.save(first);
    await repository.save(other);
    const get = vi.spyOn(repository, "get");
    const save = vi.spyOn(repository, "save");
    const remove = vi.spyOn(repository, "delete");
    const jira = {
      canAdministerProject: vi.fn(async (projectId: string) => {
        expect(projectId).toBe(first.projectId);
        expect(remove).not.toHaveBeenCalled();
        expect(get).not.toHaveBeenCalled();
        expect(save).not.toHaveBeenCalled();
        return true;
      }),
    };

    await expect(
      deleteProjectConfig(jira, repository, first.projectId),
    ).resolves.toEqual({ deleted: true });
    expect(jira.canAdministerProject).toHaveBeenCalledExactlyOnceWith(
      first.projectId,
    );
    expect(remove).toHaveBeenCalledExactlyOnceWith(first.projectId);
    expect(get).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(await repository.get(first.projectId)).toBeNull();
    expect(await repository.get(other.projectId)).toEqual(other);
  });

  it("denies non-admins without reading or deleting configuration", async () => {
    const repository = new InMemoryProjectConfigRepository();
    await repository.save(config());
    const remove = vi.spyOn(repository, "delete");
    const get = vi.spyOn(repository, "get");
    await expect(
      deleteProjectConfig(
        { canAdministerProject: async () => false },
        repository,
        "10000",
      ),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(remove).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(await repository.get("10000")).toEqual(config());
  });

  it("fails closed when permission checking fails", async () => {
    const repository = new InMemoryProjectConfigRepository();
    const remove = vi.spyOn(repository, "delete");
    await expect(
      deleteProjectConfig(
        {
          canAdministerProject: async () => {
            throw new AppError("JIRA_UNAVAILABLE", "Permission unavailable.");
          },
        },
        repository,
        "10000",
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
    expect(remove).not.toHaveBeenCalled();
  });

  it("returns successful idempotent results, including repeated in-memory deletion", async () => {
    const repository = new InMemoryProjectConfigRepository();
    const jira = { canAdministerProject: vi.fn(async () => true) };
    expect(await deleteProjectConfig(jira, repository, "10000")).toEqual({
      deleted: false,
    });
    await repository.save(config());
    expect(await deleteProjectConfig(jira, repository, "10000")).toEqual({
      deleted: true,
    });
    expect(await deleteProjectConfig(jira, repository, "10000")).toEqual({
      deleted: false,
    });
    expect(jira.canAdministerProject).toHaveBeenCalledTimes(3);
  });
});
