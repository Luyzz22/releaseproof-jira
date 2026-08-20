import { evidence, type ReadinessRule } from "./types";

export const acceptedStatusRule: ReadinessRule = {
  ruleId: "accepted-status",
  evaluate(context) {
    const accepted =
      context.issue.status !== null &&
      context.config.acceptedStatusIds.includes(context.issue.status.id);
    return evidence(context, {
      ruleId: this.ruleId,
      category: "WORKFLOW",
      status: accepted ? "READY" : "INCOMPLETE",
      title: "Abschlussstatus erreicht",
      explanation: accepted
        ? `Der Status „${context.issue.status?.name ?? ""}“ ist als abgeschlossen konfiguriert.`
        : context.issue.status
          ? `Der Status „${context.issue.status.name}“ ist nicht als abgeschlossen konfiguriert.`
          : "Der Jira-Status fehlt oder konnte nicht gelesen werden.",
      remediation: accepted
        ? "Keine Maßnahme erforderlich."
        : "Vorgang fachlich abschließen und in einen akzeptierten Status überführen.",
      sourceField: "status",
    });
  },
};
