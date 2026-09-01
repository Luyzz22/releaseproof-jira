# Learning Log

## 2026-07-11 — Repository- und Umgebungsanalyse

- Das GitHub-Repository `Luyzz22/releaseproof-jira` bestand nur aus einer README und wurde separat vom vorhandenen NormPilot-Workspace geklont.
- Node.js 20 und npm/pnpm sind vorhanden; die Forge CLI ist nicht global installiert.
- Ein eigener Branch `codex/releaseproof-vertical-slice` schützt den leeren Hauptbranch während der Implementierung.

## 2026-07-11 — Forge-Grundlagen

- `jira:projectPage` unterstützt Custom UI über `resource` und einen Forge-Resolver über `resolver.function`.
- Custom UI ruft Backend-Funktionen mit `@forge/bridge` `invoke`/`makeInvoke` auf.
- Jira-REST-Zugriffe gehören trotz verfügbarer Client-Bridge in den Resolver, weil die Produktarchitektur eine zentrale Adapter- und Validierungsgrenze verlangt.
- Neue Forge-Storage-Entwicklung soll `@forge/kvs` statt des Legacy-Storage-Moduls in `@forge/api` verwenden; dafür ist `storage:app` erforderlich.

## 2026-07-11 — Jira REST v3

- Jira REST v3 liefert `description` und mehrzeilige Custom Fields als Atlassian Document Format (ADF).
- Die aktuelle Enhanced Search API ist `POST /rest/api/3/search/jql` und paginiert mit `nextPageToken`.
- Projektversionen haben einen paginierten Endpunkt mit singularer Route `/project/{projectIdOrKey}/version`; `/versions` ist die nicht paginierte Alternative.
- Projektstammdaten werden zusätzlich über `GET /rest/api/3/project/{projectIdOrKey}` geladen; der Aufruf läuft wie die übrigen Jira-Lesezugriffe mit `asUser` und dem Classic Scope `read:jira-work`.
- Projektstatus werden nach Issue-Typ gruppiert geliefert. Diese Antwort kann Status und relevante Issue-Typen ohne zusätzlichen Admin-Scope bereitstellen.
- Atlassian empfiehlt für alle verwendeten Read-Endpunkte den Classic Scope `read:jira-work`; zusätzlich benötigt KVS `storage:app`.

## Entscheidungen

- Forge-only und `asUser` für Jira-Zugriff, damit Jira-Sichtbarkeit nicht durch App-Systemzugriff ausgeweitet wird.
- Nur zwei Scopes: `read:jira-work` und `storage:app`.
- Keine Speicherung von Analyseergebnissen oder Jira-Inhalten.
- Blockierende Issue-Links werden anhand normalisierter Linktypen erkannt; die genaue Heuristik wird getestet und dokumentiert.

## Fehler und Ursachen

- Beim ersten Branch-Wechsel wurde versehentlich das Git-Repository im Home-Verzeichnis angesprochen. Es wurden dort keine Dateien bearbeitet oder committed; der Branch wurde sofort wieder auf `main` gestellt. Seitdem werden Git-Befehle mit eindeutigem ReleaseProof-Arbeitsverzeichnis ausgeführt.
- Die npm-Registry lieferte während der ersten Installation mehrere beschädigte Tarballs; npm meldete dennoch Exit 0, obwohl vier direkte Pakete fehlten. Der Dependency-Baum wurde deshalb explizit mit `npm ls` geprüft und die fehlenden Pakete anschließend unter Node.js 20 erneut installiert.
- Der initiale Vitest-Lauf übernahm den Vite-Root `src/frontend` und fand die Repository-Tests nicht. Eine separate `vitest.config.ts` setzt den Test-Root und das synthetische Testverzeichnis explizit.
- Der erste UI-Typecheck zeigte, dass die gemeinsame `Panel`-Komponente keine semantischen HTML-Attribute weiterreichte. Sie verwendet nun die nativen Section-Props und unterstützt damit unter anderem `role="alert"`.
- `forge lint` lässt sich mit Forge CLI 13.1.0 erst nach Atlassian-Login ausführen. Die CLI-Telemetrie wurde deaktiviert; die lokale Prüfung stoppt ausschließlich an der fehlenden Authentifizierung.
- `npm audit --omit=dev` meldet drei High-Einträge derselben transitiven Kette `@forge/bridge` → `@atlaskit/adf-schema` → `linkify-it` (GHSA-22p9-wv53-3rq4). Die installierte Forge Bridge 6.1.0 ist aktuell, `linkify-it` bietet noch keine gefixte Release-Version, und `npm audit fix --force` würde auf Forge Bridge 5.8.0 zurückstufen. Deshalb erfolgt kein riskanter Zwangs-Downgrade; der Upstream muss bei jedem Upgrade erneut geprüft werden.

## 2026-07-11 — Implementierter Schnitt

