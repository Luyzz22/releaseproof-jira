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

## 2026-09-01 — Forge-Authorize-Response-Shape im Runtime-E2E korrigiert

- Der erste Authorize-Fix interpretierte die Rückgabe von `authorize().onJira(...)` fälschlich als Array von Grants. Die aktuelle Forge-Dokumentation definiert dagegen eine einzelne Response `{ permission: string; issues?: number[]; projects?: number[] }`.
- Diese falsche Array-Annahme war in Unit-Tests reproduziert und deshalb durch Typecheck und Tests nicht sichtbar: Der Mapper akzeptierte `unknown`, während die Tests ebenfalls Arrays verwendeten.
- Im echten Development-Runtime führte die Objekt-Response zu `JIRA_UNAVAILABLE`. Der Bootstrap degradierte diesen Fehler korrekt auf `canConfigure:false`, wodurch sowohl Nicht-Admins als auch legitime Projektadministratoren read-only erschienen. Der Save-Pfad blieb dadurch fail-closed.
- Der Mapper validiert nun die dokumentierte einzelne Response: `permission` muss `ADMINISTER_PROJECTS` sein, `issues` darf nicht vorhanden sein, ein fehlendes oder leeres `projects` bedeutet `false`, und ein nicht exakt zur erwarteten numerischen Projekt-ID passender Projektkontext wird fail-closed abgelehnt.
- Regressionstests verwenden die dokumentierte Objektform und lehnen die alte Array-Annahme ausdrücklich ab. Manifest, Scopes, Remotes und Persistenz bleiben unverändert.

## 2026-09-02 — Forge-Authorize-Runtime-Shape empirisch verifiziert

- Der vorherige Schluss aus der Forge-Dokumentation, dass `authorize().onJira(...)` in der installierten Runtime zwingend ein Einzelobjekt liefert, war falsch. PII-freie Development-Instrumentierung auf Forge 2.10.0 zeigte für denselben Request tatsächlich ein Singleton-Array.
- Für einen verifizierten Projektadministrator mit direktem Jira-`ADMINISTER_PROJECTS=true` lautete der Runtime-Grant strukturell: `[{ permission: "ADMINISTER_PROJECTS", projects: ["10000"], issues: [] }]`.
- Für einen verifizierten Nicht-Administrator lautete der Runtime-Grant strukturell: `[{ permission: "ADMINISTER_PROJECTS", projects: [], issues: [] }]`.
- Damit ist `issues: []` ein legitimer Runtime-Bestandteil und darf nicht pauschal als unerwarteter Issue-Kontext verworfen werden. Nicht leere oder malformed Issue-Kontexte bleiben dagegen fail-closed.
- Der produktive Mapper akzeptiert strikt sowohl die dokumentierte Einzelobjekt-Form als auch die empirisch beobachtete Singleton-Array-Form. Leere oder mehrfache Top-Level-Grant-Arrays werden nicht stillschweigend normalisiert.
- Die Autorisierungssemantik bleibt eng: exakt `ADMINISTER_PROJECTS`, exakt die erwartete numerische Projekt-ID für `true`, `projects: []` für `false`; fremde, mehrfache oder malformed Projektkontexte führen zu `JIRA_UNAVAILABLE`.
- Die temporäre Diagnose-Instrumentierung bleibt auf einem separaten Branch und wird nicht in den produktiven Fix übernommen. Manifest, Scopes, Remotes und Persistenzmodell bleiben unverändert.

## 2026-09-02 — Production-spezifischer Authorize-False-Positive und duale Enforcement-Grenze

