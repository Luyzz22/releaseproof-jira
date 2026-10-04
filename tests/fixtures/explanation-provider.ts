import type {
  DeterministicEvidenceEnvelope,
  FindingEvidenceEnvelope,
  ReleaseEvidenceEnvelope,
} from "../../src/application/explanation/contracts";
import type { ExplanationProvider } from "../../src/application/explanation/ports";

export class FakeExplanationProvider implements ExplanationProvider {
  readonly calls: Array<{
    envelope: DeterministicEvidenceEnvelope;
    signal: AbortSignal;
  }> = [];

  constructor(
    public respond: (
      envelope: DeterministicEvidenceEnvelope,
      signal: AbortSignal,
    ) => unknown = () => ({
      text: "Synthetic explanation.",
    }),
  ) {}

  async explainFinding(
    envelope: FindingEvidenceEnvelope,
    signal: AbortSignal,
  ): Promise<unknown> {
    this.calls.push({ envelope, signal });
    return this.respond(envelope, signal);
  }

  async summarizeRelease(
    envelope: ReleaseEvidenceEnvelope,
    signal: AbortSignal,
  ): Promise<unknown> {
    this.calls.push({ envelope, signal });
    return this.respond(envelope, signal);
  }
}
