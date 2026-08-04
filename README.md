# ReleaseProof for Jira Cloud

ReleaseProof prüft vor einer Kundenabnahme, ob die Vorgänge einer Jira-Version vollständig dokumentiert und übergabefähig sind. Die Forge-App erzeugt einen transparenten Readiness-Score, markiert Blocker und fehlende Nachweise und liefert konkrete Behebungsmaßnahmen.

ReleaseProof ist ein deterministischer Nachweis-Check. Die App ändert keine Jira-Vorgänge, nutzt keine KI und gibt keine Audit-, Compliance- oder Abnahmegarantie.

Der Release-Scope ist explizit:

- `VERSION_ONLY` bewahrt das bisherige Verhalten und lädt nur Vorgänge der ausgewählten `fixVersion`. Die Regel `correct-fix-version` wird transparent als `NOT_APPLICABLE` ausgewiesen.
- `JQL_SCOPE` lädt einen projektgebundenen fachlichen Scope unabhängig von `fixVersion`. Fehlende oder falsche Versionszuordnungen bleiben sichtbar und werden erst in der Domain-Regel bewertet.

## Technischer Schnitt

- Jira `projectPage` mit React und Forge Custom UI.
- Forge Resolver als validierte Backend-Grenze.
- Jira Cloud REST API v3 read-only im aktuellen Benutzerkontext.
- Forge KVS nur für Projektkonfiguration und Schema-Version.
- Reine TypeScript-Domain-Regeln mit Vitest.
- Atlassian Design Tokens, Dark-Mode-Synchronisierung und barrierearme Tastatur-/Screenreader-Navigation.
- Lazy Loading für umfangreiche Analyse-, Detail- und Report-Ansichten.
- Keine externen Hosts, APIs, Datenbanken oder Telemetrie.

Die Architektur ist in [docs/architecture.md](docs/architecture.md) beschrieben. Produktgrenzen stehen in [docs/product-scope.md](docs/product-scope.md).

## Voraussetzungen

- Node.js 20.19 oder neuer; für Forge Deployment wird Node.js 22 oder 24 empfohlen.
- npm 10 oder neuer.
- Ein Atlassian-Entwicklerkonto und eine Jira-Cloud-Entwicklerinstanz.
- Forge CLI in aktueller Version.
- Jira-Projektberechtigung `Browse Projects` für die zu analysierenden Projekte.

## Lokale Einrichtung

```bash
git clone https://github.com/Luyzz22/releaseproof-jira.git
cd releaseproof-jira
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

`dist/frontend` wird generiert und nicht committed.

## Forge-Einrichtung

Das Manifest enthält die registrierte Development-App-ID. Für lokale Forge-Befehle ist weiterhin eine persönliche CLI-Authentifizierung erforderlich.

```bash
npm install -g @forge/cli@latest
forge login
```

Danach die manifestbezogene Prüfung ausführen:

```bash
forge lint
```

## Lokale Entwicklung mit Tunnel

Terminal 1 baut und serviert die Custom UI:

```bash
npm run dev
```

Terminal 2 verbindet die Forge Runtime:

```bash
forge tunnel
```

Der Tunnel benötigt eine zuvor registrierte und auf der Entwicklerinstanz installierte App.

## Deployment und Installation

```bash
npm run build
forge deploy --environment development
forge install --environment development
```

Bei der Installation die Jira-Entwicklerinstanz auswählen. Nach Änderungen an Scopes oder Manifest kann `forge install --upgrade --environment development` erforderlich sein.

## Tests und Qualitätsgates

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run build
```

Die Tests decken jede Readiness-Regel, beide Scope-Modi, alte KVS-Konfigurationen, JQL-Sicherheitsregeln, fehlende/falsche/korrekte Versionszuordnungen, Jira-Token-Pagination und den 100-Seiten-Abbruch ab. Hinzu kommen Score und Status, kombinierte Issue-Ergebnisse, Release-Aggregation, leere Scopes, offene Subtasks, blockierende Links, Reports, Application Services mit Fake-Jira und das In-Memory-Storage-Repository. Fixtures sind vollständig synthetisch.

## Verwendete Berechtigungen

- `read:jira-work`: read-only Jira-Projekte, Status, Typen, Felder, Versionen und Issues.
- `storage:app`: projektbezogene Konfiguration im installationsisolierten Forge KVS.

Endpunkte und Begründungen stehen in [docs/permissions.md](docs/permissions.md).

## Bedienung

1. ReleaseProof im Jira-Projekt öffnen.
2. `VERSION_ONLY` oder einen expliziten projektgebundenen `JQL_SCOPE` wählen und Abschlussstatus, Akzeptanzkriterien-Feld, Issue-Typen und Blocker konfigurieren.
3. Jira-Version auswählen und Analyse starten.
4. Dashboard und Evidence Details prüfen.
5. Markdown-Bericht kopieren oder die Report View drucken.

## Datenschutz und Sicherheit

- Jira-Inhalte werden nur für die aktuelle Resolver-Invocation geladen.
- Vollständige Issues und Berichte werden nicht in Forge KVS gespeichert.
- Es gibt keine externen Datenübertragungen und keine Telemetrie.
- Resolver-Payloads werden mit Zod validiert.
- Scope-JQL wird mit derselben Regelmenge im Browser und erneut in Resolver/Application/Jira-Adapter validiert; der Server ist maßgeblich.
- Fehlerantworten enthalten keine Upstream-Bodies, Stack Traces oder Jira-Inhalte.

## Bekannte Einschränkungen

- Sehr große Releases können an Forge-Invocation- oder Jira-Rate-Limits stoßen; eine Async-Queue ist bewusst nicht Teil von v0.1.
- ReleaseProof bricht nach 100 REST-Seiten bewusst mit `RESULT_LIMIT_EXCEEDED` ab, statt einen stillschweigend unvollständigen Bericht auszugeben.
- Explizite Scope-JQLs sind auf 2.000 Zeichen und konjunktive, mit `project = PROJEKTKEY` beginnende Ausdrücke begrenzt. `OR` und `fixVersion` werden bewusst abgelehnt, damit die Projekt- und Prüfunabhängigkeit nicht umgangen werden kann.
- Blockierende Links werden anhand der Linkrichtung und normalisierter Blocker-/Abhängigkeitsbeschreibungen erkannt. Kundenspezifische Linknamen sind noch nicht konfigurierbar.
- Die Freigabemarkierung ist in v0.1 ein Jira-Label.
- Es gibt keine persistierte Analysehistorie und keine PDF-Erzeugung.
- End-to-End-Verifikation in Jira benötigt Forge Login, Registrierung, Deployment und Installation auf einer Entwicklerinstanz.
- `npm audit --omit=dev` meldet aktuell fünf High-Einträge in Forge-Transitivabhängigkeiten: `brace-expansion` und `fast-uri` über `@forge/manifest` sowie `linkify-it` über `@forge/bridge` → `@atlaskit/adf-schema`. ReleaseProof ruft diese Pakete nicht direkt auf. Ein Audit-Fix wurde in SCRUM-7 bis SCRUM-10 nicht angewendet, weil er den geprüften Dependency-Lock außerhalb des Bug-Scopes verändert und der vollständige Fix die Forge Bridge auf eine ältere Major-Linie zurückstufen würde. Die Forge-Abhängigkeitskette benötigt einen separaten Dependency-Review.
