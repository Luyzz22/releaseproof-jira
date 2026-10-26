# ADR 0004 — ReleaseProof Evidence Contract v1 R&D

Status: Draft / R&D only

Jira: SCRUM-88

Baseline: `main@c7f87016f8436cb974f66f58157b8f114fb3598f`

## Decision context

ReleaseProof 2.9.0 already exposes a typed `ReleaseReadinessResultDto` to its own UI.
That DTO is intentionally product-facing and contains Jira-derived display data such as
project key, version name, issue summaries, status names and optional release-scope JQL.

Future integrations must not bind directly to that UI DTO or to raw Jira/domain models.

The purpose of SCRUM-88 is to define a stable, versioned machine-readable Evidence
Contract that copies deterministic ReleaseProof results into an integration-neutral
shape without activating any integration.

This R&D slice starts from Production `main`, not from the AI or n8n R&D branches.
The resulting contract is intended to become a neutral dependency that those branches
may deliberately adopt later.

## Non-negotiable authority boundary

The deterministic ReleaseProof engine remains the sole source of truth for:

- evidence rule outcomes;
- issue readiness status;
- release readiness status;
- issue score;
- release score;
- blocker/missing-evidence counts.

The Evidence Contract MUST NOT:

- run readiness rules;
- infer new findings;
- recompute scores;
- upgrade or downgrade statuses;
- approve or reject a release;
- claim compliance, audit or deployment authority.

The contract is a transport representation of already-computed deterministic facts.

## Contract version

The first contract version is exactly:

```text
schemaVersion = 1
contract = "releaseproof-evidence"
```

Version 1 is additive R&D only. It is not an external API compatibility promise until
a later explicit release decision.

## Profiles

Version 1 has two deliberately different profiles.

### SUMMARY_MINIMIZED

Purpose: smallest useful derived representation for future AI, operations or integration
review.

Allowed top-level data:

- contract/schema version;
- profile;
- deterministic release status;
- deterministic release score;
- total/ready/incomplete/blocked issue counts;
- release scope mode;
- stable per-rule aggregates;
- stable per-outcome aggregates;
- explicit human-review / no-release-authorization boundary metadata.

It MUST NOT contain:

- `projectKey`;
- `versionName`;
- `releaseScopeJql`;
- `issueKey`;
- issue summary;
- Jira status display name;
- issue type display name;
- acceptance-criteria text;
- description/comments/ADF;
- labels;
- linked issue keys;
- subtask keys;
- approval-marker value;
- Jira field IDs;
- user/account/email data;
- arbitrary customer text;
- `EvidenceOutcome.params`.

This profile is only a _candidate_ for later external/AI use. SCRUM-88 does not
authorize sending it anywhere.

### TRACEABLE_INTERNAL

Purpose: internal deterministic traceability for later adapters or evidence tooling.

It contains the same release-level deterministic facts as SUMMARY_MINIMIZED plus a
stable issue-level trace.

An issue trace may contain only:

- `issueKey`;
- issue readiness status;
- issue score;
- blocker count;
- missing-evidence count;
- findings with:
  - `ruleId`;
  - `category`;
  - finding status;
  - `outcomeId`.

It MUST NOT contain:

- issue summary;
- status display name;
- issue type display name;
- project key;
- version name;
- release-scope JQL;
- source field;
- `EvidenceOutcome.params`;
- labels;
- acceptance criteria;
- comments/descriptions/ADF;
- linked/subtask details beyond what is represented by the stable outcome ID;
- users/accounts/emails.

The profile MUST carry an explicit machine-readable boundary such as
`dataBoundary: "INTERNAL_ONLY"`.

## Stable aggregate model

The contract MUST use the authoritative domain constants:

- `EVIDENCE_RULE_IDS`;
- `EVIDENCE_OUTCOME_IDS`;
- `READINESS_STATUSES`;
- `RELEASE_SCOPE_MODES`.

Every current rule, outcome and readiness status must be mechanically covered.

Recommended rule aggregate shape:

