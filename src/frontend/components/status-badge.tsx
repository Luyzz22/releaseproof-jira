import { memo } from "react";
import type { ReadinessStatus } from "../../domain/models/readiness";

const labels: Record<ReadinessStatus, string> = {
  READY: "READY",
  INCOMPLETE: "INCOMPLETE",
  BLOCKED: "BLOCKED",
  NOT_APPLICABLE: "NICHT ANWENDBAR",
};

export const StatusBadge = memo(function StatusBadge({
  status,
}: {
  status: ReadinessStatus;
}) {
  const label = labels[status];
  return (
    <span
      className={`status status--${status.toLowerCase()}`}
      aria-label={`Readiness-Status: ${label}`}
    >
      {label}
    </span>
  );
});
