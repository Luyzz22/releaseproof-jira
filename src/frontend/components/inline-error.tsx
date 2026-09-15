import type { SafeError } from "../../shared/errors";
import { appErrorDefaultMessage, appErrorMessageKey } from "../i18n/error-keys";
import { useI18n } from "../i18n/context";
import { I18N_KEYS } from "../i18n/keys";

export function InlineError({
  error,
  onDismiss,
}: {
  error: SafeError;
  onDismiss: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="inline-error" role="alert">
      <span aria-hidden="true">!</span>
      <p>
        {t(appErrorMessageKey(error.code), appErrorDefaultMessage(error.code))}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t(I18N_KEYS.errorDismissAria)}
      >
        ×
      </button>
    </div>
  );
}
