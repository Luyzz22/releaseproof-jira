import { useI18n } from "../i18n/context";
import { I18N_KEYS } from "../i18n/keys";

export function LoadingState({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();

  return (
    <div
      className={compact ? "loading-state" : "shell shell--center"}
      aria-busy="true"
      role="status"
      aria-live="polite"
    >
      <div className="loader" aria-hidden="true" />
      <p>{t(compact ? I18N_KEYS.loadingCompact : I18N_KEYS.loadingFull)}</p>
    </div>
  );
}