- Production 2.2.0 wurde aus demselben exakten Source-SHA deployed, der in Development 2.11.0 beide Human-E2E-Pfade bestanden hatte.
- Im Production-Smoke erschien der bekannte Nicht-Administrator dennoch mit editierbarer Konfiguration und sichtbarem Save-Control.
- Jira Ground Truth im exakt selben Incognito-Browser meldete für SCRUM weiterhin `ADMINISTER_PROJECTS.havePermission=false`. Damit ist ein Rollen- oder Accountwechsel ausgeschlossen und der Production-Pfad von Forge Authorize verhielt sich für diese Installation falsch positiv.
- Ein positiver `authorize().onJira(...)`-Grant reicht deshalb nicht mehr allein zur Autorisierung eines Konfigurationsschreibzugriffs.
- ReleaseProof verlangt zusätzlich einen serverseitigen read-only `api.asUser()`-Aufruf auf `GET /rest/api/3/project/{projectId}/permissionscheme`. Jira dokumentiert diesen Endpunkt mit `Administer Projects` für genau das Projekt oder globalem Jira-Admin als Operation-Permission; der bestehende Classic Scope `read:jira-work` genügt.
- Die Gesamtentscheidung ist eine AND-Bedingung: Authorize muss strikt positiv sein und der geschützte Jira-Read muss HTTP 200 liefern. 401/403 ergeben `false`; andere Statuscodes werden fail-closed als technische Jira-Abweichung behandelt.
- Die Save-Boundary bleibt die erste Operation vor Jira-Metadaten- und KVS-Zugriff. Der Bootstrap degradiert Fehler weiterhin nur auf read-only.
- Manifest, Forge-Scopes, Remotes und Persistenzmodell bleiben unverändert.

## 2026-09-20 — SCRUM-80: gezielte Forge-Dependency-Security-Remediation

- Ausgangspunkt ist `main@15546144cb89d4be9187b6211ebcbdcc7cbd5b35`. Die historische Audit-Aussage oben beschreibt frühere Prüfzeitpunkte und ist keine aktuelle Upstream-Bewertung.
- Die erneute Installation mit `npm ci` und beide Audits ergaben vor der Korrektur 0 Critical / 6 High / 0 Moderate / 0 Low im Production-Audit und 0 Critical / 10 High / 3 Moderate / 0 Low im vollständigen Audit. Audit-Pakete und Advisory-IDs werden getrennt gezählt: Die High-Einträge für Bridge und ADF-Schema sind abgeleitete Einträge derselben Linkify-Kette.
- Für `linkify-it@2.2.0` existiert inzwischen ein unterstützter Minor-Pfad: `@forge/bridge@6.3.1` verlangt `@atlaskit/adf-schema@^56.7.0`, das `linkify-it@^5.0.2` verwendet. Atlassians veröffentlichter Bridge-Changelog nennt den ADF-/Linkify-Bump in 6.3.0 ausdrücklich. Ein Downgrade oder Wechsel auf Bridge 7 ist nicht erforderlich (Entscheidung A).
- Die übrigen High-Befunde können innerhalb bestehender Parent-Semver-Bereiche gepatcht werden (Entscheidung B): `brace-expansion` 1.1.16 → 1.1.18 und beide 5.0.7-Kopien → 5.0.9; `fast-uri` 3.1.3 → 3.1.6; `browserslist` 4.28.6 → 4.28.7; `js-yaml` 4.3.0 → 4.3.2; `nanoid` 3.3.15 → 3.3.18; `postcss` 8.5.16 → 8.5.23; `undici` 7.28.0 → 7.29.0. Der PostCSS-Patch schließt auch die ergänzende Source-Map-Advisory.
- Browserslist benötigt neuere Datenpakete. Nur die erforderlichen Mindeststände von `caniuse-lite` und `electron-to-chromium` werden übernommen; `baseline-browser-mapping@2.11.0` ist der gepatchte kompatible Stand dieses ohnehin betroffenen Child-Pakets. Der bisherige Moderate-Befund dieses Pakets entfällt dadurch ebenfalls.
- Bridge 6.3.1 benötigt Manifest 13.4.0; dieser Stand liegt zugleich im vorhandenen API-Bereich `^13.1.0`. API 8.0.1, KVS 2.0.1 und Resolver 2.0.0 bleiben deshalb unverändert. Es gibt keine Overrides und keine neue direkte Dependency.
- Die neue ADF-Schema-Version bringt zusätzliche veröffentlichte Child-Pakete mit. Deren Statsig-/UFO-/OpenTelemetry-Abhängigkeiten werden nicht als neue App-Telemetrie verwendet: Bridge referenziert ADF-Schema weiterhin nur in einer Typdeklaration, nicht in Runtime-JavaScript; ReleaseProof importiert das Paket nicht. Jira-ADF wird weiterhin durch die eigene begrenzte Extraktion mit eingechecktem JSON-Schema verarbeitet. Eine Änderung dieser Importgrenze würde eine erneute Dataflow-Prüfung erfordern.
- Der ADF-Teilbaum benötigt für React-UFO und dessen Children einen React-18-Peer. Dieser wird regulär unter ADF isoliert auf der bereits im Ausgangs-Lock vorhandenen Version 18.3.1 aufgelöst. Die App verwendet unverändert React/React-DOM 19.2.7. Keine Peer-Anforderung wird mit `--force`, `--legacy-peer-deps` oder Overrides unterdrückt.
- Die erste npm-Auflösung aktualisierte zusätzlich Editor-ProseMirror, Markdown-It, dessen Typen und mdurl, obwohl die vorhandenen Stände alle neuen Anforderungen erfüllen. Ausschließlich diese unbeabsichtigten Versionsänderungen wurden zurückgenommen. Die notwendigen Child-Änderungen einschließlich der von Feature-Gate-Client exakt verlangten Statsig-Versionen bleiben explizit im Lock dokumentiert.

