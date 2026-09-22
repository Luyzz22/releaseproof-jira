# Analysis failure diagnostics

## Why this change exists

A repeated production analysis failure displayed `JIRA_UNAVAILABLE`, while the
Developer Console showed no logs in the selected time window. The inspected
resolver caught errors and returned a safe code without logging them. This change
adds diagnostic evidence; it does not establish or fix the production root cause.
The deployed production revision has not been verified against the repository.

## Event contract

Only failed `analyzeRelease` resolver calls emit one JSON console error:

```json
{
  "event": "releaseproof.analysis_failed",
  "code": "JIRA_UNAVAILABLE",
  "stage": "load_jql_issues",
  "httpStatus": 503
}
```

This example is synthetic. `code` and `stage` are allowlisted constants.
`httpStatus` is optional and must be an integer between 100 and 599. It is recorded
only when parsing an actual Jira response fails, including non-success responses
and unreadable JSON. Later schema validation failures and request transport
failures have no captured HTTP status. A missing status does **not** establish a
network failure, successful HTTP response, or particular upstream error.

| Stage                   | Operation                                                                   |
| ----------------------- | --------------------------------------------------------------------------- |
| `analysis`              | Resolver input/context checks or an otherwise unclassified analysis failure |
| `load_configuration`    | Read the project configuration                                              |
| `list_fields`           | Read Jira fields                                                            |
| `load_project_metadata` | Read project statuses and issue types                                       |
| `validate_jql`          | Ask Jira to parse the scope and validate its returned structure             |
| `load_version`          | Read the selected version                                                   |
| `load_version_issues`   | Search and normalize issues for VERSION_ONLY                                |
| `load_jql_issues`       | Validate scope locally, search and normalize issues for JQL_SCOPE           |
| `evaluate_release`      | Evaluate readiness and construct the response DTO                           |

An outer stage retains a more specific inner stage. Parallel operations associate
metadata with their thrown error object, not a mutable current-request variable.
Metadata lives in a WeakMap and is not included in error serialization, KVS, or
the client response. Existing error codes, retry delays and readiness checks are
preserved. Logger failure cannot replace the safe resolver response.

No exception messages, stacks, causes, request/response bodies, JQL, URLs,
headers, tokens, issue content, project identifiers or user identifiers are added
to these events. Successful analysis results are not logged. Forge supplies its
normal invocation metadata in the Developer Console. There are no new external
destinations, scopes, dependencies, settings or frontend changes.

## Validation and rollout boundary

Synthetic tests cover every external analysis step, HTTP failure status capture,
unreadable JSON, unknown thrown values, concurrent failures, logging failure,
redaction and public-response compatibility. Run the AGENTS.md checks before
handoff, including Forge lint in an authenticated Forge development environment.

This task authorizes branch preparation and tests only. No merge, deployment,
installation upgrade or production mutation is part of this change.

After separate rollout approval:

1. Review the exact candidate commit and run `npm run forge:lint` with the Forge
   CLI authenticated as an authorized app contributor.
2. Deploy only the approved commit to the explicitly approved environment. An
   existing production installation will not gain these diagnostics from a
   development deployment.
3. Repeat one analysis on the approved site, then open Developer Console Logs
   filtered to that environment, site and attempt time. Search for
   `releaseproof.analysis_failed` and inspect the stage, code, optional status and
   Forge invocation ID. Do not narrow by Error level until the event is located.
4. Use this evidence to choose a targeted fix. A missing event still requires
   checking the deployed revision, environment, time filters and log access;
   it does not identify the root cause.

The backend event uses ordinary Forge console logging; frontend-log EAP enrollment
is not required. See [Atlassian's app log guide](https://developer.atlassian.com/platform/forge/view-app-logs/).
