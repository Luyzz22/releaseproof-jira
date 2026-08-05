import { useMemo, useState, type FormEvent } from "react";
import type { ReleaseScopeMode } from "../../domain/models/readiness";
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
  const fieldOptions = useMemo(
    () =>
      data.fields.filter((field) => field.custom || field.id === "description"),
    [data.fields],
  );
  const [acceptedStatusIds, setAcceptedStatusIds] = useState<string[]>(
    existing?.acceptedStatusIds ?? [],
  );
  const [includedIssueTypes, setIncludedIssueTypes] = useState<string[]>(
    existing?.includedIssueTypes ?? data.issueTypes.map((type) => type.id),
  );
  const [releaseScopeMode, setReleaseScopeMode] = useState<ReleaseScopeMode>(
    existing?.releaseScopeMode ?? "VERSION_ONLY",
  );
  const [releaseScopeJql, setReleaseScopeJql] = useState(
    existing?.releaseScopeJql ?? "",
  );
  const [acceptanceCriteriaFieldId, setAcceptanceCriteriaFieldId] = useState(
    existing?.acceptanceCriteriaFieldId ?? fieldOptions[0]?.id ?? "",
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
        <h1>Readiness-Kriterien für {data.project.key}</h1>
        <p className="lead">
          Legen Sie einmal fest, welche Jira-Nachweise für eine Kundenabnahme
          erforderlich sind.
        </p>
      </div>
      <form onSubmit={(event) => void submit(event)} className="form-stack">
        <Panel>
          <div className="section-heading">
            <span className="step">01</span>
            <div>
              <h2>Workflow und Scope</h2>
              <p>
                Welche Vorgänge gelten als abgeschlossen und werden ausgewertet?
              </p>
            </div>
          </div>
          <fieldset>
            <legend>Release-Scope</legend>
            <div className="scope-mode-grid">
              <label className="choice choice--stack">
                <span>
                  <input
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
                    type="radio"
                    name="release-scope-mode"
                    value="JQL_SCOPE"
                    checked={releaseScopeMode === "JQL_SCOPE"}
                    onChange={() => setReleaseScopeMode("JQL_SCOPE")}
                  />
                  <strong>Expliziter JQL-Scope</strong>
                </span>
                <small>
                  Trennt fachlichen Scope und erwartete Jira-Version.
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
              <span>Projektgebundener Scope-JQL</span>
              <textarea
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
            <legend>Relevante Issue-Typen</legend>
            <div className="choice-grid">
              {data.issueTypes.map((type) => (
                <label className="choice" key={type.id}>
                  <input
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
              <h2>Nachweise und Blocker</h2>
              <p>ReleaseProof liest nur die hier benötigten Felder.</p>
            </div>
          </div>
          <label className="field">
            <span>Feld für Akzeptanzkriterien</span>
            <select
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
          <label className="field">
            <span>
              Blocker-Labels <small>durch Komma getrennt</small>
            </span>
            <input
              value={blockerLabels}
              onChange={(event) => setBlockerLabels(event.target.value)}
              placeholder="release-blocker, security-blocker"
            />
          </label>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={blockOnOpenSubtasks}
              onChange={(event) => setBlockOnOpenSubtasks(event.target.checked)}
            />
            <span>
              <strong>Offene Unteraufgaben blockieren</strong>
              <small>
                {`Ungelöste Subtasks setzen den Vorgang auf „${readinessStatusLabel("BLOCKED")}“.`}
              </small>
            </span>
          </label>
          <label className="switch-row">
            <input
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
          <button className="button" type="submit" disabled={saving}>
            {saving ? "Wird gespeichert …" : "Konfiguration speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