```ts
{
  ruleId,
  ready,
  incomplete,
  blocked,
  notApplicable,
  outcomes: [
    { outcomeId, count }
  ]
}
```

Only outcomes belonging to that rule may appear under the rule.

No rule/outcome display prose belongs in the contract.

## Deterministic ordering

Builders and canonical serialization MUST produce stable ordering independent of source
array order where ordering has no product meaning.

Use authoritative constant order for:

- rules;
- outcomes within each rule.

Use lexical ordering for TRACEABLE_INTERNAL issue records by `issueKey`.

Use rule/outcome constant order for issue findings.

Do not use locale-dependent sorting.

## Exact deterministic facts

The builder must copy from `ReleaseReadinessResultDto` rather than recalculate.

Release facts that must be preserved exactly:

- `status`;
- `score`;
- `totalIssues`;
- `readyIssues`;
- `incompleteIssues`;
- `blockedIssues`;
- `release.releaseScopeMode`.

Issue facts in TRACEABLE_INTERNAL that must be preserved exactly:

- `issueKey`;
- `status`;
- `score`;
- `blockerCount`;
- `missingEvidenceCount`;
- evidence `ruleId`;
- evidence `category`;
- evidence `status`;
- evidence `outcome.outcomeId`.

## Aggregation rule

Rule/outcome aggregates may be counted from the existing evidence items because they are
a lossless deterministic aggregation of already-produced findings.

They must never alter the source result.

The contract builder must not derive a new readiness status from those aggregates.

## Empty release behavior

A release with zero analyzed issues remains a valid contract input when the existing
ReleaseReadinessResultDto is valid.

The contract must preserve its supplied deterministic status/score/counts and must not
reinterpret an empty release as READY.

## Human-review / authority metadata

Both profiles must contain a constant, application-owned boundary equivalent to:

```ts
{
  humanReviewRequired: true,
  releaseAuthorization: "NONE"
}
```

This metadata is not provider output and cannot be changed by a future consumer.

## Runtime validation

Provide a dependency-free strict runtime parser/validator for Evidence Contract v1.

The validator must:

- accept only ordinary data objects;
- inspect data properties without invoking accessors;
- reject arrays where objects are required;
- reject unexpected keys;
- require exact schema/contract/profile values;
- require valid enum members;
- require finite integer scores in `0..100`;
- require non-negative safe-integer counts;
- validate aggregate consistency;
- validate rule/outcome membership;
- validate issue/finding shapes;
- reject duplicate issue keys;
- reject duplicate rules/outcomes where uniqueness is required;
- reject invalid ordering rather than silently reordering untrusted input;
- reject TRACEABLE fields in SUMMARY_MINIMIZED;
- reject customer-text fields even if their values look harmless.

The parser must not mutate its input.

No new runtime dependency is allowed.

## Aggregate consistency

For SUMMARY_MINIMIZED and TRACEABLE_INTERNAL:

```text
totalIssues = readyIssues + incompleteIssues + blockedIssues
```

`NOT_APPLICABLE` is a readiness status, not an additional analyzed-issue counter.

Per-rule status/outcome counts must be internally consistent with the mapped evidence
records/aggregates.

Do not infer release status from the counts.

## Canonical JSON

Provide a pure canonical serialization helper for already-valid contract values.

Requirements:

- deterministic output for structurally equivalent valid contracts;
- stable key construction by the builder;
- stable array ordering;
- no clock;
- no random;
- no network;
- no locale-dependent formatting;
- no logging;
- no mutation.

A cryptographic fingerprint is NOT required in SCRUM-88. Do not add Node-only crypto
to shared/Forge/browser code merely to produce a hash.

## Data-minimization tests

Use synthetic sentinels in a source `ReleaseReadinessResultDto`, including:

- project key;
- version name;
- JQL;
- issue summary;
- status display name;
- issue type display name;
- source field;
- outcome params such as blocker label/version/approval marker/linked issue key.

Prove:

