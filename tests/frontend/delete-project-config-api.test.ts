import { describe, expect, it, vi } from "vitest";
import { releaseProofApi } from "../../src/frontend/api/client";
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@forge/bridge", () => ({ makeInvoke: () => invoke }));

describe("Configuration delete API", () => {
  it("sends no client-controlled project identity", async () => {
    invoke.mockResolvedValue({ ok: true, data: { deleted: true } });
    expect(await releaseProofApi.deleteProjectConfig()).toEqual({
      ok: true,
      data: { deleted: true },
    });
    expect(invoke).toHaveBeenCalledExactlyOnceWith("deleteProjectConfig");
  });

  it("keeps transport failures safe", async () => {
    invoke.mockRejectedValue(
      new Error("SECRET_JQL SECRET_LABEL SECRET_APPROVAL_MARKER"),
    );
    expect(await releaseProofApi.deleteProjectConfig()).toEqual({
      ok: false,
      error: { code: "UNKNOWN_ERROR", message: "UNKNOWN_ERROR" },
    });
  });
});
