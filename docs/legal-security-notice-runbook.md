# ReleaseProof legal and security notice runbook

## Purpose

ReleaseProof provides an administrator-facing in-app notice surface for material
privacy, security and subprocessor information.

The notice surface is deliberately implemented without a new Forge scope,
external remote, webhook, customer-contact database, user-profile store or
acknowledgement tracking. Visibility is derived from the existing
server-calculated Jira project-administration capability exposed as
`canConfigure`.

This runbook describes the controlled operating process. It does not state that
every operational prerequisite below is already complete.

## Current active notice

The initial notice records the public ReleaseProof privacy-notice update of
29 September 2026. It tells Jira project administrators that free-text
ReleaseProof configuration is intended only for non-personal values and links to:

- https://releaseproof.de/legal/privacy

The notice requires no customer action.

## Delivery boundary

The in-app notice is visible to Jira project administrators when they open
ReleaseProof after the relevant Forge release is available to their
installation.

This is a supplemental customer-notice channel. It is not a read receipt and
does not prove that a specific administrator viewed the notice.

Do not treat this surface by itself as proof that an urgent Security Incident
notice was delivered within a contractual or statutory deadline. Security
Incident notification still requires a separately verified customer-contact
and escalation process.

Do not rely on the in-app surface as the sole contractual subprocessor notice
method until Forge Production release/update propagation to an installed
customer site has been exercised and evidenced.

## Subprocessor-change procedure

Before relying on the Forge-specific subprocessor timing model described in the
ReleaseProof DPA draft:

1. Subscribe an SBS-controlled monitored address to Atlassian Forge
   subprocessor-change notifications and retain evidence that the subscription
   is active.
2. Record the upstream notice receipt time and stated effective date.
3. Within the approved internal forwarding period, prepare the customer notice
   in English and German with:
   - the new or changed subprocessor;
   - its function;
   - the upstream effective date;
   - the applicable objection deadline;
   - the ReleaseProof contact route for a data-protection objection.
4. Update the public ReleaseProof subprocessor/DPA information where required.
5. Update the versioned in-app notice through the normal reviewed Forge release
   process.
6. Run the full ReleaseProof quality gate and Forge lint.
7. Deploy to the controlled Forge environment.
8. Verify the notice on a real Jira test site as a project administrator and
   verify that it is absent for a non-admin user.
9. Record the source SHA, Forge version, deployment timestamp and verification
   evidence.
10. Keep enough time before the upstream effective date for the customer
    objection/escalation path defined in the then-current public DPA.

If Atlassian changes its upstream notice commitment, stop relying on the
existing timing model and re-review the ReleaseProof DPA before further use.

## Security Incident procedure

The current DPA draft uses an outer limit of 48 calendar hours from SBS
awareness, without undue delay.

The in-app notice surface may supplement an incident communication, but it must
not delay or replace direct notice through a verified customer contact method.
The incident operating process must separately establish:

- monitored intake and escalation;
- the SBS awareness timestamp;
- a customer-contact route capable of timely delivery;
- the initial notice timestamp and contents;
- containment, remediation and follow-up records.

No customer email directory or incident-contact database is added by this
notice feature.

## Content and privacy rules

Every in-app notice must:

- use the centralized ReleaseProof i18n contract for en-US and de-DE;
- contain no customer Jira content, personal data, secrets or credentials;
- avoid unsupported certification, legal-compliance or Atlassian-approval
  claims;
- link only to verified public ReleaseProof or authoritative Atlassian
  resources;
- state clearly when customer action is or is not required.

## Release evidence

For each material notice release, retain:

- upstream/source notice where applicable;
- approved notice wording;
- exact source SHA;
- test and Forge lint results;
- Forge environment/version;
- deployment timestamp;
- administrator/non-administrator UI verification;
- related public legal-page version;
- objection or incident escalation record where applicable.

## Current readiness boundary

Implemented by this slice:

- administrator-gated in-app notice surface;
- bilingual ReleaseProof-owned content;
- public privacy-notice link;
- no new permission, storage or egress path;
- automated rendering/visibility tests.

Still required before the public DPA/subprocessor process is represented as
operationally complete:

- verified Atlassian subprocessor-notification subscription;
- verified Forge update propagation for the notice workflow;
- customer objection/escalation procedure exercise;
- separate timely customer-contact process for Security Incidents;
- final live Marketplace Privacy & Security wording review.
