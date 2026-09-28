import { makeInvoke } from "@forge/bridge";
import type { DeleteProjectConfigResult } from "../../application/delete-project-config/delete-project-config";
import type {
  ApiResult,
  BootstrapData,
  ResolverDefinitions,
} from "../../shared/resolver-contract";
import type { ProjectConfig } from "../../domain/models/readiness";
import type { ProjectConfigInput } from "../../shared/validation";
import type { ReleaseReadinessResultDto } from "../../shared/release-readiness-dto";

const invoke = makeInvoke<ResolverDefinitions>();

async function transportSafe<T>(
  request: Promise<ApiResult<T>>,
): Promise<ApiResult<T>> {
  try {
    return await request;
  } catch {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "UNKNOWN_ERROR",
      },
    };
  }
}

export const releaseProofApi = {
  deleteProjectConfig(): Promise<ApiResult<DeleteProjectConfigResult>> {
    return transportSafe(invoke("deleteProjectConfig"));
  },
  getBootstrap(): Promise<ApiResult<BootstrapData>> {
    return transportSafe(invoke("getBootstrap"));
  },
  saveProjectConfig(
    input: ProjectConfigInput,
  ): Promise<ApiResult<ProjectConfig>> {
    return transportSafe(invoke("saveProjectConfig", input));
  },
  analyzeRelease(
    versionId: string,
  ): Promise<ApiResult<ReleaseReadinessResultDto>> {
    return transportSafe(invoke("analyzeRelease", { versionId }));
  },
} as const;
