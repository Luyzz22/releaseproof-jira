# Forge-Berechtigungen

## `read:jira-work`

Read-only Classic Scope, von Atlassian für die verwendeten Jira-REST-v3-Operationen empfohlen. Er ist erforderlich für:

| Zweck                                    | Endpunkt                                            |
| ---------------------------------------- | --------------------------------------------------- |
| Sichtbare Projekte laden                 | `GET /rest/api/3/project/search`                    |
| Projektstammdaten laden                  | `GET /rest/api/3/project/{projectIdOrKey}`          |
| Issue-Typen und Status laden             | `GET /rest/api/3/project/{projectIdOrKey}/statuses` |
| Verfügbare Felder laden                  | `GET /rest/api/3/field/search`                      |
| Projektversionen laden                   | `GET /rest/api/3/project/{projectIdOrKey}/version`  |
| Version validieren                       | `GET /rest/api/3/version/{id}`                      |
| Scope-Issues und benötigte Details laden | `POST /rest/api/3/search/jql`                       |
| Projektgebundene JQL strikt validieren   | `POST /rest/api/3/jql/parse`                        |
| Projekt-Admin-Recht für Konfiguration    | `GET /rest/api/3/mypermissions`                     |

Die Requests laufen mit `api.asUser()`. Zusätzlich muss der Nutzer im jeweiligen Jira-Projekt `Browse Projects` besitzen; Issue-Security bleibt wirksam.

Zum Speichern oder Reparieren der ReleaseProof-Projektkonfiguration muss der aktuelle Nutzer im betroffenen Projekt `ADMINISTER_PROJECTS` besitzen. ReleaseProof prüft dies mit `GET /rest/api/3/mypermissions?projectKey=...&permissions=ADMINISTER_PROJECTS` serverseitig vor jedem KVS-Schreibpfad. Der Endpunkt ist read-only und wird durch den bestehenden Classic Scope `read:jira-work` abgedeckt; es wird kein zusätzlicher Admin- oder Write-Scope angefordert. Fehlende oder strukturell unerwartete Permission-Antworten werden fail-closed behandelt.

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
- [Jira permissions / Get my permissions](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-permissions/)
