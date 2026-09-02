# Architektur

## Komponenten

### Custom UI

React rendert alle Produktansichten in einer Jira-Projektseite. Die UI kennt keine Jira-REST-Details. Sie nutzt ausschließlich typisierte Resolver-Aufrufe über `@forge/bridge`.

Die Custom UI aktiviert `view.theme.enable()` und verwendet Atlassian Design Tokens mit lokalen Fallbacks. Damit folgt sie dem Jira-Farbmodus einschließlich Dark Mode. Schwere Ansichten werden über `React.lazy` erst bei Bedarf geladen; Fokusmanagement, Skip-Link, Live-Regions, Tabellenbeschriftungen und Reduced-Motion-Regeln sichern die Tastatur- und Screenreader-Nutzung ab.

### Resolver

Der Resolver ist die Trust Boundary. Er liest den Forge-Projektkontext, validiert Payloads mit Zod, erstellt konkrete Adapter und übersetzt erwartbare Infrastrukturfehler in sichere Fehlercodes.

### Application Layer

Use Cases orchestrieren Ports:

- `ProjectConfigRepository`
- `JiraGateway`
- Uhr (`Clock`) für deterministische Tests

Sie enthalten keine Forge-Imports.

Der Analyze-Use-Case trennt Scope-Bestimmung und Versionsprüfung:

- `VERSION_ONLY` ruft die bestehende, technisch erzeugte Versions-JQL auf.
- `JQL_SCOPE` reicht den gespeicherten und serverseitig validierten Ausdruck unverändert an den Jira-Adapter weiter.
- In beiden Fällen filtert der Use Case anschließend ausschließlich die konfigurierten Issue-Typen; die Domain-Regel entscheidet erst danach über die Versionszuordnung.

### Domain Layer

Modelle, Regeln und Aggregation sind reine TypeScript-Module. Regeln verändern ihre Eingaben nicht und führen weder I/O noch Logging aus.

### Infrastructure Layer

- Jira-Adapter: `@forge/api`, `api.asUser().requestJira(route...)`, REST v3, Pagination und ADF-Normalisierung. Projektadmin-Autorisierung verwendet die Forge Authorize API für den aktuellen Nutzer und bestätigt positive Grants zusätzlich über einen read-only Jira-Endpunkt, der für exakt das Zielprojekt `Administer Projects` verlangt.
- Storage-Adapter: `@forge/kvs`, installationsisolierte Schlüssel `project-config:<projectId>` und `schema-version`.

## Datenfluss

```text
User -> Jira projectPage -> Custom UI -> Resolver -> Use Case
                                                |-> Jira REST v3 (asUser)
                                                |-> Forge KVS
                                  Domain Engine <-|
User <- Dashboard/Report <- typed result <-------|
```

Jira-Issues existieren nur während der Resolver-Invocation und in der UI-Lebensdauer. Sie werden weder in KVS noch in Logs geschrieben.

## Abhängigkeiten

- Runtime: `@forge/api`, `@forge/kvs`, `@forge/resolver`, `zod`.
- Frontend: `react`, `react-dom`, `@forge/bridge`.
- Build/Test: TypeScript, Vite, Vitest, ESLint, Prettier.
- Keine externen Runtime-Services oder Remote-Hosts.

## Speicherkonzept

KVS speichert pro Installation:

- `schema-version`: technische Versionsnummer.
- `project-config:<projectId>`: validierte `ProjectConfig` inklusive Erstellungs- und Änderungszeit.

Keine Issue-Beschreibungen, Kommentare, Reports, Analyseläufe oder Benutzerkennungen werden gespeichert.

Schema-Version 2 ergänzt `releaseScopeMode` und optional `releaseScopeJql`. Datensätze aus Schema-Version 1 werden beim Lesen ohne Schreibmigration als `VERSION_ONLY` normalisiert. Erst ein späteres bewusstes Speichern schreibt das aktuelle Format.

## Sicherheitsgrenzen

