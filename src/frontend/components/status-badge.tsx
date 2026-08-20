import { memo } from "react";
import type { ReadinessStatus } from "../../domain/models/readiness";
import { readinessStatusLabel } from "../utils/readiness-status";

export const StatusBadge = memo(function StatusBadge({
  status,
}: {
  status: ReadinessStatus;
}) {
  const label = readinessStatusLabel(status);
  return (
    <span
      className={`status status--${status.toLowerCase()}`}
      aria-label={`Bereitschaftsstatus: ${label}`}
    >
      {label}
    </span>
  );
});
