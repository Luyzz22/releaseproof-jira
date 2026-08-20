import type { SafeError } from "../../shared/errors";
import { Panel } from "./panel";

export function ErrorState({
  error,
  onRetry,
}: {
  error: SafeError;
  onRetry?: () => void;
}) {
  return (
    <Panel className="state-card state-card--error" role="alert">
      <div className="state-icon" aria-hidden="true">
        !
      </div>
      <div>
        <p className="eyebrow">Analyse nicht verfügbar</p>
        <h1>{error.message}</h1>
        {error.retryAfterSeconds ? (
          <p>
            Frühester neuer Versuch in etwa {error.retryAfterSeconds} Sekunden.
          </p>
        ) : null}
        {onRetry ? (
          <button
            type="button"
            className="button button--secondary"
            onClick={onRetry}
          >
            Erneut versuchen
          </button>
        ) : null}
      </div>
    </Panel>
  );
}
