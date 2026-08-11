# Forge-Berechtigungen

## `read:jira-work`

Read-only Classic Scope, von Atlassian für die verwendeten Jira-REST-v3-Operationen empfohlen. Er ist erforderlich für:

| Zweck                                    | Endpunkt                                            |
| ---------------------------------------- | --------------------------------------------------- |
| Sichtbare Projekte laden                 | `GET /rest/api/3/project/search`                    |
| Projekt und Issue-Typen/Status laden     | `GET /rest/api/3/project/{projectIdOrKey}/statuses` |
| Verfügbare Felder laden                  | `GET /rest/api/3/field/search`                      |
| Projektversionen laden                   | `GET /rest/api/3/project/{projectIdOrKey}/version`  |
| Version validieren                       | `GET /rest/api/3/version/{id}`                      |
| Scope-Issues und benötigte Details laden | `POST /rest/api/3/search/jql`                       |
| Projektgebundene JQL strikt validieren   | `POST /rest/api/3/jql/parse`                        |

Die Requests laufen mit `api.asUser()`. Zusätzlich muss der Nutzer im jeweiligen Jira-Projekt `Browse Projects` besitzen; Issue-Security bleibt wirksam.

Der Suchendpunkt ist für beide Scope-Modi identisch. `VERSION_ONLY` verwendet serverseitig erzeugtes JQL; `JQL_SCOPE` verwendet den unveränderten, projektgebunden validierten Ausdruck. Zusätzlich prüft `POST /rest/api/3/jql/parse` explizite JQL vor Persistenz und erneut vor Analyse mit `validation=strict`. Der Parser-Aufruf validiert ausschließlich die Abfrage; er verändert keine Jira-Daten. Es entstehen keine Jira-Schreiboperationen, keine externen Remotes und keine zusätzlichen Scopes.

## `storage:app`

Erforderlich für `@forge/kvs`. Gespeichert werden ausschließlich:

- technische Schema-Version;
- validierte Projektkonfiguration.

Es werden keine vollständigen Issues, Analysen, Reports oder personenbezogenen Benutzerprofile gespeichert.

## Nicht angeforderte Berechtigungen

- Keine Write-, Admin-, User-Profile-, Attachment- oder Comment-Scopes.
- Kein `read:jira-user`, da ReleaseProof keine Benutzerprofile benötigt.
- Keine externen Fetch-Berechtigungen und keine Remote-Backends.

## Primärquellen

- [Forge KVS scope requirement](https://developer.atlassian.com/platform/forge/storage-reference/kvs-api/)
- [Jira project APIs and scopes](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-projects/)
- [Jira project versions](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-project-versions/)
- [Jira issue fields](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-fields/)
- [Jira issue search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/)
- [Jira JQL APIs](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-jql/)
