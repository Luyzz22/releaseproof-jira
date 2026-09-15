import { evidenceOutcome } from "../models/evidence-outcome";
import { evidence, type ReadinessRule } from "./types";

export const approvalMarkerPresentRule: ReadinessRule = {
  ruleId: "approval-marker-present",
  evaluate(context) {
    if (!context.config.requireApprovalMarker) {
      return evidence(context, {
        ruleId: this.ruleId,
        category: "APPROVAL",
        status: "NOT_APPLICABLE",
        outcome: evidenceOutcome("approval-marker-present/disabled", {}),
        sourceField: "labels",
      });
    }

    const marker = context.config.approvalMarker.trim().toLowerCase();
    const present =
      marker.length > 0 &&
      context.issue.labels.some(
        (label) => label.trim().toLowerCase() === marker,
      );

    return evidence(context, {
      ruleId: this.ruleId,
      category: "APPROVAL",
      status: present ? "READY" : "INCOMPLETE",
      outcome: present
        ? evidenceOutcome("approval-marker-present/present", {
            approvalMarker: context.config.approvalMarker,
          })
        : evidenceOutcome("approval-marker-present/missing", {
            approvalMarker: context.config.approvalMarker,
          }),
      sourceField: "labels",
    });
  },
};
