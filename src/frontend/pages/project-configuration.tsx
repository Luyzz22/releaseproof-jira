import { useMemo, useState, type FormEvent } from "react";
import type { ReleaseScopeMode } from "../../domain/models/readiness";
import {
  hasSupportedAcceptanceCriteriaField,
  isSupportedAcceptanceCriteriaField,
} from "../../shared/acceptance-criteria-field";
import type { BootstrapData } from "../../shared/resolver-contract";
import {
  projectConfigInputSchema,
  RELEASE_SCOPE_JQL_MAX_LENGTH,
  type ProjectConfigInput,
} from "../../shared/validation";
import { Panel } from "../components/panel";
import { readinessStatusLabel } from "../utils/readiness-status";

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
        "Bitte wählen Sie ein unterstütztes Textfeld für Akzeptanzkriterien aus.",
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
    const parsed = projectConfigInputSchema.safeParse(input);
    if (!parsed.success) {
      setValidation(
        parsed.error.issues[0]?.message ??
          "Bitte prüfen Sie die Projektkonfiguration.",
      );
      return;
    }
    setValidation(null);
    await onSave(parsed.data);
  }

  return (
    <div className="content-grid content-grid--form">
      <div>
        <p className="eyebrow">Projektkonfiguration</p>
        <h1>Bereitschaftskriterien für {data.project.key}</h1>
        <p className="lead">
          Legen Sie einmal fest, welche Jira-Nachweise für eine Kundenabnahme
          erforderlich sind.
        </p>
        {!data.canConfigure ? (
          <div className="scope-notice scope-notice--warning" role="status">
            <strong>Nur Jira-Projektadministratoren können diese Konfiguration ändern.</strong>
            <p>
              Sie können die aktuell gespeicherten Kriterien ansehen und
              Release-Analysen ausführen. Änderungen müssen von einem
              Projektadministrator gespeichert werden.
            </p>
          </div>
        ) : null}
      </div>
      <form onSubmit={(event) => void submit(event)} className="form-stack">
        <Panel>
          <div className="section-heading">
            <span className="step">01</span>
            <div>
              <h2>Arbeitsablauf und Umfang</h2>
              <p>
                Welche Vorgänge gelten als abgeschlossen und werden ausgewertet?
              </p>
            </div>
          </div>
          <fieldset>
            <legend>Release-Umfang</legend>
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
                  <strong>Nur Jira-Version</strong>
                </span>
                <small>
                  Rückwärtskompatibel: lädt ausschließlich Vorgänge der
                  ausgewählten fixVersion.
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
                  <strong>Expliziter JQL-Umfang</strong>
                </span>
                <small>
                  Trennt fachlichen Umfang und erwartete Jira-Version.
                </small>
              </label>
            </div>
          </fieldset>
          {releaseScopeMode === "VERSION_ONLY" ? (
            <div className="scope-notice scope-notice--warning" role="status">
              <strong>
                Versionslücken bleiben in diesem Modus unsichtbar.
              </strong>
              <p>
                Vorgänge ohne oder mit anderer fixVersion werden bereits vor der
                Prüfung ausgeschlossen. Die Versionsregel wird deshalb ehrlich
                als nicht anwendbar ausgewiesen.
              </p>
            </div>
          ) : (
            <label className="field">
              <span>Projektgebundene JQL-Abfrage</span>
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
                Muss mit project = {data.project.key} beginnen; fixVersion und
                OR sind nicht zulässig. {releaseScopeJql.length}/
                {RELEASE_SCOPE_JQL_MAX_LENGTH} Zeichen.
              </small>
            </label>
          )}
          <fieldset>
            <legend>Abgeschlossene Status</legend>
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
            <legend>Relevante Vorgangstypen</legend>
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
              <h2>Nachweise und Blockierungen</h2>
              <p>ReleaseProof liest nur die hier benötigten Felder.</p>
            </div>
          </div>
          <label className="field">
            <span>Feld für Akzeptanzkriterien</span>
            <select
              disabled={editingDisabled}
              value={acceptanceCriteriaFieldId}
              onChange={(event) =>
                setAcceptanceCriteriaFieldId(event.target.value)
              }
            >
              <option value="">Feld auswählen</option>
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
                Das bisher konfigurierte Feld für Akzeptanzkriterien wird nicht
                unterstützt.
              </strong>
              <p>
                Bitte wählen Sie ein unterstütztes Textfeld aus und speichern
                Sie die Projektkonfiguration erneut.
              </p>
            </div>
          ) : null}
          <label className="field">
            <span>
              Blockierungs-Labels <small>durch Komma getrennt</small>
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
              <strong>Offene Unteraufgaben blockieren</strong>
              <small>
                {`Ungelöste Unteraufgaben setzen den Vorgang auf „${readinessStatusLabel("BLOCKED")}“.`}
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
              <strong>Freigabemarkierung verlangen</strong>
              <small>
                Ein Jira-Label dient als expliziter Freigabenachweis.
              </small>
            </span>
          </label>
          {requireApprovalMarker ? (
            <label className="field field--nested">
              <span>Freigabe-Label</span>
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
          <span>
            Konfiguration wird projektbezogen in Forge KVS gespeichert.
          </span>
          {data.canConfigure ? (
            <button className="button" type="submit" disabled={saving}>
              {saving ? "Wird gespeichert …" : "Konfiguration speichern"}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
