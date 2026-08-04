import { acceptanceCriteriaPresentRule } from "./acceptance-criteria-present";
import { acceptedStatusRule } from "./accepted-status";
import { approvalMarkerPresentRule } from "./approval-marker-present";
import { correctFixVersionRule } from "./correct-fix-version";
import { noBlockerLabelRule } from "./no-blocker-label";
import { noBlockingLinksRule } from "./no-blocking-links";
import { noOpenSubtasksRule } from "./no-open-subtasks";

export const readinessRules = [
  acceptanceCriteriaPresentRule,
  acceptedStatusRule,
  noOpenSubtasksRule,
  noBlockingLinksRule,
  correctFixVersionRule,
  noBlockerLabelRule,
  approvalMarkerPresentRule,
] as const;

export {
  acceptanceCriteriaPresentRule,
  acceptedStatusRule,
  approvalMarkerPresentRule,
  correctFixVersionRule,
  noBlockerLabelRule,
  noBlockingLinksRule,
  noOpenSubtasksRule,
};
