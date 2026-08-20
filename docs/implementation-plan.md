# Implementierungsplan

## Ziel

Ein funktionsfähiger vertikaler Schnitt einer Forge-only Jira-Cloud-App: Projektkonfiguration speichern, Jira-Version auswählen, Issues der Version laden, deterministische Readiness-Regeln ausführen und Dashboard, Evidence-Detail sowie kopierbaren Bericht darstellen.

## Zielarchitektur

```text
Jira-Projektseite (Custom UI / React)
            |
      @forge/bridge invoke
            |
     Forge Resolver + Zod
            |
   Application Use Cases / Ports
       |                 |
Pure Domain Engine   Infrastructure
                     |           |
              Jira REST v3   Forge KVS
```

Die UI wird als statische Custom-UI-Ressource von Forge gehostet. Resolver laufen in der Forge Runtime. Jira-Inhalte verlassen die Atlassian-Plattform nicht und werden nicht dauerhaft gespeichert.

## Module

- `src/domain/models`: Konfiguration, Jira-Sichtmodell, Evidence- und Ergebnis-Typen.
- `src/domain/rules`: sieben einzeln testbare Readiness-Regeln.
- `src/domain/services`: Issue-Auswertung, Score und Release-Aggregation.
- `src/application`: Bootstrap/Metadaten, Konfiguration laden/speichern und Release analysieren.
- `src/infrastructure/jira`: REST-v3-Adapter, ADF-Textnormalisierung, Pagination und sichere Fehlerabbildung.
- `src/infrastructure/storage`: KVS-Repository und In-Memory-Testimplementierung.
- `src/resolvers`: validierte, typisierte Grenze zwischen Custom UI und Application Layer.
- `src/frontend`: deutsche React-Oberfläche mit Empty State, Konfiguration, Release-Auswahl, Dashboard, Detail und Bericht.
- `src/shared`: Resolver-Vertrag, Validierung und sichere Fehlercodes.

## Datenfluss

1. Die Jira-Projektseite liefert Projektkontext an den Resolver.
2. `getBootstrap` lädt Projektdaten, Status/Issue-Typen, Felder, Versionen und optional die gespeicherte Konfiguration.
3. `saveProjectConfig` validiert IDs, Optionen und Marker und schreibt ausschließlich `ProjectConfig` in KVS.
4. `analyzeRelease` lädt die Konfiguration und Jira-Issues der Version seitenweise.
5. Der Jira-Adapter normalisiert REST-v3/ADF-Daten zu `ReleaseIssue`.
6. Reine Domain-Regeln erzeugen Evidence Items; Services berechnen Issue- und Release-Status sowie Score.
7. Das Ergebnis wird nur an die aktuelle UI-Antwort zurückgegeben, nicht gespeichert.

## Benötigte Jira-Berechtigungen

- Forge-Scope `read:jira-work`: read-only Zugriff auf sichtbare Projekte, Status, Issue-Typen, Felder, Versionen und Issues.
- Forge-Scope `storage:app`: KVS-Zugriff auf installationsisolierte Projektkonfiguration.
- Jira-Projektberechtigung `Browse Projects`: Jira filtert die Ergebnisse im aktuellen Benutzerkontext.

Details und Endpunkte stehen in `docs/permissions.md`.

## Risiken

- Jira-Feldwerte können Strings, Zahlen, ADF-Dokumente oder unbekannte Strukturen enthalten; die Normalisierung muss defensiv sein.
- Enhanced JQL Search verwendet `nextPageToken` statt klassischer `startAt`-Pagination.
- Linktypen sind administrativ benennbar; blockierende Links werden über normalisierte inward/outward-Beschreibungen erkannt und konservativ als ungelöst behandelt.
- Große Releases sind durch Forge-Invocation-Limits begrenzt; der Schnitt paginiert, führt aber absichtlich keine Async-Queue ein.
- Ein echter Forge-Deploy benötigt eine registrierte App-ID und menschlichen Login.

## Umsetzungsreihenfolge

1. Repository und offizielle Forge-/Jira-Dokumentation prüfen.
2. Governance-, Scope-, Architektur- und Produktdokumente anlegen.
3. Toolchain, Manifest und Custom-UI-Build konfigurieren.
4. Domain-Modelle, Regeln, Score und Aggregation implementieren und testen.
5. Application Ports und Use Cases mit Fakes implementieren und testen.
6. Jira- und KVS-Adapter mit defensiver Normalisierung implementieren.
7. Resolver-Vertrag und Runtime-Validierung implementieren.
8. Custom UI und alle Zustände implementieren.
9. Vollständige Quality Gates ausführen und Fehler beheben.

## Teststrategie

- Unit-Tests pro Regel einschließlich fehlender und unerwarteter Werte.
- Score- und Statuslogik auf Issue- und Release-Ebene.
- Leere Releases und optionale Regeln.
- Application-Tests mit Fake-Jira-Adapter.
- Repository-Vertragstests mit In-Memory-Implementierung.
- Adaptertests für ADF, Pagination, Rate Limits, Berechtigungsfehler und gelöschte Versionen.
- Produktionsbuild der Custom UI und Typecheck aller Backend-/Shared-Module.
- Keine echten Jira-Inhalte in Fixtures oder Snapshots.

## Primärquellen

- [Jira project page module](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-project-page/)
- [Custom UI invoke bridge](https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/invoke/)
- [Forge resolver](https://developer.atlassian.com/platform/forge/runtime-reference/forge-resolver/)
- [Forge KVS](https://developer.atlassian.com/platform/forge/storage-reference/kvs-api/)
- [Jira Cloud REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro)
- [Enhanced JQL search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/)
