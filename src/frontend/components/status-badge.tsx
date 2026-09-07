import { memo } from "react";
import type { ReadinessStatus } from "../../domain/models/readiness";
import { useI18n } from "../i18n/context";
import { I18N_KEYS } from "../i18n/keys";
import { readinessStatusKey } from "../i18n/readiness-status-keys";

export const StatusBadge = memo(function StatusBadge({
  status,
}: {
  status: ReadinessStatus;
}) {
  const { t } = useI18n();
  const label = t(readinessStatusKey(status));

  return (
    <span
      className={`status status--${status.toLowerCase()}`}
      aria-label={`${t(I18N_KEYS.readinessStatusAria)}: ${label}`}
    >
      {label}
    </span>
  );
});
