import { z } from "zod";
import type {
  DeterministicEvidenceEnvelope,
  Explanation,
  FallbackReason,
} from "./contracts";
import { deterministicExplanation } from "./deterministic-fallback";
import type { ExplanationCapability } from "./ports";

export const EXPLANATION_TIMEOUT_MS = 1_000;
export const MAX_EXPLANATION_LENGTH = 2_000;
const responseSchema = z
  .object({ text: z.string().max(MAX_EXPLANATION_LENGTH).trim().min(1) })
  .strict();

export async function requestExplanation(
  envelope: DeterministicEvidenceEnvelope,
  capability: ExplanationCapability,
): Promise<Explanation> {
  const fallback = (reason: FallbackReason): Explanation =>
    Object.freeze({
      source: "deterministic-fallback",
      format: "plain-text",
      reason,
      text: deterministicExplanation(envelope),
    });
  if (capability.enabled !== true) return fallback("DISABLED");
  const provider = capability.provider;
  const timeoutMs = capability.timeoutMs ?? EXPLANATION_TIMEOUT_MS;
  if (
    !provider ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 5_000
  )
    return fallback("UNAVAILABLE");

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = Symbol("timeout");
  try {
    const timeout = new Promise<typeof timedOut>((resolve) => {
      timer = setTimeout(() => {
        resolve(timedOut);
        controller.abort();
      }, timeoutMs);
    });
    // Promise chaining also contains a synchronous provider throw.
    const operation = Promise.resolve().then(() =>
      envelope.kind === "finding"
        ? provider.explainFinding(envelope, controller.signal)
        : provider.summarizeRelease(envelope, controller.signal),
    );
    const response = await Promise.race([operation, timeout]);
    if (response === timedOut) return fallback("TIMEOUT");
    const parsed = responseSchema.safeParse(response);
    if (!parsed.success) return fallback("INVALID_RESPONSE");
    return Object.freeze({
      source: "provider",
      format: "plain-text",
      requiresHumanReview: true,
      text: parsed.data.text,
    });
  } catch {
    // Never log exception text, input, output or validation errors.
    return fallback("UNAVAILABLE");
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
