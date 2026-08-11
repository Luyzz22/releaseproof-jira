import { useState, type FormEvent } from "react";
import type { BootstrapData } from "../../shared/resolver-contract";
import { Panel } from "../components/panel";
import { releaseScopeModeLabel } from "../utils/release-scope";

export function ReleaseSelection({
  data,
  analyzing,
  onAnalyze,
  onConfigure,
}: {
  data: BootstrapData;
  analyzing: boolean;
  onAnalyze: (versionId: string) => Promise<void>;
  onConfigure: () => void;
}) {
  const [versionId, setVersionId] = useState(data.versions[0]?.id ?? "");
  const [validation, setValidation] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!versionId) {
      setValidation("Bitte wählen Sie eine Jira-Version.");
      return;
    }
    setValidation(null);
    await onAnalyze(versionId);
  }

  return (
    <div className="selection-layout">
      <Panel className="selection-card">
        <div className="release-mark">RP</div>
        <p className="eyebrow">Neue Analyse</p>
        <h1>Ist das Release bereit für die Kundenabnahme?</h1>
        <p className="lead">
          ReleaseProof prüft Dokumentation, Abschlussstatus, Unteraufgaben,
          Abhängigkeiten, Labels und Freigaben – ohne Jira-Inhalte zu speichern.
        </p>
        <form onSubmit={(event) => void submit(event)} className="form-stack">
          <div className="project-chip">
            <span>{data.project.key}</span>
            <strong>{data.project.name}</strong>
          </div>
          {data.config ? (
            <div
              className={`scope-notice ${
                data.config.releaseScopeMode === "VERSION_ONLY"
                  ? "scope-notice--warning"
                  : ""
              }`}
            >
              <strong>
                Umfang: {releaseScopeModeLabel(data.config.releaseScopeMode)}
              </strong>
              <p>
                {data.config.releaseScopeMode === "VERSION_ONLY"
                  ? "Fehlende Versionszuordnungen können mit diesem Umfang nicht erkannt werden."
                  : data.config.releaseScopeJql}
              </p>
            </div>
          ) : null}
          {data.versions.length > 0 ? (
            <label className="field">
              <span>Jira-Version</span>
              <select
                value={versionId}
                onChange={(event) => setVersionId(event.target.value)}
              >
                {data.versions.map((version) => (
                  <option value={version.id} key={version.id}>
                    {version.name}
                    {version.released ? " · veröffentlicht" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="empty-inline">
              <strong>Keine Version verfügbar</strong>
              <span>
                Legen Sie im Jira-Projekt zuerst eine Version an oder prüfen Sie
                Ihre Berechtigung.
              </span>
            </div>
          )}
          {validation ? (
            <p className="form-error" role="alert">
              {validation}
            </p>
          ) : null}
          <button
            className="button button--wide"
            type="submit"
            disabled={analyzing || data.versions.length === 0}
          >
            {analyzing
              ? "Release wird analysiert …"
              : "Bereitschaft analysieren"}
          </button>
        </form>
        <button type="button" className="text-button" onClick={onConfigure}>
          Projektkonfiguration bearbeiten
        </button>
      </Panel>
      <aside className="trust-panel">
        <p className="eyebrow">Prüfumfang</p>
        <ol>
          <li>
            <span>01</span>
            <div>
              <strong>Deterministische Regeln</strong>
              <p>
                Jedes Ergebnis ist auf eine konkrete Regel und Jira-Quelle
                zurückführbar.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Keine externe Übertragung</strong>
              <p>Verarbeitung und Konfiguration bleiben in Atlassian Forge.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Konkrete Behebung</strong>
              <p>
                Fehlende Nachweise werden mit einer umsetzbaren Maßnahme
                markiert.
              </p>
            </div>
          </li>
        </ol>
      </aside>
    </div>
  );
}
