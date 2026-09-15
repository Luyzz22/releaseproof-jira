import { evidenceOutcome } from "../models/evidence-outcome";
import { evidence, type ReadinessRule } from "./types";

export const noOpenSubtasksRule: ReadinessRule = {
  ruleId: "no-open-subtasks",
  evaluate(context) {
    if (!context.config.blockOnOpenSubtasks) {
      return evidence(context, {
        ruleId: this.ruleId,
        category: "DEPENDENCY",
        status: "NOT_APPLICABLE",
        outcome: evidenceOutcome("no-open-subtasks/disabled", {}),
        sourceField: "subtasks",
      });
    }

    const open = context.issue.subtasks.filter(
      (subtask) =>
        subtask.resolution === null &&
        (subtask.status === null ||
          !context.config.acceptedStatusIds.includes(subtask.status.id)),
    );

    return evidence(context, {
      ruleId: this.ruleId,
      category: "DEPENDENCY",
      status: open.length > 0 ? "BLOCKED" : "READY",
      outcome:
        open.length > 0
          ? evidenceOutcome("no-open-subtasks/blocked", {
              count: open.length,
              issueKeys: open.map((item) => item.key),
            })
          : evidenceOutcome("no-open-subtasks/clear", {}),
      sourceField: "subtasks",
    });
  },
};
