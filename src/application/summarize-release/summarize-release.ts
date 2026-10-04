import type { CompletedAnalysis, Explanation } from "../explanation/contracts";
import { releaseEnvelope } from "../explanation/evidence-envelope";
import {
  DISABLED_EXPLANATIONS,
  type ExplanationCapability,
} from "../explanation/ports";
import { requestExplanation } from "../explanation/request-explanation";

export async function summarizeRelease(
  input: Readonly<{ result: CompletedAnalysis; locale?: unknown }>,
  capability: ExplanationCapability = DISABLED_EXPLANATIONS,
): Promise<
  Readonly<{ deterministicResult: CompletedAnalysis; explanation: Explanation }>
> {
  const envelope = releaseEnvelope(input.result, input.locale);
  const explanation = await requestExplanation(envelope, capability);
  return Object.freeze({ deterministicResult: input.result, explanation });
}