- Sieben reine Regeln erzeugen jeweils ein stabiles Evidence Item mit Erklärung, Quelle und Behebung.
- Score-Gewichte sind als explizites Objekt gekapselt und können später ohne Regeländerung konfigurierbar gemacht werden.
- Der Jira-Adapter nutzt ausschließlich REST v3, serverseitige `asUser`-Requests und tokenbasierte Enhanced-Search-Pagination.
- Die Custom UI deckt Empty State, Konfiguration, Release-Auswahl, Dashboard, Evidence Detail und Report View ab.
- Freigabemarkierungen werden im ersten Schnitt bewusst als Jira-Labels modelliert.

## Marketplace-relevante Erkenntnisse

- Ohne externe Hosts und mit Forge Hosted Storage/Compute bleibt eine spätere „Runs on Atlassian“-Bewertung grundsätzlich möglich; die tatsächliche Eligibility muss nach Registrierung mit der Forge CLI geprüft werden.
- Scope-Änderungen können eine Upgrade-/Consent-Auswirkung haben und benötigen deshalb Dokumentation und Review.

## Offene Lernfragen

- Reale Invocation-Dauer und Jira-Rate-Limit-Verhalten für sehr große Releases müssen nach Installation auf einer Entwicklerinstanz gemessen werden.
- Kundenspezifische Benennungen von blockierenden Linktypen benötigen gegebenenfalls später eine explizite Konfiguration; das gehört nicht in diesen Scope.

## 2026-07-12 — High-Standard-Härtung

- Forge Custom UI synchronisiert den aktiven Jira-Farbmodus offiziell über `view.theme.enable()`; die CSS-Schicht nutzt Atlassian Design Tokens mit sicheren Fallbacks.
- Route-Level Code Splitting reduziert den initialen React-Bundle-Pfad. Konfiguration, Dashboard, Evidence Detail und Report werden erst bei Bedarf geladen.
- Fehler aus Save/Analyze verdrängen nicht mehr die komplette Anwendung. Die relevante Ansicht und ihre Eingaben bleiben erhalten; nur Bootstrap-Fehler nutzen den vollständigen Error State.
- Eine Error Boundary fängt unerwartete Renderfehler ohne Logging von Props oder Jira-Inhalten ab.
- Fokusmanagement, Skip-Link, Live-Regions, Tabellen-Captions, sichtbare Focus-Ringe, Reduced Motion und Forced Colors verbessern WCAG-nahe Bedienbarkeit.
- Jira-JQL wird im Infrastrukturadapter erneut validiert. Unerwartete REST-Antwortformen und überschrittene Pagination-Limits führen zu sicheren Fehlern statt stiller Teilresultate.
- ADF-Normalisierung ist auf 10.000 Knoten und 50.000 Zeichen begrenzt, um pathologische Dokumentstrukturen kontrolliert zu verarbeiten.
- TypeScript nutzt zusätzlich `exactOptionalPropertyTypes`, `noImplicitReturns`, `noUncheckedSideEffectImports` und `verbatimModuleSyntax`; ESLint prüft Hooks inklusive Dependency Arrays.

## 2026-07-27 — Scope-Bestimmung von Versionsprüfung getrennt

- Der False-Positive aus SCRUM-7 entstand, weil `fixVersion` gleichzeitig fachlichen Scope und zu prüfende Evidence bestimmte. Ein Vorgang ohne Version konnte die Regelengine dadurch nie erreichen.
- `VERSION_ONLY` bleibt der kompatible Standard für bestehende KVS-Datensätze. Die Versionsregel ist dort jetzt ehrlich `NOT_APPLICABLE`.
- `JQL_SCOPE` lädt einen expliziten fachlichen Scope unverändert über Enhanced JQL Search. Fehlende und falsche Versionen bleiben in der Evidence-Matrix und erzeugen `INCOMPLETE`.
- Ein kleiner, gemeinsamer JQL-Validator verlangt `project = <aktuelles Projekt>` am Anfang, verbietet `fixVersion`, `OR` und weitere Projektreferenzen und begrenzt die Eingabe auf 2.000 Zeichen. Diese bewusste konjunktive Teilmenge ist leichter auditierbar als eine unvollständige Eigenimplementierung der gesamten JQL-Grammatik.
- Die Jira-Issue-Pagination wurde als injizierbarer Collector gekapselt. Dadurch testen synthetische Fixtures sowohl mehrere `nextPageToken`-Seiten als auch den harten Abbruch nach 100 Seiten, während der produktive Adapter weiterhin ausschließlich `api.asUser().requestJira` verwendet.
- KVS-Schema-Version 2 führt die Scope-Felder ein. Alte Datensätze werden nur beim Lesen normalisiert; es gibt keine destruktive oder automatische Schreibmigration.
- Dashboard, Evidence Detail, Markdown- und Druckbericht leiten Scope-Text aus derselben kanonischen Ergebnisstruktur ab.
- Der abschließende Lauf von `npm audit --omit=dev` meldet fünf High-Einträge: `brace-expansion` und `fast-uri` über `@forge/manifest` sowie zwei Advisory-IDs für `linkify-it` über `@forge/bridge`. Weil SCRUM-7 bis SCRUM-10 keine Dependency-Migration autorisieren und der vollständige Force-Fix die Forge Bridge herabstuft, bleibt die Lockdatei unverändert und das Thema wird als separater Dependency-Review ausgewiesen.

