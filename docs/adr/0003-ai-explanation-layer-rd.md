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

## Phase 1 implementation — isolated, not Production

The R&D exception to `AGENTS.md` permits only these provider-neutral application
contracts and local tests. It does not permit AI calls, semantic extraction,
new services, or relaxing any production engineering rule.

### Data flow and contracts

`explainFinding` and `summarizeRelease` are separate application use cases. They
accept an already completed server-side `ReleaseReadinessResultDto` through a
deep-readonly view; they neither call nor modify the deterministic engine.
There is no new resolver, client API, UI control, report integration or storage
setting. Existing application code does not import this layer.

`DeterministicEvidenceEnvelope` is a versioned union with two projections:

- Finding: `schemaVersion`, operation kind, normalized `en-US` / `de-DE` locale,
  allowlisted `ruleId`, `outcomeId` and deterministic status.
- Release summary: version, kind, locale, deterministic status/score, total and
  Ready/Incomplete/Blocked issue counts, and seven fixed-order per-rule counts
  of Incomplete/Blocked evidence items. These are evidence counts, not distinct
  issue counts. Existing aggregate values are copied, never rescored.

No project/release/version identifier, issue key/type/name/summary, source field,
JQL, label, approval marker, outcome parameter, raw issue, description, comment,
acceptance text, ADF, account identifier, attachment, history or report crosses
the provider boundary. Identifiers were not necessary for either operation.
Even the existing public analysis DTO is too broad to pass to a provider.
Projections are explicitly rebuilt, enum/numeric values are runtime-validated,
and every envelope object/array is frozen. No caller-owned nested reference is
passed to a provider.

Finding selection must resolve to one existing issue/evidence pair in the
completed result. Missing or ambiguous references and invalid projected values
fail with a content-free `INVALID_INPUT` error before any provider invocation.
The type is an internal orchestration contract, not proof of provenance for
arbitrary client JSON. Any future resolver must obtain and authorize its result
server-side; accepting a client-supplied result or envelope is not authorized.

### Provider, feature seam and fallback

`ExplanationProvider` lives under `src/application/explanation`, outside the
domain. Its methods receive only their respective envelope and an AbortSignal;
responses are `unknown` until runtime validation. `FakeExplanationProvider`
exists only under `tests/fixtures` and captures calls in test memory. There is
no real provider, network transport, prompt or SDK.

`DISABLED_EXPLANATIONS` is the default application-level capability. Enabling
requires explicit in-process dependency injection, not an environment variable,
KVS value, frontend flag or Marketplace setting. It is not wired into Production.
Disabled mode never invokes the provider and returns the deterministic fallback.

Responses must be exactly `{ text: string }`, nonblank after trimming, with an
input length of at most 2,000 characters. Extra keys (including score, status,
new findings or source overrides) are rejected. The application assigns the
source and `plain-text` format itself. Provider text has `requiresHumanReview:
true`; it is untrusted presentation, never executable markup, JQL, an approval
instruction or a replacement deterministic result. Runtime validation checks
shape and size, not factual correctness or grounding of free-form text.

The default deadline is 1,000 ms, with explicit test/R&D overrides limited to
1–5,000 ms. Errors, missing providers, invalid responses and timeouts return
separately identified fallback reasons. Timeout aborts the signal and ignores
late completion; success/failure clears the timer. Cancellation is cooperative:
this is not a sandbox for hostile in-process code or a way to preempt synchronous
CPU work. A future adapter must honor cancellation and enforce its own budgets.

Fallback uses ReleaseProof-owned, customer-parameter-free templates for all 19
outcomes in both supported locales, or a localized numeric release summary.
It explicitly reports `source: deterministic-fallback`, never AI generation.
Returned deterministic result/finding references are unchanged, separately
typed from the frozen explanation. Caller data is not frozen or rewritten.

The layer logs nothing and persists nothing, including on validation failure.
No exception, provider response, envelope or generated text is added to the
existing analysis diagnostics.

### Verification and activation limits

Focused tests cover exact payload allowlists, nested forbidden sentinels,
frozen provider inputs, original result/reference preservation, malformed
responses, synchronous/asynchronous failure, timeout/late completion, disabled
mode, stable Markdown output, logging/network absence, and both fallback
locales. Architecture tests prevent imports from the existing product into the
R&D layer and limit its dependencies to model contracts, safe errors and Zod.
Existing production tests remain unchanged.

Future activation still requires an independently reviewed adapter, authenticated
result provenance, opt-in/kill-switch and privacy decisions, localized presentation
integration, safe text rendering, semantic/grounding evaluations and human review.
The current schema validator does not establish explanation truthfulness.
There is no claim that AI exists in ReleaseProof 2.9.0.

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
