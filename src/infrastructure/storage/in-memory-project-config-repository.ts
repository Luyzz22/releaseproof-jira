import type { ProjectConfig } from "../../domain/models/readiness";
import type { ProjectConfigRepository } from "../../application/ports";

export class InMemoryProjectConfigRepository implements ProjectConfigRepository {
  private readonly configs = new Map<string, ProjectConfig>();

  async get(projectId: string): Promise<ProjectConfig | null> {
    const config = this.configs.get(projectId);
    return config ? structuredClone(config) : null;
  }

  async save(config: ProjectConfig): Promise<void> {
    this.configs.set(config.projectId, structuredClone(config));
  }
}
