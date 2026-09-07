import { useMemo, useState, type FormEvent } from "react";
import type { ReleaseScopeMode } from "../../domain/models/readiness";
import {
  hasSupportedAcceptanceCriteriaField,
  isSupportedAcceptanceCriteriaField,
} from "../../shared/acceptance-criteria-field";
import type { BootstrapData } from "../../shared/resolver-contract";
import {
  RELEASE_SCOPE_JQL_MAX_LENGTH,
  validateProjectConfigInput,
  type ProjectConfigInput,
} from "../../shared/validation";
import { Panel } from "../components/panel";
import { useI18n } from "../i18n/context";
import { I18N_KEYS } from "../i18n/keys";
import { localizeProjectConfigValidationFailure } from "../i18n/project-config-validation";

function toggle(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function filterAvailableMetadataIds(
  selectedIds: readonly string[],
  availableItems: ReadonlyArray<{ id: string }>,
): string[] {
  const availableIds = new Set(availableItems.map((item) => item.id));
  return selectedIds.filter((id) => availableIds.has(id));
}

export function ProjectConfiguration({
  data,
  saving,
  onSave,
}: {
  data: BootstrapData;
  saving: boolean;
  onSave: (input: ProjectConfigInput) => Promise<void>;
}) {
  const { t } = useI18n();
  const existing = data.config;
  const editingDisabled = !data.canConfigure || saving;
  const fieldOptions = useMemo(
    () => data.fields.filter(isSupportedAcceptanceCriteriaField),
    [data.fields],
  );
  const existingAcceptanceCriteriaFieldIsSupported =
    existing !== null &&
    hasSupportedAcceptanceCriteriaField(
      data.fields,
      existing.acceptanceCriteriaFieldId,
    );
  const acceptanceCriteriaFieldRecoveryRequired =
    existing !== null && !existingAcceptanceCriteriaFieldIsSupported;
  const [acceptedStatusIds, setAcceptedStatusIds] = useState<string[]>(
    filterAvailableMetadataIds(
      existing?.acceptedStatusIds ?? [],
      data.statuses,
    ),
  );
  const [includedIssueTypes, setIncludedIssueTypes] = useState<string[]>(
    existing
      ? filterAvailableMetadataIds(existing.includedIssueTypes, data.issueTypes)
      : data.issueTypes.map((type) => type.id),
  );
  const [releaseScopeMode, setReleaseScopeMode] = useState<ReleaseScopeMode>(
    existing?.releaseScopeMode ?? "VERSION_ONLY",
  );
  const [releaseScopeJql, setReleaseScopeJql] = useState(
    existing?.releaseScopeJql ?? "",
  );
  const [acceptanceCriteriaFieldId, setAcceptanceCriteriaFieldId] = useState(
    existing
      ? existingAcceptanceCriteriaFieldIsSupported
        ? existing.acceptanceCriteriaFieldId
        : ""
      : (fieldOptions[0]?.id ?? ""),
  );
  const [blockerLabels, setBlockerLabels] = useState(
    existing?.blockerLabels.join(", ") ?? "release-blocker",
  );
  const [blockOnOpenSubtasks, setBlockOnOpenSubtasks] = useState(
    existing?.blockOnOpenSubtasks ?? true,
  );
  const [requireApprovalMarker, setRequireApprovalMarker] = useState(
    existing?.requireApprovalMarker ?? false,
  );
  const [approvalMarker, setApprovalMarker] = useState(
    existing?.approvalMarker ?? "customer-approved",
  );
  const [validation, setValidation] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.canConfigure) return;
    if (
      !hasSupportedAcceptanceCriteriaField(
        data.fields,
        acceptanceCriteriaFieldId,
      )
    ) {
      setValidation(
        t(I18N_KEYS.projectConfigurationValidationUnsupportedField),
      );
      return;
    }
    const input = {
      projectId: data.project.id,
      projectKey: data.project.key,
      releaseScopeMode,
      ...(releaseScopeMode === "JQL_SCOPE" ? { releaseScopeJql } : {}),
      acceptedStatusIds,
      acceptanceCriteriaFieldId,
      blockerLabels: blockerLabels
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean),
      includedIssueTypes,
      requireApprovalMarker,
      approvalMarker,
      blockOnOpenSubtasks,
    };
    const validated = validateProjectConfigInput(input);
    if (!validated.valid) {
      setValidation(
        localizeProjectConfigValidationFailure(validated.failure, t),
      );
      return;
    }
    setValidation(null);
    await onSave(validated.data);
  }

  return (
    <div className="content-grid content-grid--form">
      <div>
        <p className="eyebrow">{t(I18N_KEYS.projectConfigurationEyebrow)}</p>
        <h1>
          {t(I18N_KEYS.projectConfigurationTitleLead)} {data.project.key}
        </h1>
        <p className="lead">{t(I18N_KEYS.projectConfigurationDescription)}</p>
        {!data.canConfigure ? (
          <div className="scope-notice scope-notice--warning" role="status">
            <strong>{t(I18N_KEYS.projectConfigurationReadOnlyTitle)}</strong>
            <p>{t(I18N_KEYS.projectConfigurationReadOnlyDescription)}</p>
          </div>
        ) : null}
      </div>
      <form onSubmit={(event) => void submit(event)} className="form-stack">
        <Panel>
          <div className="section-heading">
            <span className="step">01</span>
            <div>
              <h2>{t(I18N_KEYS.projectConfigurationWorkflowScopeHeading)}</h2>
              <p>{t(I18N_KEYS.projectConfigurationWorkflowScopeDescription)}</p>
            </div>
          </div>
          <fieldset>
            <legend>
              {t(I18N_KEYS.projectConfigurationReleaseScopeLegend)}
            </legend>
            <div className="scope-mode-grid">
              <label className="choice choice--stack">
                <span>
                  <input
                    disabled={editingDisabled}
                    type="radio"
                    name="release-scope-mode"
                    value="VERSION_ONLY"
                    checked={releaseScopeMode === "VERSION_ONLY"}
                    onChange={() => setReleaseScopeMode("VERSION_ONLY")}
                  />
                  <strong>{t(I18N_KEYS.releaseScopeModeVersionOnly)}</strong>
                </span>
                <small>
                  {t(I18N_KEYS.projectConfigurationVersionOnlyDescription)}
                </small>
              </label>
              <label className="choice choice--stack">
                <span>
                  <input
                    disabled={editingDisabled}
                    type="radio"
                    name="release-scope-mode"
                    value="JQL_SCOPE"
                    checked={releaseScopeMode === "JQL_SCOPE"}
                    onChange={() => setReleaseScopeMode("JQL_SCOPE")}
                  />
                  <strong>{t(I18N_KEYS.releaseScopeModeJqlScope)}</strong>
                </span>
                <small>
                  {t(I18N_KEYS.projectConfigurationJqlScopeDescription)}
                </small>
              </label>
            </div>
          </fieldset>
          {releaseScopeMode === "VERSION_ONLY" ? (
            <div className="scope-notice scope-notice--warning" role="status">
              <strong>
                {t(I18N_KEYS.projectConfigurationVersionOnlyWarningTitle)}
              </strong>
              <p>
                {t(I18N_KEYS.projectConfigurationVersionOnlyWarningDescription)}
              </p>
            </div>
          ) : (
            <label className="field">
              <span>{t(I18N_KEYS.projectConfigurationJqlLabel)}</span>
              <textarea
                disabled={editingDisabled}
                value={releaseScopeJql}
                onChange={(event) => setReleaseScopeJql(event.target.value)}
                maxLength={RELEASE_SCOPE_JQL_MAX_LENGTH}
                rows={4}
                aria-describedby="release-scope-jql-help"
                placeholder={`project = ${data.project.key} AND key in (${data.project.key}-1, ${data.project.key}-2)`}
              />
              <small id="release-scope-jql-help">
                {t(I18N_KEYS.projectConfigurationJqlHelpPrefix)}{" "}
                {data.project.key}{" "}
                {t(I18N_KEYS.projectConfigurationJqlHelpSuffix)}{" "}
                {releaseScopeJql.length}/{RELEASE_SCOPE_JQL_MAX_LENGTH}{" "}
                {t(I18N_KEYS.projectConfigurationCharactersLabel)}
              </small>
            </label>
          )}
          <fieldset>
            <legend>
              {t(I18N_KEYS.projectConfigurationAcceptedStatusesLegend)}
            </legend>
            <div className="choice-grid">
              {data.statuses.map((status) => (
                <label className="choice" key={status.id}>
                  <input
                    disabled={editingDisabled}
                    type="checkbox"
                    checked={acceptedStatusIds.includes(status.id)}
                    onChange={() =>
                      setAcceptedStatusIds(toggle(acceptedStatusIds, status.id))
                    }
                  />
                  <span>{status.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>
              {t(I18N_KEYS.projectConfigurationRelevantIssueTypesLegend)}
            </legend>
            <div className="choice-grid">
              {data.issueTypes.map((type) => (
                <label className="choice" key={type.id}>
                  <input
                    disabled={editingDisabled}
                    type="checkbox"
                    checked={includedIssueTypes.includes(type.id)}
                    onChange={() =>
                      setIncludedIssueTypes(toggle(includedIssueTypes, type.id))
                    }
                  />
                  <span>{type.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </Panel>
        <Panel>
          <div className="section-heading">
            <span className="step">02</span>
            <div>
              <h2>
                {t(I18N_KEYS.projectConfigurationEvidenceBlockersHeading)}
              </h2>
              <p>
                {t(I18N_KEYS.projectConfigurationEvidenceBlockersDescription)}
              </p>
            </div>
          </div>
          <label className="field">
            <span>
              {t(I18N_KEYS.projectConfigurationAcceptanceCriteriaFieldLabel)}
            </span>
            <select
              disabled={editingDisabled}
              value={acceptanceCriteriaFieldId}
              onChange={(event) =>
                setAcceptanceCriteriaFieldId(event.target.value)
              }
            >
              <option value="">
                {t(
                  I18N_KEYS.projectConfigurationAcceptanceCriteriaFieldPlaceholder,
                )}
              </option>
              {fieldOptions.map((field) => (
                <option value={field.id} key={field.id}>
                  {field.name}
                </option>
              ))}
            </select>
          </label>
          {acceptanceCriteriaFieldRecoveryRequired ? (
            <div className="scope-notice scope-notice--warning" role="alert">
              <strong>
                {t(
                  I18N_KEYS.projectConfigurationAcceptanceCriteriaRecoveryTitle,
                )}
              </strong>
              <p>
                {t(
                  I18N_KEYS.projectConfigurationAcceptanceCriteriaRecoveryDescription,
                )}
              </p>
            </div>
          ) : null}
          <label className="field">
            <span>
              {t(I18N_KEYS.projectConfigurationBlockingLabelsLabel)}{" "}
              <small>{t(I18N_KEYS.projectConfigurationCommaSeparated)}</small>
            </span>
            <input
              disabled={editingDisabled}
              value={blockerLabels}
              onChange={(event) => setBlockerLabels(event.target.value)}
              placeholder="release-blocker, security-blocker"
            />
          </label>
          <label className="switch-row">
            <input
              disabled={editingDisabled}
              type="checkbox"
              checked={blockOnOpenSubtasks}
              onChange={(event) => setBlockOnOpenSubtasks(event.target.checked)}
            />
            <span>
              <strong>
                {t(I18N_KEYS.projectConfigurationBlockOpenSubtasksLabel)}
              </strong>
              <small>
                {t(I18N_KEYS.configurationOpenSubtasksBlockedExplanation)}
              </small>
            </span>
          </label>
          <label className="switch-row">
            <input
              disabled={editingDisabled}
              type="checkbox"
              checked={requireApprovalMarker}
              onChange={(event) =>
                setRequireApprovalMarker(event.target.checked)
              }
            />
            <span>
              <strong>
                {t(I18N_KEYS.projectConfigurationRequireApprovalMarkerLabel)}
              </strong>
              <small>
                {t(
                  I18N_KEYS.projectConfigurationRequireApprovalMarkerDescription,
                )}
              </small>
            </span>
          </label>
          {requireApprovalMarker ? (
            <label className="field field--nested">
              <span>{t(I18N_KEYS.projectConfigurationApprovalLabel)}</span>
              <input
                disabled={editingDisabled}
                value={approvalMarker}
                onChange={(event) => setApprovalMarker(event.target.value)}
                placeholder="customer-approved"
              />
            </label>
          ) : null}
        </Panel>
        {validation ? (
          <p className="form-error" role="alert">
            {validation}
          </p>
        ) : null}
        <div className="form-actions">
          <span>{t(I18N_KEYS.projectConfigurationStorageDescription)}</span>
          {data.canConfigure ? (
            <button className="button" type="submit" disabled={saving}>
              {saving
                ? t(I18N_KEYS.projectConfigurationSaving)
                : t(I18N_KEYS.projectConfigurationSave)}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
