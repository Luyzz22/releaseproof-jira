import { z } from "zod";
import {
  EVIDENCE_OUTCOME_IDS,
  EVIDENCE_RULE_IDS,
} from "../../domain/models/evidence-outcome";
import { READINESS_STATUSES } from "../../domain/models/readiness";
import { AppError } from "../../shared/errors";
import type {
  CompletedAnalysis,
  EvaluatedFinding,
  ExplanationLocale,
  FindingEvidenceEnvelope,
  ReleaseEvidenceEnvelope,
} from "./contracts";

const findingSchema = z
  .object({
    ruleId: z.enum(EVIDENCE_RULE_IDS),
    outcomeId: z.enum(EVIDENCE_OUTCOME_IDS),
    status: z.enum(READINESS_STATUSES),
  })
  .strict()
  .refine((finding) => finding.outcomeId.startsWith(`${finding.ruleId}/`));
const countSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const aggregatesSchema = z
  .object({
    status: z.enum(READINESS_STATUSES),
    score: z.number().int().min(0).max(100),
    totalIssues: countSchema,
    readyIssues: countSchema,
    incompleteIssues: countSchema,
    blockedIssues: countSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.totalIssues ===
      value.readyIssues + value.incompleteIssues + value.blockedIssues,
  );

function invalidResult(): never {
  throw new AppError(
    "INVALID_INPUT",
    "A completed deterministic result with an existing finding is required.",
  );
}

function locale(value: unknown): ExplanationLocale {
  return value === "de-DE" ? "de-DE" : "en-US";
}

function findingCodes(
  finding: EvaluatedFinding,
): FindingEvidenceEnvelope["finding"] {
  // Rebuild, do not spread. Even outcome.params contains customer-owned text.
  const parsed = findingSchema.safeParse({
    ruleId: finding.ruleId,
    outcomeId: finding.outcome.outcomeId,
    status: finding.status,
  });
  if (!parsed.success) return invalidResult();
  return Object.freeze(parsed.data);
}

export function findingEnvelope(
  result: CompletedAnalysis,
  reference: Readonly<{ issueKey: string; ruleId: string }>,
  requestedLocale: unknown,
): { finding: EvaluatedFinding; envelope: FindingEvidenceEnvelope } {
  const issues = result.results.filter(
    (item) => item.issueKey === reference.issueKey,
  );
  if (issues.length !== 1) return invalidResult();
  const findings = issues[0]!.evidence.filter(
    (item) =>
      item.ruleId === reference.ruleId && item.issueKey === reference.issueKey,
  );
  const finding = findings[0];
  if (findings.length !== 1 || !finding) return invalidResult();
  return {
    finding,
    envelope: Object.freeze({
      schemaVersion: 1,
      kind: "finding",
      locale: locale(requestedLocale),
      finding: findingCodes(finding),
    }),
  };
}

export function releaseEnvelope(
  result: CompletedAnalysis,
  requestedLocale: unknown,
): ReleaseEvidenceEnvelope {
  const parsed = aggregatesSchema.safeParse({
    status: result.status,
    score: result.score,
    totalIssues: result.totalIssues,
    readyIssues: result.readyIssues,
    incompleteIssues: result.incompleteIssues,
    blockedIssues: result.blockedIssues,
  });
  if (!parsed.success || parsed.data.totalIssues !== result.results.length)
    return invalidResult();
  const counts = EVIDENCE_RULE_IDS.map((ruleId) => ({
    ruleId,
    incomplete: 0,
    blocked: 0,
  }));
  for (const issue of result.results) {
    for (const finding of issue.evidence) {
      const codes = findingCodes(finding);
      const rule = counts.find((item) => item.ruleId === codes.ruleId)!;
      if (codes.status === "INCOMPLETE") rule.incomplete += 1;
      if (codes.status === "BLOCKED") rule.blocked += 1;
    }
  }
  return Object.freeze({
    schemaVersion: 1,
    kind: "release-summary",
    locale: locale(requestedLocale),
    status: parsed.data.status,
    score: parsed.data.score,
    totalIssues: parsed.data.totalIssues,
    readyIssues: parsed.data.readyIssues,
    incompleteIssues: parsed.data.incompleteIssues,
    blockedIssues: parsed.data.blockedIssues,
    findingsByRule: Object.freeze(counts.map((count) => Object.freeze(count))),
  });
}
