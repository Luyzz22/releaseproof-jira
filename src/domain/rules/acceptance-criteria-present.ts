import { evidence, type ReadinessRule } from "./types";

export const acceptanceCriteriaPresentRule: ReadinessRule = {
  ruleId: "acceptance-criteria-present",
  evaluate(context) {
    const present = Boolean(context.issue.acceptanceCriteria?.trim());
    return evidence(context, {
      ruleId: this.ruleId,
      category: "DOCUMENTATION",
      status: present ? "READY" : "INCOMPLETE",
      title: "Akzeptanzkriterien vorhanden",
      explanation: present
        ? "Das konfigurierte Feld enthält Akzeptanzkriterien."
        : "Im konfigurierten Feld wurden keine verwertbaren Akzeptanzkriterien gefunden.",
      remediation: present
        ? "Keine Maßnahme erforderlich."
        : "Konkrete und prüfbare Akzeptanzkriterien im konfigurierten Jira-Feld ergänzen.",
      sourceField: context.config.acceptanceCriteriaFieldId,
    });
  },
};
