import { beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../fixtures/release";

const mocks = vi.hoisted(() => {
  const handlers: Record<
    string,
    (request: { payload?: unknown; context?: unknown }) => Promise<unknown>
  > = {};
  return {
    handlers,
    canAdministerProject: vi.fn<(projectId: string) => Promise<boolean>>(),
    values: new Map<string, unknown>(),
    get: vi.fn<(key: string) => Promise<unknown>>(),
    delete: vi.fn<(key: string) => Promise<void>>(),
  };
});
vi.mock("@forge/resolver", () => ({
  makeResolver: (handlers: typeof mocks.handlers) => {
    mocks.handlers = handlers;
    return vi.fn();
  },
}));
vi.mock("../../src/infrastructure/jira/forge-jira-client", () => ({
  ForgeJiraClient: class {
    canAdministerProject = mocks.canAdministerProject;
  },
}));
vi.mock("@forge/kvs", () => ({
  kvs: { get: mocks.get, delete: mocks.delete },
}));
import "../../src/resolvers/index";

const context = {
  siteUrl: "https://demo.atlassian.net",
  extension: { project: { id: "10000", key: "DEMO" } },
};
function invoke(request: { payload?: unknown; context?: unknown }) {
  const handler = mocks.handlers.deleteProjectConfig;
  expect(handler).toBeTypeOf("function");
  return handler!(request);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.values.clear();
  mocks.values.set("project-config:10000", config());
  mocks.values.set(
    "project-config:10001",
    config({ projectId: "10001", projectKey: "OTHER" }),
  );
  mocks.canAdministerProject.mockResolvedValue(true);
  mocks.get.mockImplementation(async (key) => mocks.values.get(key));
  mocks.delete.mockImplementation(async (key) => {
    mocks.values.delete(key);
  });
});

describe("Context-bound delete resolver", () => {
  it("uses only Forge context and returns an explicit idempotent result", async () => {
    expect(await invoke({ context })).toEqual({
      ok: true,
      data: { deleted: true },
    });
    expect(mocks.canAdministerProject).toHaveBeenCalledExactlyOnceWith("10000");
    expect(mocks.delete).toHaveBeenCalledExactlyOnceWith(
      "project-config:10000",
    );
    expect(mocks.values.has("project-config:10001")).toBe(true);
    expect(await invoke({ context, payload: {} })).toEqual({
      ok: true,
      data: { deleted: false },
    });
  });

  it.each(
    [
      { projectId: "10001" },
      { projectKey: "OTHER" },
      { key: "schema-version" },
      null,
      "10001",
      [],
    ].map((payload) => ({ payload })),
  )(
    "rejects client-selected targets and unexpected payloads: $payload",
    async ({ payload }) => {
      expect(await invoke({ context, payload })).toEqual({
        ok: false,
        error: { code: "INVALID_INPUT", message: "INVALID_INPUT" },
      });
      expect(mocks.get).not.toHaveBeenCalled();
      expect(mocks.delete).not.toHaveBeenCalled();
      expect(mocks.values.size).toBe(2);
    },
  );

  it.each([
    undefined,
    {},
    { ...context, extension: {} },
    { ...context, extension: { project: { id: "../10001", key: "OTHER" } } },
  ])("fails safely for invalid project context: %j", async (invalidContext) => {
    expect(await invoke({ context: invalidContext })).toEqual({
      ok: false,
      error: {
        code: "PROJECT_CONTEXT_MISSING",
        message: "PROJECT_CONTEXT_MISSING",
      },
    });
    expect(mocks.canAdministerProject).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("preserves configuration without KVS access when permission is denied", async () => {
    mocks.canAdministerProject.mockResolvedValue(false);
    expect(await invoke({ context })).toEqual({
      ok: false,
      error: { code: "PERMISSION_DENIED", message: "PERMISSION_DENIED" },
    });
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.values.get("project-config:10000")).toEqual(config());
  });

  it("returns only the safe storage error contract", async () => {
    mocks.delete.mockRejectedValue(
      new Error("SECRET_JQL SECRET_LABEL SECRET_APPROVAL_MARKER"),
    );
    expect(await invoke({ context })).toEqual({
      ok: false,
      error: { code: "STORAGE_UNAVAILABLE", message: "STORAGE_UNAVAILABLE" },
    });
    expect(mocks.values.get("project-config:10000")).toEqual(config());
  });
});
