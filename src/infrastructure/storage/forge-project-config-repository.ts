import { kvs } from "@forge/kvs";
import type { ProjectConfigRepository } from "../../application/ports";
import type { ProjectConfig } from "../../domain/models/readiness";
import { AppError } from "../../shared/errors";
import {
  normalizeStoredProjectConfig,
  projectConfigSchema,
} from "../../shared/validation";

const SCHEMA_VERSION = 2;

export class ForgeProjectConfigRepository implements ProjectConfigRepository {
  async delete(projectId: string): Promise<boolean> {
    const key = `project-config:${projectId}`;
    try {
      // Do not validate configuration content: obsolete/corrupt data is deletable too.
      if ((await kvs.get(key)) === undefined) return false;
      await kvs.delete(key);
      return true;
    } catch {
      throw new AppError("STORAGE_UNAVAILABLE", "KVS deletion failed.");
    }
  }

  async get(projectId: string): Promise<ProjectConfig | null> {
    try {
      const value = await kvs.get(`project-config:${projectId}`);
      if (value === undefined) return null;
      const config = normalizeStoredProjectConfig(value);
      if (!config) {
        throw new AppError(
          "STORAGE_CORRUPT",
          "Stored config failed validation.",
        );
      }
      return config;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("STORAGE_UNAVAILABLE", "KVS read failed.");
    }
  }

  async save(config: ProjectConfig): Promise<void> {
    try {
      await Promise.all([
        kvs.set("schema-version", SCHEMA_VERSION),
        kvs.set(
          `project-config:${config.projectId}`,
          projectConfigSchema.parse(config),
        ),
      ]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("STORAGE_UNAVAILABLE", "KVS write failed.");
    }
  }
}
