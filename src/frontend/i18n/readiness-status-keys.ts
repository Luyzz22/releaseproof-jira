import type { ReadinessStatus } from "../../domain/models/readiness";
import { I18N_KEYS, type I18nKey } from "./keys";

const READINESS_STATUS_KEYS = {
  READY: I18N_KEYS.readinessStatusReady,
  INCOMPLETE: I18N_KEYS.readinessStatusIncomplete,
  BLOCKED: I18N_KEYS.readinessStatusBlocked,
  NOT_APPLICABLE: I18N_KEYS.readinessStatusNotApplicable,
} satisfies Record<ReadinessStatus, I18nKey>;

export function readinessStatusKey(status: ReadinessStatus): I18nKey {
  return READINESS_STATUS_KEYS[status];
}
