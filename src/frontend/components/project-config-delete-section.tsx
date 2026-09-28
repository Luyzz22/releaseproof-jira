import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/context";
import { I18N_KEYS } from "../i18n/keys";
import {
  isDeletionConfirmed,
  type DeletionConfirmationAction,
  type DeletionConfirmationState,
} from "../project-config-deletion";
import { Panel } from "./panel";

export function ProjectConfigDeleteSection({
  projectKey,
  state,
  busy,
  onAction,
  onConfirm,
}: {
  projectKey: string;
  state: DeletionConfirmationState;
  busy: boolean;
  onAction: (action: DeletionConfirmationAction) => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (state.open) inputRef.current?.focus();
    else if (wasOpen.current) openButtonRef.current?.focus();
    wasOpen.current = state.open;
  }, [state.open]);
  return (
    <Panel aria-labelledby="delete-config-heading" className="form-stack">
      <h2 id="delete-config-heading">
        {t(I18N_KEYS.projectConfigurationDeleteHeading)}
      </h2>
      <p>{t(I18N_KEYS.projectConfigurationDeleteDescription)}</p>
      <div
        id="delete-config-warning"
        className="scope-notice scope-notice--warning"
      >
        <strong>{t(I18N_KEYS.projectConfigurationDeleteJiraUntouched)}</strong>
        <p>{t(I18N_KEYS.projectConfigurationDeleteAnalysisWarning)}</p>
      </div>
      {state.open ? (
        <div
          className="form-stack"
          role="group"
          aria-labelledby="delete-config-confirmation-title"
          aria-describedby="delete-config-warning"
        >
          <h3 id="delete-config-confirmation-title">
            {t(I18N_KEYS.projectConfigurationDeleteConfirmationTitle)}
          </h3>
          <p id="delete-config-instruction">
            {t(I18N_KEYS.projectConfigurationDeleteKeyInstruction)}{" "}
            <strong>{projectKey}</strong>
          </p>
          <label className="field" htmlFor="delete-config-project-key">
            <span>{t(I18N_KEYS.projectConfigurationDeleteKeyLabel)}</span>
            <input
              ref={inputRef}
              id="delete-config-project-key"
              value={state.projectKey}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              aria-describedby="delete-config-warning delete-config-instruction"
              onChange={(event) =>
                onAction({ type: "key", value: event.target.value })
              }
            />
          </label>
          <div className="form-actions">
            <button
              className="button button--secondary"
              type="button"
              disabled={busy}
              onClick={() => onAction({ type: "reset" })}
            >
              {t(I18N_KEYS.projectConfigurationDeleteCancel)}
            </button>
            <button
              className="button"
              type="button"
              disabled={!isDeletionConfirmed(state, projectKey, busy)}
              onClick={onConfirm}
            >
              {busy
                ? t(I18N_KEYS.projectConfigurationDeleting)
                : t(I18N_KEYS.projectConfigurationDeletePermanent)}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            ref={openButtonRef}
            className="button button--secondary"
            type="button"
            disabled={busy}
            aria-expanded={false}
            onClick={() => onAction({ type: "open" })}
          >
            {t(I18N_KEYS.projectConfigurationDeleteAction)}
          </button>
        </div>
      )}
    </Panel>
  );
}
