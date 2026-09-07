import type { EvidenceOutcome } from "../../domain/models/evidence-outcome";
import type { TranslationFunction } from "./context";
import { I18N_KEYS, type I18nKey } from "./keys";
import type { SupportedLocale } from "./locale";

export interface LocalizedEvidenceText {
  title: string;
  explanation: string;
  remediation: string;
}

type TemplateParams = Readonly<Record<string, string | number>>;

interface EvidenceTranslationSpec {
  titleKey: I18nKey;
  explanationKey: I18nKey;
  remediationKey: I18nKey;
  params?: TemplateParams;
}

function interpolate(template: string, params: TemplateParams = {}): string {
  return template.replace(
    /\{([A-Za-z][A-Za-z0-9]*)\}/g,
    (placeholder, name: string) => {
      const value = params[name];
      return value === undefined ? placeholder : String(value);
    },
  );
}

function quotedList(
  values: readonly string[],
  locale: SupportedLocale,
): string {
  if (locale === "de-DE") {
    return values.map((value) => `„${value}“`).join(", ");
  }

  return values.map((value) => `“${value}”`).join(", ");
}

function plainList(values: readonly string[]): string {
  return values.join(", ");
}

function translateSpec(
  spec: EvidenceTranslationSpec,
  t: TranslationFunction,
): LocalizedEvidenceText {
  return {
    title: t(spec.titleKey),
    explanation: interpolate(t(spec.explanationKey), spec.params),
    remediation: interpolate(t(spec.remediationKey), spec.params),
  };
}

