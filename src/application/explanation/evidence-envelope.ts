import {
  EVIDENCE_CONTRACT_OUTCOME_STATUSES,
  parseEvidenceContractV1,
  type SummaryEvidenceContractV1,
} from "../../shared/evidence-contract-v1";
import { AppError } from "../../shared/errors";
import type {
  ExplanationLocale,
  FindingEvidenceEnvelope,
  ReleaseEvidenceEnvelope,
} from "./contracts";

function invalidEvidence(): never {
  throw new AppError(
    "INVALID_INPUT",
    "A valid minimized evidence summary with an existing outcome is required.",
  );
}

function summary(input: unknown): SummaryEvidenceContractV1 {
  try {
    // Reject the internal profile before traversing any issue trace. Never downgrade.
    if (
      typeof input !== "object" ||
      input === null ||
      Object.getOwnPropertyDescriptor(input, "profile")?.value !==
        "SUMMARY_MINIMIZED"
    )
      return invalidEvidence();
    const parsed = parseEvidenceContractV1(input);
    if (parsed.profile !== "SUMMARY_MINIMIZED") return invalidEvidence();
    return parsed;
  } catch {
    // Do not retain parser errors, payload text or caller-owned objects.
    return invalidEvidence();
  }
}

function locale(value: unknown): ExplanationLocale {
  return value === "de-DE" ? "de-DE" : "en-US";
}

export function findingEnvelope(
  input: unknown,
  reference: Readonly<{ ruleId: string; outcomeId: string }>,
  requestedLocale: unknown,
): Readonly<{
  evidence: SummaryEvidenceContractV1;
  envelope: FindingEvidenceEnvelope;
}> {
  const evidence = summary(input);
  const rule = evidence.rules.find((item) => item.ruleId === reference.ruleId);
  const outcome = rule?.outcomes.find(
    (item) => item.outcomeId === reference.outcomeId && item.count > 0,
  );
  if (!rule || !outcome) return invalidEvidence();
  // Explain an observed outcome class, never an individual issue or invented finding.
  const finding = Object.freeze({
    ruleId: rule.ruleId,
    outcomeId: outcome.outcomeId,
    status: EVIDENCE_CONTRACT_OUTCOME_STATUSES[outcome.outcomeId],
  });
  return Object.freeze({
    evidence,
    envelope: Object.freeze({
      schemaVersion: 1,
      kind: "finding",
      locale: locale(requestedLocale),
      finding,
    }),
  });
}

export function releaseEnvelope(
  input: unknown,
  requestedLocale: unknown,
): Readonly<{
  evidence: SummaryEvidenceContractV1;
  envelope: ReleaseEvidenceEnvelope;
}> {
  const evidence = summary(input);
  const facts = evidence.release;
  return Object.freeze({
    evidence,
    envelope: Object.freeze({
      schemaVersion: 1,
      kind: "release-summary",
      locale: locale(requestedLocale),
      status: facts.status,
      score: facts.score,
      totalIssues: facts.totalIssues,
      readyIssues: facts.readyIssues,
      incompleteIssues: facts.incompleteIssues,
      blockedIssues: facts.blockedIssues,
      findingsByRule: Object.freeze(
        evidence.rules.map((rule) =>
          Object.freeze({
            ruleId: rule.ruleId,
            incomplete: rule.incomplete,
            blocked: rule.blocked,
          }),
        ),
      ),
    }),
  });
}
