import { evidenceOutcome } from "../models/evidence-outcome";
import { evidence, type ReadinessRule } from "./types";

export const noBlockingLinksRule: ReadinessRule = {
  ruleId: "no-blocking-links",
  evaluate(context) {
    const unresolved = context.issue.linkedIssues.filter(
      (link) =>
        link.isBlocking &&
        link.resolution === null &&
        (link.status === null ||
          !context.config.acceptedStatusIds.includes(link.status.id)),
    );

    return evidence(context, {
      ruleId: this.ruleId,
      category: "DEPENDENCY",
      status: unresolved.length > 0 ? "BLOCKED" : "READY",
      outcome:
        unresolved.length > 0
          ? evidenceOutcome("no-blocking-links/blocked", {
              issueKeys: unresolved.map((item) => item.key),
            })
          : evidenceOutcome("no-blocking-links/clear", {}),
      sourceField: "issuelinks",
    });
  },
};