export function localizeEvidenceOutcome(
  outcome: EvidenceOutcome,
  locale: SupportedLocale,
  t: TranslationFunction,
): LocalizedEvidenceText {
  switch (outcome.outcomeId) {
    case "acceptance-criteria-present/present":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleAcceptanceCriteriaPresent,
          explanationKey:
            I18N_KEYS.evidenceExplanationAcceptanceCriteriaPresent,
          remediationKey: I18N_KEYS.evidenceRemediationNone,
        },
        t,
      );

    case "acceptance-criteria-present/missing":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleAcceptanceCriteriaPresent,
          explanationKey:
            I18N_KEYS.evidenceExplanationAcceptanceCriteriaMissing,
          remediationKey:
            I18N_KEYS.evidenceRemediationAcceptanceCriteriaMissing,
        },
        t,
      );

    case "accepted-status/accepted":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleAcceptedStatus,
          explanationKey: I18N_KEYS.evidenceExplanationAcceptedStatusAccepted,
          remediationKey: I18N_KEYS.evidenceRemediationNone,
          params: {
            statusName: outcome.params.statusName,
          },
        },
        t,
      );

    case "accepted-status/not-accepted":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleAcceptedStatus,
          explanationKey:
            I18N_KEYS.evidenceExplanationAcceptedStatusNotAccepted,
          remediationKey: I18N_KEYS.evidenceRemediationAcceptedStatusIncomplete,
          params: {
            statusName: outcome.params.statusName,
          },
        },
        t,
      );

    case "accepted-status/missing":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleAcceptedStatus,
          explanationKey: I18N_KEYS.evidenceExplanationAcceptedStatusMissing,
          remediationKey: I18N_KEYS.evidenceRemediationAcceptedStatusIncomplete,
        },
        t,
      );

    case "approval-marker-present/disabled":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleApprovalMarkerPresent,
          explanationKey: I18N_KEYS.evidenceExplanationApprovalMarkerDisabled,
          remediationKey: I18N_KEYS.evidenceRemediationNone,
        },
        t,
      );

    case "approval-marker-present/present":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleApprovalMarkerPresent,
          explanationKey: I18N_KEYS.evidenceExplanationApprovalMarkerPresent,
          remediationKey: I18N_KEYS.evidenceRemediationNone,
          params: {
            approvalMarker: outcome.params.approvalMarker,
          },
        },
        t,
      );

    case "approval-marker-present/missing":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleApprovalMarkerPresent,
          explanationKey: I18N_KEYS.evidenceExplanationApprovalMarkerMissing,
          remediationKey: I18N_KEYS.evidenceRemediationApprovalMarkerMissing,
          params: {
            approvalMarker: outcome.params.approvalMarker,
          },
        },
        t,
      );

    case "correct-fix-version/version-only":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleCorrectFixVersion,
          explanationKey:
            I18N_KEYS.evidenceExplanationCorrectFixVersionVersionOnly,
          remediationKey:
            I18N_KEYS.evidenceRemediationCorrectFixVersionVersionOnly,
        },
        t,
      );

    case "correct-fix-version/assigned":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleCorrectFixVersion,
          explanationKey:
            I18N_KEYS.evidenceExplanationCorrectFixVersionAssigned,
          remediationKey: I18N_KEYS.evidenceRemediationNone,
          params: {
            versionName: outcome.params.versionName,
          },
        },
        t,
      );

    case "correct-fix-version/wrong-version":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleCorrectFixVersion,
          explanationKey: I18N_KEYS.evidenceExplanationCorrectFixVersionWrong,
          remediationKey: I18N_KEYS.evidenceRemediationCorrectFixVersionAssign,
          params: {
            assignedVersionNames: quotedList(
              outcome.params.assignedVersionNames,
              locale,
            ),
            expectedVersionName: outcome.params.expectedVersionName,
          },
        },
        t,
      );

    case "correct-fix-version/missing-version":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleCorrectFixVersion,
          explanationKey: I18N_KEYS.evidenceExplanationCorrectFixVersionMissing,
          remediationKey: I18N_KEYS.evidenceRemediationCorrectFixVersionAssign,
          params: {
            expectedVersionName: outcome.params.expectedVersionName,
          },
        },
        t,
      );

    case "no-blocker-label/clear":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleNoBlockerLabel,
          explanationKey: I18N_KEYS.evidenceExplanationNoBlockerLabelClear,
          remediationKey: I18N_KEYS.evidenceRemediationNone,
        },
        t,
      );

    case "no-blocker-label/blocked":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleNoBlockerLabel,
          explanationKey: I18N_KEYS.evidenceExplanationNoBlockerLabelBlocked,
          remediationKey: I18N_KEYS.evidenceRemediationNoBlockerLabelBlocked,
          params: {
            blockerLabels: plainList(outcome.params.blockerLabels),
          },
        },
        t,
      );

    case "no-blocking-links/clear":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleNoBlockingLinks,
          explanationKey: I18N_KEYS.evidenceExplanationNoBlockingLinksClear,
          remediationKey: I18N_KEYS.evidenceRemediationNone,
        },
        t,
      );

    case "no-blocking-links/blocked":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleNoBlockingLinks,
          explanationKey: I18N_KEYS.evidenceExplanationNoBlockingLinksBlocked,
          remediationKey: I18N_KEYS.evidenceRemediationNoBlockingLinksBlocked,
          params: {
            issueKeys: plainList(outcome.params.issueKeys),
          },
        },
        t,
      );

    case "no-open-subtasks/disabled":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleNoOpenSubtasks,
          explanationKey: I18N_KEYS.evidenceExplanationNoOpenSubtasksDisabled,
          remediationKey: I18N_KEYS.evidenceRemediationNone,
        },
        t,
      );

    case "no-open-subtasks/clear":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleNoOpenSubtasks,
          explanationKey: I18N_KEYS.evidenceExplanationNoOpenSubtasksClear,
          remediationKey: I18N_KEYS.evidenceRemediationNone,
        },
        t,
      );

    case "no-open-subtasks/blocked":
      return translateSpec(
        {
          titleKey: I18N_KEYS.evidenceTitleNoOpenSubtasks,
          explanationKey: I18N_KEYS.evidenceExplanationNoOpenSubtasksBlocked,
          remediationKey: I18N_KEYS.evidenceRemediationNoOpenSubtasksBlocked,
          params: {
            count: outcome.params.count,
            issueKeys: plainList(outcome.params.issueKeys),
          },
        },
        t,
      );

    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}
