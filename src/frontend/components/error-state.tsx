import type { SafeError } from "../../shared/errors";
import { appErrorDefaultMessage, appErrorMessageKey } from "../i18n/error-keys";
import { useI18n } from "../i18n/context";
import { I18N_KEYS } from "../i18n/keys";
import { Panel } from "./panel";

export function ErrorState({
  error,
  onRetry,
}: {
  error: SafeError;
  onRetry?: () => void;
}) {
  const { t } = useI18n();

  return (
    <Panel className="state-card state-card--error" role="alert">
      <div className="state-icon" aria-hidden="true">
        !
      </div>
      <div>
        <p className="eyebrow">{t(I18N_KEYS.errorAnalysisUnavailable)}</p>
        <h1>
          {t(
            appErrorMessageKey(error.code),
            appErrorDefaultMessage(error.code),
          )}
        </h1>
        {error.retryAfterSeconds ? (
          <p>
            {t(I18N_KEYS.errorRetryLead)} {error.retryAfterSeconds}{" "}
            {t(I18N_KEYS.errorRetrySeconds)}
          </p>
        ) : null}
        {onRetry ? (
          <button
            type="button"
            className="button button--secondary"
            onClick={onRetry}
          >
            {t(I18N_KEYS.errorRetryAction)}
          </button>
        ) : null}
      </div>
    </Panel>
  );
}