- Forge übernimmt Authentifizierung und Installationsisolation.
- Jira-Anfragen laufen `asUser`; Sichtbarkeit und Projektberechtigungen des Nutzers bleiben wirksam.
- Der Bootstrap ermittelt die Projektadmin-Berechtigung serverseitig als AND-Bedingung: Ein strikt gemappter positiver Forge-Authorize-Grant für die aktuelle numerische Jira-`projectId` muss zusätzlich durch einen erfolgreichen `api.asUser()`-Read von `GET /rest/api/3/project/{projectId}/permissionscheme` bestätigt werden. Dieser Jira-Endpunkt verlangt für genau das Projekt `Administer Projects` oder globales Jira-Admin. Schlägt eine der beiden Prüfungen technisch oder strukturell fehl, wird `canConfigure: false` geliefert, damit bestehende Konfigurationen, Analysen und Reports read-only erreichbar bleiben.
- Der Save-Use-Case prüft `ADMINISTER_PROJECTS` unabhängig davon erneut serverseitig als erste Operation über dieselbe duale Grenze. Der Mapper akzeptiert strikt sowohl die von Atlassian dokumentierte Einzelobjekt-Form als auch die im Development-Runtime-E2E tatsächlich beobachtete Singleton-Array-Form. Der Grant muss `ADMINISTER_PROJECTS` enthalten; ein vorhandener `issues`-Kontext ist nur als leeres Array zulässig. `projects: []` ergibt `false`; exakt die erwartete numerische Projekt-ID ist nur ein notwendiges Zwischensignal. Erst wenn zusätzlich der projektgebundene Admin-Read mit `api.asUser()` HTTP 200 liefert, ergibt die Gesamtprüfung `true`; 401/403 ergeben `false`, andere Statuscodes werden fail-closed als Jira-Verfügbarkeitsfehler behandelt. Ohne nachgewiesene Projektadministrationsberechtigung erfolgen weder Metadatenvalidierung noch KVS-Read/Write.
- Nicht-Administratoren können eine bestehende Konfiguration read-only einsehen sowie Analysen und Reports ausführen.
- Resolver-Payloads sind nicht vertrauenswürdig und werden validiert.
- Technisch erzeugte Versions-JQL enthält nur validierte Jira-IDs und Projektkeys.
- Explizite Scope-JQL ist höchstens 2.000 Zeichen lang, muss mit der aktuellen Projektbegrenzung beginnen und darf weder `fixVersion`, ein ausbrechendes `OR` noch eine zweite Projektreferenz enthalten.
- Browser und Resolver verwenden dasselbe Zod-Schema; Application und Jira-Adapter validieren den gespeicherten JQL-Scope zusätzlich vor der Ausführung. Ungültige Eingaben werden nicht korrigiert oder umgeschrieben.
- ADF wird nur zu Plaintext traversiert; Markup oder eingebettete Anweisungen werden nicht ausgeführt.
- Fehlerantworten enthalten keinen Stack Trace und keine Upstream-Bodies.
- Das Manifest erlaubt keine externen Fetch-, Image-, Script- oder Style-Hosts.
- Jira-Suchparameter werden auch im Adapter erneut validiert, bevor JQL erzeugt wird.
- ADF-Textnormalisierung verarbeitet höchstens 10.000 Knoten und 50.000 Zeichen je Feld.
- Paginierte Lesevorgänge enden nicht stillschweigend: Nach 100 Seiten wird eine sichere `RESULT_LIMIT_EXCEEDED`-Antwort erzeugt.
- Eine React Error Boundary stellt eine inhaltsfreie Wiederherstellungsansicht bereit und protokolliert bewusst keine Props oder Jira-Inhalte.

## Betriebsgrenzen

- REST-Seitengröße: 100 Einträge.
- Maximale synchrone Pagination: 100 Seiten je Ressource.
- Maximale Scope-JQL-Länge: 2.000 Zeichen.
- Maximale normalisierte Textlänge: 50.000 Zeichen je Jira-Rich-Text-Feld.
- Bei Überschreitung wird keine unvollständige Readiness-Aussage erzeugt; die Analyse bricht mit einer verständlichen Scope-Meldung ab.

## Forge-spezifische Abweichungen von Web-SaaS

- Kein Next.js, eigener Server, REST-Backend oder Datenbank-Migrationsdienst.
- Frontend und Resolver werden separat gebaut, aber gemeinsam durch Forge deployed.
- Projektkontext kommt von Forge statt aus eigener Auth-/Tenant-Middleware.
- Storage ist installationsisoliertes KVS statt einer tenantfähigen SQL-Datenbank.
- Die Jira-Leseoperationen sind auf Forge-Invocation- und Jira-Rate-Limits abgestimmt.
