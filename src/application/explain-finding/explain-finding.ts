import type { SummaryEvidenceContractV1 } from "../../shared/evidence-contract-v1";
import type {
  Explanation,
  FindingEvidenceEnvelope,
} from "../explanation/contracts";
import { findingEnvelope } from "../explanation/evidence-envelope";
import {
  DISABLED_EXPLANATIONS,
  type ExplanationCapability,
} from "../explanation/ports";
import { requestExplanation } from "../explanation/request-explanation";

export async function explainFinding(
  input: Readonly<{
    evidence: unknown;
    ruleId: string;
    outcomeId: string;
    locale?: unknown;
  }>,
  capability: ExplanationCapability = DISABLED_EXPLANATIONS,
): Promise<
  Readonly<{
    deterministicEvidence: SummaryEvidenceContractV1;
    deterministicFinding: FindingEvidenceEnvelope["finding"];
    explanation: Explanation;
  }>
> {
  const { evidence, envelope } = findingEnvelope(
    input.evidence,
    input,
    input.locale,
  );
  const explanation = await requestExplanation(envelope, capability);
  return Object.freeze({
    deterministicEvidence: evidence,
    deterministicFinding: envelope.finding,
    explanation,
  });
}
