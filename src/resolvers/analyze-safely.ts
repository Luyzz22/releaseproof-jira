import { toSafeError } from "../shared/errors";
import {
  analysisFailureDiagnostic,
  withAnalysisStage,
} from "../shared/failure-diagnostics";
import type { ApiResult } from "../shared/resolver-contract";

export async function analyzeSafely<T>(
  operation: () => Promise<T>,
): Promise<ApiResult<T>> {
  try {
    return { ok: true, data: await withAnalysisStage("analysis", operation) };
  } catch (error) {
    try {
      console.error(JSON.stringify(analysisFailureDiagnostic(error)));
    } catch {
      // Logging must not prevent the existing safe response from reaching Jira.
    }
    return { ok: false, error: toSafeError(error) };
  }
}
