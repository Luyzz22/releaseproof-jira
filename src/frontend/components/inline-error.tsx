import type { SafeError } from "../../shared/errors";

export function InlineError({
  error,
  onDismiss,
}: {
  error: SafeError;
  onDismiss: () => void;
}) {
  return (
    <div className="inline-error" role="alert">
      <span aria-hidden="true">!</span>
      <p>{error.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fehlermeldung schließen"
      >
        ×
      </button>
    </div>
  );
}
