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
      title: "Keine ungelösten Blocker-Verknüpfungen",
      explanation:
        unresolved.length > 0
          ? `Ungelöste blockierende Verknüpfung(en): ${unresolved.map((item) => item.key).join(", ")}.`
          : "Es wurden keine ungelösten blockierenden Verknüpfungen gefunden.",
      remediation:
        unresolved.length > 0
          ? "Verknüpfte Blocker lösen oder die Jira-Verknüpfung fachlich korrigieren."
          : "Keine Maßnahme erforderlich.",
      sourceField: "issuelinks",
    });
  },
};
