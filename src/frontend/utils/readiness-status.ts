import type { ReadinessStatus } from "../../domain/models/readiness";

const READINESS_STATUS_LABELS = {
  READY: "Bereit",
  INCOMPLETE: "Unvollständig",
  BLOCKED: "Blockiert",
  NOT_APPLICABLE: "Nicht anwendbar",
} satisfies Record<ReadinessStatus, string>;

export function readinessStatusLabel(status: ReadinessStatus): string {
  return READINESS_STATUS_LABELS[status];
}
