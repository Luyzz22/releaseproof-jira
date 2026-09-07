import { evidenceOutcome } from "../models/evidence-outcome";
import { evidence, type ReadinessRule } from "./types";

export const acceptanceCriteriaPresentRule: ReadinessRule = {
  ruleId: "acceptance-criteria-present",
  evaluate(context) {
    const present = context.issue.hasAcceptanceCriteria;
    return evidence(context, {
      ruleId: this.ruleId,
      category: "DOCUMENTATION",
      status: present ? "READY" : "INCOMPLETE",
      outcome: present
        ? evidenceOutcome("acceptance-criteria-present/present", {})
        : evidenceOutcome("acceptance-criteria-present/missing", {}),
      sourceField: context.config.acceptanceCriteriaFieldId,
    });
  },
};
