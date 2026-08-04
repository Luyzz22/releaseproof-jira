import { evidence, type ReadinessRule } from "./types";

export const approvalMarkerPresentRule: ReadinessRule = {
  ruleId: "approval-marker-present",
  evaluate(context) {
    if (!context.config.requireApprovalMarker) {
      return evidence(context, {
        ruleId: this.ruleId,
        category: "APPROVAL",
        status: "NOT_APPLICABLE",
        title: "Freigabemarkierung vorhanden",
        explanation:
          "Die Freigabemarkierung ist in der Projektkonfiguration deaktiviert.",
        remediation: "Keine Maßnahme erforderlich.",
        sourceField: "labels",
      });
    }

    const marker = context.config.approvalMarker
      .trim()
      .toLocaleLowerCase("de-DE");
    const present =
      marker.length > 0 &&
      context.issue.labels.some(
        (label) => label.trim().toLocaleLowerCase("de-DE") === marker,
      );
    return evidence(context, {
      ruleId: this.ruleId,
      category: "APPROVAL",
      status: present ? "READY" : "INCOMPLETE",
      title: "Freigabemarkierung vorhanden",
      explanation: present
        ? `Das Freigabe-Label „${context.config.approvalMarker}“ ist vorhanden.`
        : `Das Freigabe-Label „${context.config.approvalMarker}“ fehlt.`,
      remediation: present
        ? "Keine Maßnahme erforderlich."
        : "Fachliche Freigabe einholen und anschließend das konfigurierte Label setzen.",
      sourceField: "labels",
    });
  },
};
