import { useState, type FormEvent } from "react";
import type { BootstrapData } from "../../shared/resolver-contract";
import { Panel } from "../components/panel";
import { useI18n } from "../i18n/context";
import { I18N_KEYS } from "../i18n/keys";
import { releaseScopeModeLabelForLocale } from "../utils/release-scope";

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
  const { t } = useI18n();
  const [versionId, setVersionId] = useState(data.versions[0]?.id ?? "");
  const [validation, setValidation] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!versionId) {
      setValidation(t(I18N_KEYS.releaseSelectionValidationVersionRequired));
      return;
    }
    setValidation(null);
    await onAnalyze(versionId);
  }

  return (
    <div className="selection-layout">
      <Panel className="selection-card">
        <div className="release-mark">RP</div>
        <p className="eyebrow">{t(I18N_KEYS.releaseSelectionEyebrow)}</p>
        <h1>{t(I18N_KEYS.releaseSelectionTitle)}</h1>
        <p className="lead">{t(I18N_KEYS.releaseSelectionDescription)}</p>
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
                {t(I18N_KEYS.releaseSelectionScopeLabel)}:{" "}
                {releaseScopeModeLabelForLocale(
                  data.config.releaseScopeMode,
                  t,
                )}
              </strong>
              <p>
                {data.config.releaseScopeMode === "VERSION_ONLY"
                  ? t(I18N_KEYS.releaseSelectionVersionOnlyWarning)
                  : data.config.releaseScopeJql}
              </p>
            </div>
          ) : null}
          {data.versions.length > 0 ? (
            <label className="field">
              <span>{t(I18N_KEYS.releaseSelectionVersionLabel)}</span>
              <select
                value={versionId}
                onChange={(event) => setVersionId(event.target.value)}
              >
                {data.versions.map((version) => (
                  <option value={version.id} key={version.id}>
                    {version.name}
                    {version.released
                      ? ` · ${t(
                          I18N_KEYS.releaseSelectionVersionReleasedSuffix,
                        )}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="empty-inline">
              <strong>{t(I18N_KEYS.releaseSelectionVersionEmptyTitle)}</strong>
              <span>
                {t(I18N_KEYS.releaseSelectionVersionEmptyDescription)}
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
              ? t(I18N_KEYS.releaseSelectionAnalyzing)
              : t(I18N_KEYS.releaseSelectionAnalyze)}
          </button>
        </form>
        <button type="button" className="text-button" onClick={onConfigure}>
          {data.canConfigure
            ? t(I18N_KEYS.releaseSelectionEditConfiguration)
            : t(I18N_KEYS.releaseSelectionViewConfiguration)}
        </button>
      </Panel>
      <aside className="trust-panel">
        <p className="eyebrow">{t(I18N_KEYS.releaseSelectionTrustEyebrow)}</p>
        <ol>
          <li>
            <span>01</span>
            <div>
              <strong>
                {t(I18N_KEYS.releaseSelectionTrustDeterministicTitle)}
              </strong>
              <p>
                {t(I18N_KEYS.releaseSelectionTrustDeterministicDescription)}
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>{t(I18N_KEYS.releaseSelectionTrustForgeTitle)}</strong>
              <p>{t(I18N_KEYS.releaseSelectionTrustForgeDescription)}</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>
                {t(I18N_KEYS.releaseSelectionTrustRemediationTitle)}
              </strong>
              <p>{t(I18N_KEYS.releaseSelectionTrustRemediationDescription)}</p>
            </div>
          </li>
        </ol>
      </aside>
    </div>
  );
}