## 2026-08-10 — Strikte Jira-JQL-Validierung

- Explizite projektgebundene JQL wird zusätzlich zur kontrollierten lokalen Grammatik über `POST /rest/api/3/jql/parse?validation=strict` im aktuellen Benutzerkontext geprüft.
- Der Parser-Aufruf dient ausschließlich der Validierung vor Persistenz und erneut vor Analyse; er führt keine Jira-Schreiboperation aus und benötigt keinen zusätzlichen Scope über `read:jira-work` hinaus.
- Die Parser-Antwort wird fail-closed ausgewertet: Genau ein Query-Ergebnis ist erforderlich; Fehler machen die JQL ungültig, und ein fehlerfreies Ergebnis wird nur mit nicht leerem Query-Text und vorhandener Parse-Struktur als Erfolg akzeptiert.
- Unvollständige oder unerwartete 200-Antworten werden als Jira-Verfügbarkeitsfehler behandelt, statt eine nicht nachweislich validierte JQL zu persistieren.
- Es wurden keine externen Remotes, zusätzlichen Egress-Ziele oder neuen Berechtigungen eingeführt.

## 2026-08-30 — Projektgebundene Konfigurationsautorisation

- Für die Autorisierung von ReleaseProof-Projektkonfigurationen wird neu ausschließlich read-only `GET /rest/api/3/mypermissions?projectKey=<PROJECT_KEY>&permissions=ADMINISTER_PROJECTS` verwendet.
- Der Request läuft mit `api.asUser()` im aktuellen Jira-Projektkontext. Er benötigt im verwendeten Classic-Scope-Modell weiterhin nur `read:jira-work`; Manifest und Consent-Surface bleiben unverändert.
- Die Antwort wird an der Write-Boundary fail-closed ausgewertet: `permissions.ADMINISTER_PROJECTS` muss den Key `ADMINISTER_PROJECTS`, den Typ `PROJECT` und ein boolesches `havePermission` enthalten. Fehlende oder abweichende Werte autorisieren niemals einen KVS-Schreibzugriff.
- `saveProjectConfig` führt die Projekt-Admin-Prüfung als erste serverseitige Operation aus. Bei fehlender Berechtigung erfolgen weder Jira-Metadatenvalidierung noch KVS-Read/Write.
- Der Bootstrap verwendet dieselbe Permission-Quelle nur als Präsentationssignal `canConfigure`. Schlägt die Permission-Abfrage dort technisch oder strukturell fehl, wird `canConfigure: false` geliefert, damit bestehende Konfigurationen, Analysen und Reports read-only nutzbar bleiben. Der Save-Pfad reautorisiert unabhängig davon strikt.

## 2026-09-01 — Runtime-Abgleich der Projektadmin-Autorisierung

- Der Development-E2E auf Forge Development 2.5.0 zeigte einen Widerspruch zwischen dem serverseitigen ReleaseProof-Bootstrap und Jira selbst: Für denselben Nicht-Admin meldete der Browser-Endpunkt `GET /rest/api/3/mypermissions?projectKey=SCRUM&permissions=ADMINISTER_PROJECTS` eindeutig `havePermission: false`, während die über `api.asUser()` im Resolver aufgerufene Variante zu einem editierbaren ReleaseProof-Konfigurationszustand führte.
- Weil diese Abweichung eine Write-Authorization-Boundary betrifft, wird `GET /mypermissions` nicht länger als serverseitige ReleaseProof-Autorisierungsquelle verwendet.
- ReleaseProof verwendet stattdessen die Forge Authorize API. `authorize().onJira(...)` prüft die Berechtigung des aktuellen Nutzers über Jiras Bulk-Permissions-Mechanismus und wird an die numerische `projectId` aus dem validierten Forge-Projektkontext gebunden.
- Die Save-Boundary bleibt die maßgebliche Trust Boundary: Nur ein `ADMINISTER_PROJECTS`-Grant für exakt die erwartete Projekt-ID autorisiert weitere Jira-Metadaten- oder KVS-Zugriffe. Fehlende, fremde, doppelte oder strukturell unerwartete Grants werden fail-closed behandelt.
- Der Bootstrap nutzt dieselbe Quelle nur für `canConfigure`; technische Fehler degradieren dort weiterhin auf read-only, damit Analyse und Report nicht unnötig ausfallen.
- Manifest, Forge-Scopes, Remotes und Persistenzmodell bleiben unverändert.

- Compound- oder Zusatz-Grants der Forge Authorize API werden ebenfalls fail-closed behandelt: Da ReleaseProof genau ein Permission-/Projekt-Tupel anfragt, muss die Antwort entweder leer oder exakt ein vollständig erwarteter `ADMINISTER_PROJECTS`-Grant für die angefragte Projekt-ID sein. Zusätzliche, fremde oder malformed Grants dürfen nicht herausgefiltert und anschließend ignoriert werden.
