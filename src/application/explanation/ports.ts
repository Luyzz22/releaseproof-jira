import type {
  FindingEvidenceEnvelope,
  ReleaseEvidenceEnvelope,
} from "./contracts";

export interface ExplanationProvider {
  explainFinding(
    envelope: FindingEvidenceEnvelope,
    signal: AbortSignal,
  ): Promise<unknown>;
  summarizeRelease(
    envelope: ReleaseEvidenceEnvelope,
    signal: AbortSignal,
  ): Promise<unknown>;
}

export type ExplanationCapability =
  | Readonly<{ enabled: false }>
  | Readonly<{
      enabled: true;
      provider: ExplanationProvider | null;
      timeoutMs?: number;
    }>;

// No environment variable, persisted setting, resolver or UI activation.
export const DISABLED_EXPLANATIONS: ExplanationCapability = Object.freeze({
  enabled: false,
});
