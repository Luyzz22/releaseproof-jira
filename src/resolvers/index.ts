import { makeResolver } from "@forge/resolver";
import { analyzeRelease } from "../application/analyze-release/analyze-release";
import { loadProjectData } from "../application/load-project-data/load-project-data";
import { saveProjectConfig } from "../application/save-project-config/save-project-config";
import { systemClock } from "../application/ports";
import { ForgeJiraClient } from "../infrastructure/jira/forge-jira-client";
import { ForgeProjectConfigRepository } from "../infrastructure/storage/forge-project-config-repository";
import { AppError, toSafeError } from "../shared/errors";
import type {
  ApiResult,
  ResolverDefinitions,
} from "../shared/resolver-contract";
import {
  projectConfigInputSchema,
  projectContextSchema,
  versionInputSchema,
} from "../shared/validation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readProjectContext(context: unknown) {
  if (
    !isRecord(context) ||
    !isRecord(context.extension) ||
    !isRecord(context.extension.project)
  ) {
    throw new AppError(
      "PROJECT_CONTEXT_MISSING",
      "Forge project context is missing.",
    );
  }
  const parsed = projectContextSchema.safeParse({
    projectId: context.extension.project.id,
    projectKey: context.extension.project.key,
    siteUrl: context.siteUrl,
  });
  if (!parsed.success) {
    throw new AppError(
      "PROJECT_CONTEXT_MISSING",
      "Forge project context is invalid.",
    );
  }
  return parsed.data;
}

async function safely<T>(operation: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    return { ok: false, error: toSafeError(error) };
  }
}

const jira = new ForgeJiraClient();
const repository = new ForgeProjectConfigRepository();

export const handler = makeResolver<ResolverDefinitions>({
  getBootstrap: ({ context }) =>
    safely(async () => {
      const projectContext = readProjectContext(context);
      const data = await loadProjectData(
        jira,
        repository,
        projectContext.projectId,
        projectContext.projectKey,
      );
      return { ...data, siteUrl: projectContext.siteUrl };
    }),
  saveProjectConfig: ({ payload, context }) =>
    safely(async () => {
      const projectContext = readProjectContext(context);
      const parsed = projectConfigInputSchema.safeParse(payload);
      if (!parsed.success) {
        throw new AppError(
          "INVALID_INPUT",
          "Project config validation failed.",
        );
      }
      if (
        parsed.data.projectId !== projectContext.projectId ||
        parsed.data.projectKey !== projectContext.projectKey
      ) {
        throw new AppError("INVALID_INPUT", "Project config context mismatch.");
      }
      return saveProjectConfig(jira, repository, systemClock, parsed.data);
    }),
  analyzeRelease: ({ payload, context }) =>
    safely(async () => {
      const projectContext = readProjectContext(context);
      const parsed = versionInputSchema.safeParse(payload);
      if (!parsed.success) {
        throw new AppError("INVALID_INPUT", "Version validation failed.");
      }
      return analyzeRelease(jira, repository, systemClock, {
        projectId: projectContext.projectId,
        projectKey: projectContext.projectKey,
        versionId: parsed.data.versionId,
      });
    }),
});