- none occur in SUMMARY_MINIMIZED serialized output;
- TRACEABLE_INTERNAL contains only the deliberately permitted `issueKey` reference;
- no forbidden sentinel survives through nested objects or canonical serialization.

## Coverage guards

Tests MUST mechanically prove:

```text
mapped rule IDs == EVIDENCE_RULE_IDS
mapped outcome IDs == EVIDENCE_OUTCOME_IDS
accepted statuses == READINESS_STATUSES
accepted scope modes == RELEASE_SCOPE_MODES
```

Adding a new domain rule/outcome/status/scope mode later must break the SCRUM-88 coverage
tests until the contract is intentionally updated.

## Suggested implementation boundary

Repository-native naming is preferred. A narrow structure such as:

```text
src/shared/evidence-contract-v1.ts
src/application/evidence-contract/build-evidence-contract-v1.ts
tests/application/evidence-contract-v1.test.ts
tests/architecture/evidence-contract-isolation.test.ts
```

is acceptable.

Do not force this exact layout if a cleaner existing architecture convention applies.

## Production isolation

SCRUM-88 MUST remain unreferenced by current Production entry points.

Tests must prove no import of the new contract/builder from:

- Forge resolvers;
- Jira infrastructure;
- current frontend UI/pages;
- Markdown/report utilities;
- storage;
- Production manifest/runtime registration.

The new R&D modules may depend on:

- shared `ReleaseReadinessResultDto` types;
- domain evidence/readiness constants and types.

The domain must not depend on the Evidence Contract.

## Security and privacy boundary

This slice creates no new data flow.

Explicitly unchanged:

- Jira data remains read-only;
- no external remote;
- no egress host;
- no persistence of analysis results;
- no new KVS keys;
- no webhooks;
- no AI provider;
- no n8n path;
- no third-party telemetry;
- no Jira write scope.

## Protected files

Do not modify:

- `manifest.yml`;
- `package.json`;
- `package-lock.json`.

No new dependency.

Production behavior must remain unchanged.

## Required tests

At minimum:

1. SUMMARY_MINIMIZED builds from synthetic ReleaseReadinessResultDto.
2. TRACEABLE_INTERNAL builds from the same source.
3. source DTO remains deeply unchanged.
4. status/score/counts are copied exactly.
5. all 7 rule IDs covered.
6. all 19 outcome IDs covered.
7. all readiness statuses accepted/guarded.
8. both scope modes accepted/guarded.
9. SUMMARY_MINIMIZED contains no forbidden Jira/customer sentinel.
10. TRACEABLE_INTERNAL exposes only explicitly permitted issue keys.
11. outcome params are never copied.
12. sourceField is never copied.
13. rule/outcome aggregates are deterministic.
14. shuffled input evidence/issues canonicalizes to the same contract.
15. parser rejects unknown keys.
16. parser rejects accessor/prototype tricks without invoking getters.
17. parser rejects invalid scores/counts/enums.
18. parser rejects duplicate issues/rules/outcomes.
19. parser rejects inconsistent aggregate counts.
20. canonical serialization is repeatable.
21. current Production runtime has no import path to SCRUM-88.
22. no network/log/storage/clock/random side effect is introduced.

## Out of scope

SCRUM-88 does not implement:

- a resolver endpoint;
- UI button;
- file download;
- REST API;
- webhook;
- n8n connection;
- AI/Rovo provider;
- Slack/Teams integration;
- CI/CD integration;
- persistence/history;
- customer-facing export;
- Marketplace changes;
- deployment.

## Exit criteria

SCRUM-88 is ready for independent review when:

- Contract v1 is typed and strict-runtime validated;
- SUMMARY_MINIMIZED and TRACEABLE_INTERNAL are clearly separated;
- all coverage/drift guards pass;
- canonicalization is deterministic;
- data-minimization tests pass;
- no Production import path exists;
- all repository gates pass;
- protected files are unchanged;
- no merge/deploy/Marketplace mutation occurred.

Any later activation requires a separate Security/Privacy and product decision.

