import { toReleaseReadinessDto } from "../../src/application/analyze-release/to-release-readiness-dto";
import type {
  ProjectConfig,
  ReleaseCandidate,
} from "../../src/domain/models/readiness";
import { analyzeRelease } from "../../src/domain/services/analyze-release";
import type { ReleaseReadinessResultDto } from "../../src/shared/release-readiness-dto";
import { projectConfig, release } from "./release";

export function readinessDto(
  candidate: ReleaseCandidate = release(),
  config: ProjectConfig = projectConfig,
  generatedAt = "2026-07-11T09:00:00.000Z",
): ReleaseReadinessResultDto {
  return toReleaseReadinessDto(analyzeRelease(candidate, config, generatedAt));
}