### Reichweite der Audit-Befunde

- `@forge/manifest` ist im Production-Dependency-Baum enthalten, wird von den installierten API-/Bridge-Runtime-JavaScript-Dateien aber nicht importiert; die SDK-Referenzen sind Typdeklarationen. Seine AJV-/Fast-URI-, Glob-/Brace-Expansion- und Cheerio-/Undici-Ketten belegen daher nicht automatisch einen über Jira-Daten erreichbaren Runtime-Angriff.
- Manifest verwendet Glob für `app.package.extraFiles`; ReleaseProof konfiguriert diesen Pfad nicht. Manifest verarbeitet lokale HTML-Ressourcen mit `cheerio.load`, nicht über den HTTP-Lader `fromURL`. Jira-Requests laufen weiterhin über Forge `global.__forge_fetch__`, nicht über die installierte Undici-Kopie. Der konkret betroffene Undici-Cache-Interceptor wird von ReleaseProof nicht aktiviert.
- `linkify-it` ist über ADF-Schema installiert; ein App-Aufruf seiner Text-Matching-Funktionen wurde nicht gefunden. Die App nutzt auch den Bridge-ADF-Renderer nicht. Für die Production-High-Befunde wurde kein Jira-User-Datenpfad bis zur betroffenen Funktion nachgewiesen; dies ist keine pauschale Nicht-Ausnutzbarkeitsbehauptung.
- Die zusätzlichen High-Befunde im vollständigen Audit betreffen Entwicklungstools: ESLint/TypeScript-ESLint-Globs, ESLints Legacy-YAML-Lader, Browserslist über Babel/React-Hooks-Lint sowie PostCSS/Nanoid über Vite. Die Angriffsgrenzen wären unter anderem manipulierte Repository-/Tool-Konfiguration oder Build-Eingaben, nicht die normalen Resolver-Payloads. PostCSS verwendet Nanoid mit konstanter Länge 6 für Diagnose-IDs, nicht für Zugriffstokens.

### Verifikation und verbleibende Grenzen

- Kleine synthetische, zeitlich begrenzte Package-Reproducer bestätigten vor dem Patch ignorierte Brace-Limits, Fast-URI-Host-Desynchronisierung ohne Fehler, umgangene YAML-Merge-Limits, Nanoid-Endlosschleifen und den Undici-Private-Directive-Parserfehler. Nach dem Patch werden die Grenzen respektiert beziehungsweise ungültige Eingaben markiert; Nanoid beendet beide Aufrufe und Undici behandelt die Private-Direktive ohne Crash. Das demonstriert Package-Verhalten, nicht einen ReleaseProof-Exploit.
- Die von ReleaseProof verwendeten Bridge-Implementierungen für Invoke, View, Theme und i18n sind zwischen 6.1.0 und 6.3.1 unverändert. Backend-API, Authorize, KVS und Resolver bleiben auf denselben direkten Versionen. Manifest, Übersetzungsressourcen, Scopes und Persistenzmodell werden nicht geändert.
- Am ersten Kandidaten `55f8a6a2d055ef569065e8504deed2af2a401414` meldete npm: Production-Audit 0 Befunde; vollständiges Audit 0 Critical / 0 High / 2 Moderate / 0 Low. Diese Feed-Ausgabe erfasste nicht alle bereits veröffentlichten Fast-URI-Upstream-Advisories; die ergänzende Korrektur folgt unten. Die beiden gemeldeten Moderate-Einträge betreffen `vitest@4.1.10` und `@vitest/mocker@4.1.10` zu [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9). Sie gehören zur Test-Toolchain und bleiben außerhalb dieses High-Remediation-Schnitts; eine Ausnutzbarkeit im normalen lokalen `vitest run` wurde nicht nachgewiesen.
- Globale Forge CLI, Scopes, Remotes, Egress und Datenflüsse bleiben unverändert. Es werden kein Forge-Deployment, keine Installation und kein Jira-Schreibzugriff ausgeführt. Lokale Gates ersetzen keine spätere separat freigegebene Forge-Runtime-Verifikation; unabhängiger Exact-SHA-Review bleibt erforderlich.