## Implemented R&D policies

The additive implementation lives in `src/shared/evidence-contract-v1.ts` and
`src/application/evidence-contract/build-evidence-contract-v1.ts`. No existing
Production module imports either module. The existing UI DTO, mapper, Analyze
Release use case and domain engine remain unchanged.

Both profiles carry `schemaVersion`, `contract`, `profile`, `dataBoundary`,
`authority`, `release` and `rules`. SUMMARY_MINIMIZED uses `MINIMIZED`;
TRACEABLE_INTERNAL uses `INTERNAL_ONLY` and adds `issues`. Every rule and its
valid outcomes appear in authoritative constant order, including zero counts.
Explicit exhaustive mappings and exact-set tests guard domain drift.

The builder consumes the trusted application-owned `ReleaseReadinessResultDto`.
It copies only the allowed fields, orders newly allocated arrays, and validates
the complete trace before returning either profile. Invalid source findings
cannot disappear through summary minimization. It never reads `generatedAt`,
display fields, `sourceField` or outcome params. It preserves supplied release
and issue statuses, scores and counts, including empty-release facts.

The parser accepts ordinary records with `Object.prototype` or a null prototype.
All required record properties must be own, enumerable data properties. Symbols,
accessors, hidden properties, unknown keys and custom prototypes are rejected.
Arrays must be dense ordinary arrays with no extra own properties; array
subclasses, custom prototypes, accessors and sparse arrays are rejected. Parsing
reads descriptors without invoking input getters, iterators or `toJSON` methods.
Output is reconstructed into ordinary owned objects and deeply frozen; caller
objects are neither retained nor frozen. Failures expose only the fixed
`INVALID_EVIDENCE_CONTRACT_V1` error code/message.

Issue keys follow the existing configured project-key shape plus a digit suffix.
Issues use locale-independent lexical ordering. Every issue must contain exactly
one finding per authoritative rule, in rule order. Missing rules, duplicate rules
and mutually exclusive outcomes from the same rule are rejected. Explicit v1
rule/category, outcome/rule and outcome/status mappings validate the supplied
finding semantics. Tests check every mapping against existing domain behavior;
the parser never executes domain rules or silently corrects findings.
The parser rejects noncanonical array ordering; the builder canonicalizes source
arrays. Serialization reparses and reconstructs stable object keys before JSON
encoding, without timestamps, randomness or a fingerprint.

Counts are non-negative safe integers and scores are integers in `0..100`.
Validation checks the release counter sum and requires every rule's status and
outcome totals to equal `release.totalIssues` in both profiles. Status aggregates
must also agree with the explicitly mapped outcome statuses. TRACEABLE additionally
checks issue count, uniqueness, and every aggregate against its findings.
It does not recompute issue/release readiness or scores. Supplied blocker and
missing-evidence counts are copied and range-checked, never recomputed.
Summary aggregates cannot be checked against
individual findings because that profile intentionally omits the trace.

`EVIDENCE_CONTRACT_MAX_ISSUES = 10_000` mirrors the existing Jira gateway ceiling
of 100 pages with 100 entries. Release size and trace length are limited to that
bound, with exact trace/release count equality. The builder rejects excessive
result counts before mapping. The parser checks list lengths before enumerating
keys or visiting entries; rule, outcome and finding arrays are bounded by their
authoritative v1 sets. Tests accept 9,999 and 10,000 issues and reject 10,001.
The main DTO fixture is generated by the deterministic engine, with seven findings
per issue; separate cases cover all nineteen outcome mappings and supplied-fact
copy probes.

These are data validation and minimization boundaries, not source authentication
or a JavaScript sandbox. A future adapter must establish provenance and enforce
transport-byte limits before parsing decoded data; reflection on an active
JavaScript Proxy can execute proxy traps. The contract has no transport, storage
or consumer integration. TRACEABLE_INTERNAL still contains issue keys and remains
internal-only. R&D validation does not authorize external processing, activation,
a release or a deployment.
