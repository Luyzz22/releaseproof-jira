# Security Policy — ReleaseProof for Jira Cloud

## Scope

This policy covers the **ReleaseProof Atlassian Forge application** maintained in this repository. The independent website at [releaseproof.de](https://releaseproof.de/) is maintained separately.

ReleaseProof performs deterministic release-readiness analysis of Jira Cloud data. It is not a compliance certification, a release authorization, or an autonomous change tool.

## Supported versions

Security fixes target the current maintained application and the version submitted to the Atlassian Marketplace. Older versions, forks, development branches and third-party deployments are not automatically covered. Published Marketplace version and deployment state must be checked separately; this file makes no service-level or certification promise.

## Report a vulnerability responsibly

**Do not open a public issue containing a vulnerability exploit, Jira data, credentials, tenant names, screenshots of customer information, or logs with personal data.**

Prefer GitHub's **private vulnerability reporting** on this repository if the feature is enabled. If it is unavailable, start at the [official ReleaseProof website](https://releaseproof.de/) and request a confidential security contact through the published support channel. Do not attach secrets or sensitive proof to an unencrypted public form or public issue.

A useful private report includes the affected application version or commit, a minimal synthetic reproduction, expected vs. actual behaviour, severity rationale, and evidence of the relevant trust boundary. Do not test another organisation's Jira data or production tenant without authorisation.

## Relevant security boundaries

- Jira API access and permissions described in [docs/permissions.md](docs/permissions.md).
- Forge resolver validation and project-bounded scope handling.
- Scope completeness and fail-closed behaviour for partial Jira API results.
- Separation of app configuration from Jira content.
- No external remotes or LLM data transfer in the current documented application design.
- No permanent storage of full Jira issue payloads or generated reports in app storage.

A source-code statement is not proof of the configuration of a specific customer's Jira environment. Security claims must be backed by an appropriate deployed-version verification.

## Coordination

Security fixes should be reviewed and pass the repository's quality gates before Marketplace distribution. GitHub issues may be used for **non-sensitive** bugs or feature requests only.

No response-time SLA, ISO certification, SOC 2 attestation, bug bounty, or Atlassian badge is asserted by this policy.
