import type {
  EvidenceItem,
  ProjectConfig,
  ReleaseCandidate,
  ReleaseIssue,
} from "../models/readiness";

export interface RuleContext {
  issue: ReleaseIssue;
  config: ProjectConfig;
  release: Pick<ReleaseCandidate, "versionId" | "versionName">;
}

export interface ReadinessRule {
  readonly ruleId: string;
  evaluate(context: RuleContext): EvidenceItem;
}

export function evidence(
  context: RuleContext,
  item: Omit<EvidenceItem, "issueKey">,
): EvidenceItem {
  return { ...item, issueKey: context.issue.key };
}
