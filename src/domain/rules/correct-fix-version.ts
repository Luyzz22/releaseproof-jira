import { evidence, type ReadinessRule } from "./types";

export const correctFixVersionRule: ReadinessRule = {
  ruleId: "correct-fix-version",
  evaluate(context) {
    if (context.config.releaseScopeMode === "VERSION_ONLY") {
      return evidence(context, {
        ruleId: this.ruleId,
        category: "RELEASE",
        status: "NOT_APPLICABLE",
        title: "Korrekte Release-Version",
        explanation:
          "Die Versionszuordnung wurde bereits durch den Modus „Nur Jira-Version“ vorgefiltert und kann deshalb nicht unabhängig geprüft werden.",
        remediation:
          "Den Modus „Expliziter JQL-Umfang“ aktivieren, wenn fehlende oder falsche Versionszuordnungen sichtbar werden sollen.",
        sourceField: "releaseScopeMode",
      });
    }

    const assigned = context.issue.fixVersions.some(
      (version) => version.id === context.release.versionId,
    );
    const hasAnyVersion = context.issue.fixVersions.length > 0;
    const assignedVersionNames = context.issue.fixVersions
      .map((version) => `„${version.name}“`)
      .join(", ");
    return evidence(context, {
      ruleId: this.ruleId,
      category: "RELEASE",
      status: assigned ? "READY" : "INCOMPLETE",
      title: "Korrekte Release-Version",
      explanation: assigned
        ? `Der Vorgang ist der Version „${context.release.versionName}“ zugeordnet.`
        : hasAnyVersion
          ? `Der Vorgang ist ${assignedVersionNames} statt der erwarteten Version „${context.release.versionName}“ zugeordnet.`
          : `Am Vorgang ist keine Jira-Version zugeordnet; erwartet wird „${context.release.versionName}“.`,
      remediation: assigned
        ? "Keine Maßnahme erforderlich."
        : "Die analysierte Version im Jira-Feld „Fix Version/s“ zuordnen.",
      sourceField: "fixVersions",
    });
  },
};
