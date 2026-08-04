# ReleaseProof Engineering Rules

## Product boundary

ReleaseProof is a Jira Cloud release-readiness assistant for software agencies. It reads Jira data, evaluates deterministic evidence rules and presents a reviewable report. It is not a general SaaS platform, an AI system, a project-management suite or a compliance guarantee.

## Architecture rules

- Keep `domain` free of Forge, React and network dependencies.
- Keep application use cases dependent on ports, never concrete Jira or KVS clients.
- Route all Jira REST calls through `src/infrastructure/jira` and all persistence through `src/infrastructure/storage`.
- The Custom UI may call Forge resolvers only. It must not call Jira REST endpoints directly.
- Validate every resolver payload at runtime before executing a use case.
- Keep release-scope determination separate from `correct-fix-version`: `VERSION_ONLY` makes that rule `NOT_APPLICABLE`; `JQL_SCOPE` keeps it active.
- Validate explicit scope JQL on the client and again on the server. It must be project-bound, must not contain `fixVersion` or an escaping `OR`, and must never be silently rewritten.
- Use Jira Cloud REST API v3 only and document endpoint changes in `docs/learning-log.md`.
- Persist only project configuration, the storage schema version and non-personal technical settings. Never persist full Jira issues or reports.
- Normalize legacy project configurations without scope fields to `VERSION_ONLY`; never use a destructive KVS migration for this compatibility path.
- Do not add external remotes, egress hosts, telemetry, webhooks or external databases.
- Request only `read:jira-work` and `storage:app` unless an ADR and `docs/permissions.md` justify a change.

## TypeScript and coding conventions

- TypeScript strict mode is mandatory. Avoid `any`; narrow `unknown` at boundaries.
- Domain rules are deterministic pure functions with stable `ruleId` values.
- Prefer small modules, explicit return types at public boundaries and immutable inputs.
- All user-facing strings are German.
- Do not log Jira descriptions, comments, acceptance criteria or complete issue payloads.
- Format with Prettier and lint with ESLint. Do not leave critical TODOs in production paths.

## Test commands

Run after each completed implementation section and before handoff:

```bash
npm run typecheck
npm run lint
npm run test
npm run format:check
npm run build
```

Run `npm run forge:lint` after a real Forge app ID has been registered.

## Security rules

- Never commit secrets, API tokens, real customer data or production Jira exports.
- Use synthetic fixtures only.
- Escape or structurally encode all JQL values; validate project keys, Jira IDs and field IDs.
- Show safe user errors without internal stack traces or raw upstream response bodies.
- Treat Jira rich-text documents as untrusted data and extract plain text without executing markup.
- Do not transfer Jira content to any non-Atlassian host.

## Forbidden extensions

Do not implement GitHub/Bitbucket integration, AI or LLM calls, semantic extraction, PDF generation, email, webhooks, external storage, custom authentication, billing, licensing, organization management, SSO or generic project-management features.

## Definition of Done

- The requested vertical slice works through typed resolver boundaries.
- Every readiness rule and aggregation path is covered by deterministic tests.
- Empty, unauthorized, missing-field, deleted-version and rate-limit states are understandable.
- Scopes and REST endpoints are documented.
- Typecheck, lint, format check, tests and production build pass.
- The manifest has no external hosts and dependencies are minimal.
- Remaining Forge registration, deployment or installation work is documented as a precise manual step.
