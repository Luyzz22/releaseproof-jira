# SCRUM-86 — AI Golden Set & Evaluation Harness R&D

Status: Draft / R&D only

Parent: SCRUM-83 / PR #15  
Parent exact head: `13b9a0564197ca56d620e9c30cb1aa449a3e5b6d`

## Purpose

This slice defines a provider-neutral Golden Set and deterministic evaluation harness for the future ReleaseProof AI explanation layer.

It does not add a real LLM provider, network call, UI activation, Marketplace change, Forge scope, remote or egress host.

The deterministic ReleaseProof engine remains the only source of truth for readiness, evidence, score and status.

## Evaluation scope

The harness evaluates explanation quality only.

It must never:

- execute readiness rules;
- rescore a release;
- change finding status;
- change issue readiness;
- change release readiness;
- approve or reject a release;
- create Jira writes;
- persist customer Jira data.

## Golden Set requirements

Cover all stable EvidenceOutcomeId values used by ReleaseProof.

For each finding case define:

- caseId;
- ruleId;
- outcomeId;
- deterministic status;
- locale;
- required factual anchors;
- allowed factual anchors;
- forbidden claims;
- forbidden invented Jira/customer details;
- forbidden authority/release-approval wording;
- expected human-review boundary;
- optional safe remediation-language anchors.

At minimum, every current EvidenceOutcomeId must have EN and DE evaluation coverage, either through one bilingual case contract or explicit locale variants.

## Release summary cases

Include representative synthetic summary cases for:

- READY;
- INCOMPLETE;
- BLOCKED;
- NOT_APPLICABLE.

The harness must verify that any explanation:

- preserves the exact deterministic status;
- preserves the exact deterministic score;
- does not invent additional blockers/findings;
- does not claim approval/rejection authority;
- does not claim audit/compliance certification;
- does not invent Jira issue names, users, customer names or data.

## Deterministic evaluation dimensions

The first version must be rule-based, not LLM-as-judge.

Possible deterministic checks include:

- strict output shape;
- plain-text only;
- length bounds;
- required phrase/anchor presence;
- forbidden phrase/anchor absence;
- exact numeric preservation for score/counts;
- forbidden authority wording;
- forbidden compliance/certification wording;
- forbidden Jira/customer identifiers;
- forbidden executable markup/JQL patterns;
- locale-specific anchor checks;
- human-review framing requirements where applicable.

Do not add subjective semantic scoring that depends on another AI model.

## Evaluation result contract

Prefer explicit stable failure codes, for example:

- INVALID_OUTPUT_SHAPE
- TEXT_TOO_LONG
- REQUIRED_ANCHOR_MISSING
- FORBIDDEN_CLAIM_PRESENT
- INVENTED_DETAIL_PRESENT
- STATUS_MISMATCH
- SCORE_MISMATCH
- AUTHORITY_CLAIM_PRESENT
- COMPLIANCE_GUARANTEE_PRESENT
- UNSAFE_MARKUP_OR_JQL
- LOCALE_MISMATCH
- HUMAN_REVIEW_BOUNDARY_MISSING

Adapt names if a cleaner repository-native taxonomy exists.

Each EvalResult should be machine-readable and distinguish:

- case identity;
- pass/fail;
- failure codes;
- deterministic source facts;
- evaluated output mode.

Do not include real customer/Jira data.

## Aggregate report

Provide a deterministic aggregate report that can later compare providers/runs using the same Golden Set.

The report may contain:

- total cases;
- passed cases;
- failed cases;
- failure-code counts;
- per-locale counts;
- per-rule counts.

Do not create marketing scores or benchmark claims.

Any threshold is an internal R&D gate only.

## Adversarial fixtures

Include provider-output fixtures representing:

- invented blocker;
- invented issue/customer identifier;
- changed score;
- changed status;
- "release approved" / "release rejected" language;
- audit/compliance guarantee;
- HTML/script-like output;
- JQL-like instruction;
- empty output;
- oversized output;
- wrong-language output;
- safe valid output.

All fixtures must be synthetic.

## Isolation requirements

This slice must not change:

- manifest.yml;
- package.json;
- package-lock.json;
- Forge scopes;
- Forge remotes;
- Forge egress;
- Production resolvers/UI/report integration.

No external requests.

No provider SDK.

No actual OpenAI/Anthropic/Gemini/Mistral/Forge LLM/Rovo integration.

## Testing

Required tests should prove:

- all current EvidenceOutcomeId values are represented;
- all locales are covered;
- safe outputs pass;
- every adversarial class fails with the expected stable code;
- status/score cannot be silently changed;
- forbidden Jira/customer details are detected;
- aggregate report is deterministic;
- no network/log/persistence path is introduced;
- parent SCRUM-83 behavior remains unchanged.

## Exit criteria

- complete Golden Set;
- deterministic evaluator;
- stable failure taxonomy;
- aggregate report;
- adversarial synthetic fixtures;
- focused tests pass;
- full repository gates pass;
- parent PR #15 remains Draft/unmerged;
- ReleaseProof 2.9.0 remains unchanged;
- independent exact-SHA review before any real provider integration.
