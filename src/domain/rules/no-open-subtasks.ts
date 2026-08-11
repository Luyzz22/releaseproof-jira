import { evidence, type ReadinessRule } from "./types";

export const noOpenSubtasksRule: ReadinessRule = {
  ruleId: "no-open-subtasks",
  evaluate(context) {
    if (!context.config.blockOnOpenSubtasks) {
      return evidence(context, {
        ruleId: this.ruleId,
        category: "DEPENDENCY",
        status: "NOT_APPLICABLE",
        title: "Keine offenen Unteraufgaben",
        explanation:
          "Die Prüfung offener Unteraufgaben ist in der Projektkonfiguration deaktiviert.",
        remediation: "Keine Maßnahme erforderlich.",
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
      title: "Keine offenen Unteraufgaben",
      explanation:
        open.length > 0
          ? `${open.length} offene Unteraufgabe(n): ${open.map((item) => item.key).join(", ")}.`
          : "Es wurden keine offenen Unteraufgaben gefunden.",
      remediation:
        open.length > 0
          ? "Offene Unteraufgaben abschließen oder begründet aus dem Release-Umfang entfernen."
          : "Keine Maßnahme erforderlich.",
      sourceField: "subtasks",
    });
  },
};
