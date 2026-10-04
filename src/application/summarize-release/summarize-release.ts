import type { SummaryEvidenceContractV1 } from "../../shared/evidence-contract-v1";
import type { Explanation } from "../explanation/contracts";
import { releaseEnvelope } from "../explanation/evidence-envelope";
import {
  DISABLED_EXPLANATIONS,
  type ExplanationCapability,
} from "../explanation/ports";
import { requestExplanation } from "../explanation/request-explanation";

export async function summarizeRelease(
  input: Readonly<{ evidence: unknown; locale?: unknown }>,
  capability: ExplanationCapability = DISABLED_EXPLANATIONS,
): Promise<
  Readonly<{
    deterministicEvidence: SummaryEvidenceContractV1;
    explanation: Explanation;
  }>
> {
  const { evidence, envelope } = releaseEnvelope(input.evidence, input.locale);
  const explanation = await requestExplanation(envelope, capability);
  return Object.freeze({ deterministicEvidence: evidence, explanation });
}
