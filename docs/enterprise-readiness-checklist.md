# Enterprise readiness checklist — evidence, not badges

This file is a **verification checklist**, not a certification, audit opinion or declaration that all controls have passed. It is maintained for releases of the Forge application, not the separate marketing website.

## Before a release candidate

- [ ] Record exact Git SHA, supported Node version, Forge CLI version and Marketplace target.
- [ ] Verify app manifest, requested scopes, external egress, modules and storage surface against `docs/permissions.md`.
- [ ] Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run format:check` and `npm run build`; retain genuine exit codes.
- [ ] Run Forge lint in an appropriately configured environment and retain its actual outcome; do not claim a pass if the CLI or credentials are missing.
- [ ] Test incomplete pagination, out-of-scope JQL, missing permissions, invalid IDs, untrusted Jira rich-text and absent acceptance-criteria fields.
- [ ] Verify no external remotes, telemetry, LLM calls or unauthorized write scopes were introduced.
- [ ] Confirm that no raw Jira issue payloads, real customer documents, credentials or secrets are committed or logged.
- [ ] Confirm English/German accessibility, empty/error states, keyboard support and report exports with synthetic fixtures.
- [ ] Reconcile product, security and data-handling claims on releaseproof.de and the Atlassian Marketplace with the reviewed source and deployed release.
- [ ] Review dependency alerts and any private security reports without disclosing details in public PRs.
- [ ] Record rollback/back-out decision and responsible reviewer.

## Evidence log

For each gate retain: exact SHA, command or review method, date, environment, **PASS / FAIL / NOT RUN** and a non-sensitive reference. A green build is **not** proof of customer operation, legal conformity, availability, paid support, or an independent security certification.

## External enterprise prerequisites

Commercial readiness also depends on the actual Marketplace listing, applicable terms, support ownership, published data-processing/security information, and customer-specific procurement requirements. These must be checked separately; do not infer them from this repository.
