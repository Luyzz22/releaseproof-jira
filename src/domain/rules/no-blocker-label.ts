import { evidence, type ReadinessRule } from "./types";

export const noBlockerLabelRule: ReadinessRule = {
  ruleId: "no-blocker-label",
  evaluate(context) {
    const configured = new Set(
      context.config.blockerLabels.map((label) =>
        label.trim().toLocaleLowerCase("de-DE"),
      ),
    );
    const matches = context.issue.labels.filter((label) =>
      configured.has(label.trim().toLocaleLowerCase("de-DE")),
    );
    return evidence(context, {
      ruleId: this.ruleId,
      category: "BLOCKER",
      status: matches.length > 0 ? "BLOCKED" : "READY",
      title: "Kein Blocker-Label",
      explanation:
        matches.length > 0
          ? `Blockierendes Label vorhanden: ${matches.join(", ")}.`
          : "Es wurde kein konfiguriertes Blocker-Label gefunden.",
      remediation:
        matches.length > 0
          ? "Blocker fachlich auflösen und das Label anschließend entfernen."
          : "Keine Maßnahme erforderlich.",
      sourceField: "labels",
    });
  },
};
