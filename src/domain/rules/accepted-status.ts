import { evidenceOutcome } from "../models/evidence-outcome";
import { evidence, type ReadinessRule } from "./types";

export const acceptedStatusRule: ReadinessRule = {
  ruleId: "accepted-status",
  evaluate(context) {
    const accepted =
      context.issue.status !== null &&
      context.config.acceptedStatusIds.includes(context.issue.status.id);

    const outcome = accepted
      ? evidenceOutcome("accepted-status/accepted", {
          statusName: context.issue.status?.name ?? "",
        })
      : context.issue.status
        ? evidenceOutcome("accepted-status/not-accepted", {
            statusName: context.issue.status.name,
          })
        : evidenceOutcome("accepted-status/missing", {});

    return evidence(context, {
      ruleId: this.ruleId,
      category: "WORKFLOW",
      status: accepted ? "READY" : "INCOMPLETE",
      outcome,
      sourceField: "status",
    });
  },
};
