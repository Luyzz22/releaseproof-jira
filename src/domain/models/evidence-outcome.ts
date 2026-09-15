export const EVIDENCE_RULE_IDS = [
  "acceptance-criteria-present",
  "accepted-status",
  "approval-marker-present",
  "correct-fix-version",
  "no-blocker-label",
  "no-blocking-links",
  "no-open-subtasks",
] as const;

export type EvidenceRuleId = (typeof EVIDENCE_RULE_IDS)[number];

export const EVIDENCE_OUTCOME_IDS = [
  "acceptance-criteria-present/present",
  "acceptance-criteria-present/missing",

  "accepted-status/accepted",
  "accepted-status/not-accepted",
  "accepted-status/missing",

  "approval-marker-present/disabled",
  "approval-marker-present/present",
  "approval-marker-present/missing",

  "correct-fix-version/version-only",
  "correct-fix-version/assigned",
  "correct-fix-version/wrong-version",
  "correct-fix-version/missing-version",

  "no-blocker-label/clear",
  "no-blocker-label/blocked",

  "no-blocking-links/clear",
  "no-blocking-links/blocked",

  "no-open-subtasks/disabled",
  "no-open-subtasks/clear",
  "no-open-subtasks/blocked",
] as const;

export type EvidenceOutcomeId = (typeof EVIDENCE_OUTCOME_IDS)[number];

type NoEvidenceOutcomeParams = Readonly<Record<string, never>>;

export interface EvidenceOutcomeParamsById {
  "acceptance-criteria-present/present": NoEvidenceOutcomeParams;
  "acceptance-criteria-present/missing": NoEvidenceOutcomeParams;

  "accepted-status/accepted": Readonly<{
    statusName: string;
  }>;
  "accepted-status/not-accepted": Readonly<{
    statusName: string;
  }>;
  "accepted-status/missing": NoEvidenceOutcomeParams;

  "approval-marker-present/disabled": NoEvidenceOutcomeParams;
  "approval-marker-present/present": Readonly<{
    approvalMarker: string;
  }>;
  "approval-marker-present/missing": Readonly<{
    approvalMarker: string;
  }>;

  "correct-fix-version/version-only": NoEvidenceOutcomeParams;
  "correct-fix-version/assigned": Readonly<{
    versionName: string;
  }>;
  "correct-fix-version/wrong-version": Readonly<{
    assignedVersionNames: readonly string[];
    expectedVersionName: string;
  }>;
  "correct-fix-version/missing-version": Readonly<{
    expectedVersionName: string;
  }>;

  "no-blocker-label/clear": NoEvidenceOutcomeParams;
  "no-blocker-label/blocked": Readonly<{
    blockerLabels: readonly string[];
  }>;

  "no-blocking-links/clear": NoEvidenceOutcomeParams;
  "no-blocking-links/blocked": Readonly<{
    issueKeys: readonly string[];
  }>;

  "no-open-subtasks/disabled": NoEvidenceOutcomeParams;
  "no-open-subtasks/clear": NoEvidenceOutcomeParams;
  "no-open-subtasks/blocked": Readonly<{
    count: number;
    issueKeys: readonly string[];
  }>;
}

export type EvidenceOutcomeFor<TOutcomeId extends EvidenceOutcomeId> =
  Readonly<{
    outcomeId: TOutcomeId;
    params: EvidenceOutcomeParamsById[TOutcomeId];
  }>;

export type EvidenceOutcome = {
  [TOutcomeId in EvidenceOutcomeId]: EvidenceOutcomeFor<TOutcomeId>;
}[EvidenceOutcomeId];

export function evidenceOutcome<TOutcomeId extends EvidenceOutcomeId>(
  outcomeId: TOutcomeId,
  params: EvidenceOutcomeParamsById[TOutcomeId],
): EvidenceOutcomeFor<TOutcomeId> {
  return {
    outcomeId,
    params,
  };
}
