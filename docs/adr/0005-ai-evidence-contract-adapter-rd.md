# ADR 0005 — AI Explanation Adapter to Evidence Contract v1

Status: Draft / isolated R&D; independent exact-SHA review pending

Jira: SCRUM-89

## Reviewed dependencies and branch shape

- Frozen Production/main: `c7f87016f8436cb974f66f58157b8f114fb3598f`.
- SCRUM-88 / PR #17 parent: `43957889f17151ff13613789e49532d076ac0a27`.
- SCRUM-83/86 reviewed source: `b394f212019e50211f39d6b9f78434a46a59ebbf`.

The new `spike/scrum-89-ai-evidence-contract` branch starts from SCRUM-88.
Its first commit copies the 22 reviewed SCRUM-83/86 R&D/docs/test files exactly,
including the R&D architecture note. Subsequent changes implement this adapter.
No existing branch or PR is updated or merged. The Draft PR targets SCRUM-88,
not main. Review both the dependency import and the adapter delta explicitly.
The existing seven protected Production files and both SCRUM-88 runtime modules
remain byte-identical. Only its architecture test gets three explicit incoming
contract consumers; no builder or Production entry-point exception is added.

## Decision

Both explanation use cases consume `evidence: unknown` and run the unchanged
strict Evidence Contract v1 parser before any fallback or provider orchestration.
Only `SUMMARY_MINIMIZED` with `dataBoundary: MINIMIZED` is accepted.
`TRACEABLE_INTERNAL` is rejected before its trace is inspected, without stripping
fields or silently converting it. Legacy DTOs, unknown versions, extra fields,
invalid semantics/counts and malformed canonical arrays are rejected.
All failures expose only the fixed `INVALID_INPUT` code and content-free message.

The adapter cannot import the DTO, builder, deterministic engine, Jira, storage,
resolvers or UI. The caller must supply an already-produced minimized contract;
this R&D slice adds no runtime path that obtains one from Production.

### Finding semantics

`explainFinding` now selects `ruleId` plus `outcomeId` from the summary. The exact
pair must exist with `count > 0`. Zero-count outcomes remain in the canonical
contract but cannot be selected for explanation. The finding status comes from
the already-validated v1 outcome/status mapping, never from the selector or a
provider. No issue ID is accepted, forwarded, inferred or returned.

The retained operation name means explanation of an observed outcome class.
A summary cannot establish which issue had the finding, nor correlations between
findings on different issues. Individual issue explanation requires a separate
future design; this migration does not reintroduce TRACEABLE data to provide it.
Fallback copy describes that outcome, not all issues in the release.

### Release summaries and ownership

The adapter copies release status, score and counts exactly and projects the
canonical per-rule incomplete/blocked counts. It never rescales, reruns rules,
infers readiness from counts or upgrades an empty release. Scope and outcome
aggregates are validated even when the narrower provider projection omits them.

Both use cases return `deterministicEvidence`, an owned deeply frozen validated
summary snapshot, alongside the explanation. Finding results also return the
selected stable codes. Caller data is neither retained, mutated nor frozen;
changes after the call cannot change provider facts or the returned snapshot.
The provider receives only newly constructed frozen envelopes, never the original
input or its trace. Envelope version 1 and existing provider-port shapes remain
unchanged; Evidence Contract version 1 is a distinct input version.

## Retained SCRUM-83/86 behavior

- Default capability OFF; no environment/KVS/UI toggle.
- Fake in-memory providers exist only in tests.
- Deterministic EN/DE fallback, timeouts and cooperative abort remain.
- Provider text is bounded, shape-validated untrusted plain text and requires
  human review. The offline evaluator is not installed as a runtime truth filter.
- Golden Set version 2 has 46 cases generated through validated summaries and
  this exact adapter: all 19 outcomes in EN/DE and four release statuses in EN/DE.
- Failure taxonomy and report semantics remain unchanged. Reports cannot mix in
  stale version-1 results. No provider text is retained by eval results/reports.

## Verification

Tests cover old DTO/internal profile rejection, extra fields, unknown versions,
invalid counts/status/outcome semantics, noncanonical/duplicate arrays, forbidden
sourceField/params, accessors and custom prototypes, positive-count selection,
empty releases, 9,999/10,000 issue summaries, exact fact preservation, caller
mutation after invocation and deep freezing. Synthetic DTO-to-contract-to-adapter
regressions prove customer sentinels never cross the provider boundary. Engine
fixtures independently cover the v1 mapping for all 19 outcomes in both locales.

Architecture checks preserve Production isolation, prohibit explanation imports
of DTO/builder/engine/infrastructure, prohibit Production-to-eval imports, and
byte-compare protected Production and SCRUM-88 runtime files.

Required local gates: focused tests; typecheck; lint; full tests; format:check;
build; forge:lint; git diff --check. Handoff must distinguish locally executed
gates from independent source review and GitHub Actions evidence.

## Limits and activation boundary

A structurally valid summary is not authenticated evidence. A future consumer
must establish trusted server-side provenance, authorization and byte budgets
before deserialization. Active JavaScript Proxy traps are not sandboxed. Output
shape validation and bounded lexical evaluation do not prove factual truth or
semantic safety. Cancellation cannot preempt hostile synchronous provider code.

This slice authorizes no external processing, real provider, Forge LLM/Rovo,
AI judge, n8n, webhook, Jira write, logging, persistence, dependency, manifest,
package, scope, remote, egress, UI/resolver/report activation, Marketplace change,
merge or deployment. Existing R&D PASS verdicts apply only to their historical
exact SHAs. This combined adapter requires its own independent exact-SHA review.
