# ADR 0003 — Optional AI Explanation Layer R&D

Status: Draft / R&D only

Jira: SCRUM-83

Baseline: `main@c7f87016f8436cb974f66f58157b8f114fb3598f`

## Context

ReleaseProof 2.9.0 is under Atlassian Marketplace review. Its production architecture is Forge-only, read-only, deterministic, and intentionally contains no AI/LLM calls, remotes, external egress, external runtime, or external database.

This ADR explores a future ReleaseProof 3.x explanation layer without changing that submitted 2.9.0 candidate.

## Decision under evaluation

Introduce an optional explanation layer downstream of the deterministic readiness engine.

The deterministic core remains the sole source of truth for:

- rule results;
- evidence status;
- readiness score;
- Ready / Incomplete / Blocked classification.

The explanation layer may only:

- explain an existing finding;
- summarize an existing release analysis;
- prioritize already-existing findings for human attention;
- suggest human next steps based only on deterministic evidence.

It must not:

- alter any rule result or readiness score;
- create new blocking facts not present in deterministic evidence;
- autonomously approve or reject a release;
- write Jira issues;
- persist complete Jira issues, complete reports, raw ADF, descriptions, comments, or user profiles.

## Phase 1 — provider-neutral architecture only

Phase 1 is intentionally network-free and must not add:

- Forge remotes;
- egress hosts;
- scopes;
- external APIs;
- LLM SDKs;
- manifest changes;
- production feature enablement.

Implementation targets:

1. `DeterministicEvidenceEnvelope`
   - allowlist-only structured input;
   - no raw Jira issue payload;
   - no comments/descriptions/raw ADF;
   - no persistent storage of the envelope.

2. `ExplanationProvider` port
   - provider-neutral interface;
   - fake/in-memory implementation for tests only.

3. Use cases
   - `explainFinding`
   - `summarizeRelease`

4. Safety properties
   - deterministic fallback output;
   - feature flag / UI seam default OFF;
   - logs contain identifiers/codes only, never evidence content;
   - failures never affect deterministic analysis availability.

5. Verification
   - synthetic fixtures only;
   - contract tests proving score/result immutability;
   - tests proving forbidden Jira fields never reach the provider boundary.

## Phase 2 — explicitly out of scope for this branch

A real Atlassian-hosted LLM or Rovo integration requires a separate post-approval decision and review of:

- current Atlassian Forge LLM / Rovo documentation;
- Marketplace major-version implications;
- Runs on Atlassian implications;
- privacy/security questionnaire changes;
- DPA/subprocessor impact;
- data-minimization contract;
- admin opt-in / kill switch;
- evaluation and golden-set requirements.

## Release boundary

This branch is R&D only.

It must not be merged into `main` while ECOHELP-169436 or ECOHELP-169435 remain pending unless a separate explicit release decision is made.

No Forge Production deployment and no Marketplace mutation are authorized by this ADR.

## Exit criteria

- provider-neutral contracts and use cases implemented;
- no external requests;
- no manifest/scope/remote/egress changes;
- feature remains disabled by default;
- typecheck, lint, tests, format check, build and Forge lint pass;
- independent exact-SHA review before any integration or merge decision.
