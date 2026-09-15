import { evidenceOutcome } from "../models/evidence-outcome";
import { evidence, type ReadinessRule } from "./types";

export const noBlockerLabelRule: ReadinessRule = {
  ruleId: "no-blocker-label",
  evaluate(context) {
    const configured = new Set(
      context.config.blockerLabels.map((label) => label.trim().toLowerCase()),
    );
    const matches = context.issue.labels.filter((label) =>
      configured.has(label.trim().toLowerCase()),
    );

    return evidence(context, {
      ruleId: this.ruleId,
      category: "BLOCKER",
      status: matches.length > 0 ? "BLOCKED" : "READY",
      outcome:
        matches.length > 0
          ? evidenceOutcome("no-blocker-label/blocked", {
              blockerLabels: [...matches],
            })
          : evidenceOutcome("no-blocker-label/clear", {}),
      sourceField: "labels",
    });
  },
};