## 2026-09-20 — SCRUM-80: ergänzende Fast-URI-Upstream-Inventur

- Ausgangspunkt ist der geprüfte Kandidat `55f8a6a2d055ef569065e8504deed2af2a401414` mit `fast-uri@3.1.6`. Der frische npm-Audit-Lauf meldet weiterhin keine High-Befunde; die offiziellen Repository-Advisories belegen dennoch zwei betroffene High-Fälle: [GHSA-58mr-gqgx-xq4g](https://github.com/fastify/fast-uri/security/advisories/GHSA-58mr-gqgx-xq4g) betrifft exakt 3.1.6, [GHSA-qw65-cvwx-89v3](https://github.com/fastify/fast-uri/security/advisories/GHSA-qw65-cvwx-89v3) betrifft `>=3.0.0 <3.1.7`. Beide sind ab 3.1.7 korrigiert. Ein leerer npm-Audit-Feed ersetzt deshalb nicht die Prüfung der Upstream-Advisories.
- Die vollständige aktuelle Fast-URI-Inventur umfasst 13 Repository-Advisories. Zusätzlich betrifft [GHSA-hrr3-gc8f-f4qj](https://github.com/fastify/fast-uri/security/advisories/GHSA-hrr3-gc8f-f4qj) (Moderate) noch `>=3.0.0 <3.1.8`. Daher wird direkt der unterstützte Security-Patch 3.1.8 gewählt. [GHSA-jvvf-x445-j334](https://github.com/fastify/fast-uri/security/advisories/GHSA-jvvf-x445-j334) betrifft ausschließlich `>=4.1.3 <4.1.5`, nicht die installierte 3.x-Linie. Die neun älteren Advisories sind bereits vor 3.1.6 korrigiert oder mit 3.1.6 geschlossen.
- Entscheidung B: `@forge/api@8.0.1` / `@forge/bridge@6.3.1` → `@forge/manifest@13.4.0` → `ajv@8.20.0` → `fast-uri@^3.0.1` akzeptiert 3.1.8 ohne Parent- oder Direktabhängigkeitswechsel. Im Lock ändern sich ausschließlich Version, Tarball-URL und Integrität dieses einen Pakets. Keine Overrides, keine neue direkte Dependency und kein `npm audit fix`.
- AJV nutzt Fast-URI für Schema-IDs und Referenzen; die geprüften Forge-Validatoren kompilieren paketinterne Schemas ohne Remote-Loader. Ein ReleaseProof-Pfad mit untrusted Host-Autorisierung oder unabhängig gesetztem Objekt-Port wurde nicht nachgewiesen. Die synthetischen Package-Fehler sind kein Nachweis eines ausnutzbaren Jira-Datenpfads.
- Vor der Korrektur: vier gezielte Regressionstests schlagen fehl (fehlerhafte Authority-Klammern, Port-Serialisierung, Objekt-Normalisierung/-Vergleich, percent-kodierte Host-Großschreibung); zwei Kontrolltests für gültige URIs/IPv6/Ports und AJV-Schema-Referenzen bestehen. Nach 3.1.8 bestehen alle sechs. Insbesondere meldet `parse` fehlerhafte Hosts und `resolve` wirft einen Fehler; String-`normalize` bewahrt ungültige Eingaben unverändert und ist allein keine Validierung.
- Production-Audit nach dem Patch: 0 Befunde; vollständiges Audit: 0 Critical / 0 High / 2 Moderate / 0 Low, weiterhin Vitest/Mocker. Manifest, Anwendungscode, direkte Dependencies und globale Forge CLI bleiben unverändert. Kein Deployment oder Forge-Install; unabhängiger Exact-SHA-Review bleibt erforderlich.
