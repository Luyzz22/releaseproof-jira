import { evidenceOutcome } from "../models/evidence-outcome";
import { evidence, type ReadinessRule } from "./types";

export const correctFixVersionRule: ReadinessRule = {
  ruleId: "correct-fix-version",
  evaluate(context) {
    if (context.config.releaseScopeMode === "VERSION_ONLY") {
      return evidence(context, {
        ruleId: this.ruleId,
        category: "RELEASE",
        status: "NOT_APPLICABLE",
        outcome: evidenceOutcome("correct-fix-version/version-only", {}),
        sourceField: "releaseScopeMode",
      });
    }

    const assigned = context.issue.fixVersions.some(
      (version) => version.id === context.release.versionId,
    );
    const hasAnyVersion = context.issue.fixVersions.length > 0;
    const assignedVersionNames = context.issue.fixVersions.map(
      (version) => version.name,
    );

    const outcome = assigned
      ? evidenceOutcome("correct-fix-version/assigned", {
          versionName: context.release.versionName,
        })
      : hasAnyVersion
        ? evidenceOutcome("correct-fix-version/wrong-version", {
            assignedVersionNames: [...assignedVersionNames],
            expectedVersionName: context.release.versionName,
          })
        : evidenceOutcome("correct-fix-version/missing-version", {
            expectedVersionName: context.release.versionName,
          });

    return evidence(context, {
      ruleId: this.ruleId,
      category: "RELEASE",
      status: assigned ? "READY" : "INCOMPLETE",
      outcome,
      sourceField: "fixVersions",
    });
  },
};
