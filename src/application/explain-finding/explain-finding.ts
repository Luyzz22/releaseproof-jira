import type {
  CompletedAnalysis,
  EvaluatedFinding,
  Explanation,
} from "../explanation/contracts";
import { findingEnvelope } from "../explanation/evidence-envelope";
import {
  DISABLED_EXPLANATIONS,
  type ExplanationCapability,
} from "../explanation/ports";
import { requestExplanation } from "../explanation/request-explanation";

export async function explainFinding(
  input: Readonly<{
    result: CompletedAnalysis;
    issueKey: string;
    ruleId: string;
    locale?: unknown;
  }>,
  capability: ExplanationCapability = DISABLED_EXPLANATIONS,
): Promise<
  Readonly<{
    deterministicResult: CompletedAnalysis;
    deterministicFinding: EvaluatedFinding;
    explanation: Explanation;
  }>
> {
  const { finding, envelope } = findingEnvelope(
    input.result,
    input,
    input.locale,
  );
  const explanation = await requestExplanation(envelope, capability);
  return Object.freeze({
    deterministicResult: input.result,
    deterministicFinding: finding,
    explanation,
  });
}
