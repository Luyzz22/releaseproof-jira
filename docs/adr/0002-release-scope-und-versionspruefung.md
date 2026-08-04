# ADR 0002: Release-Scope und Versionsprüfung trennen

- Status: Angenommen
- Datum: 2026-07-27

## Kontext

Die ursprüngliche Analyse lud ausschließlich Vorgänge mit `fixVersion = selectedVersion`. Wurde einem fachlich zum Release gehörenden Vorgang die Version entzogen oder eine andere Version zugeordnet, verschwand er vor der Domain-Auswertung. `correct-fix-version` konnte den Fehler nicht erkennen und der Release-Score blieb fälschlich bis zu 100 Prozent.

Ohne eine zweite, unabhängige Scope-Quelle lässt sich fachliche Zugehörigkeit nicht von der zu prüfenden Versionszuordnung unterscheiden.

## Entscheidung

ReleaseProof unterstützt zwei explizite Modi:

### `VERSION_ONLY`

- Rückwärtskompatibler Standard und Lesefallback für alte KVS-Datensätze.
- Scope bleibt die ausgewählte Jira-`fixVersion`.
- `correct-fix-version` liefert `NOT_APPLICABLE` mit einer Erklärung der Vorfilterung.

### `JQL_SCOPE`

- Ein projektgebundener JQL-Ausdruck bestimmt den fachlichen Scope.
- Die ausgewählte Version bleibt der erwartete Zielwert.
- Der Jira-Adapter führt den validierten Ausdruck unverändert aus.
- `correct-fix-version` bewertet fehlende, falsche und korrekte Zuordnungen.

Die JQL-Teilmenge ist bewusst restriktiv: höchstens 2.000 Zeichen, Präfix `project = <aktueller Projektkey>`, kein `fixVersion`, kein `OR` und keine zweite Projektreferenz. Browser und Resolver verwenden dasselbe Schema; Application und Adapter validieren erneut.

## Kompatibilität und Storage

`ProjectConfig` erhält `releaseScopeMode` und optional `releaseScopeJql`. KVS-Schema-Version 2 wird beim nächsten Speichern geschrieben. Alte Datensätze ohne Scope-Felder werden beim Lesen als `VERSION_ONLY` interpretiert und nicht automatisch überschrieben.

Es werden weiterhin weder Issue-Snapshots noch Reports gespeichert.

## Konsequenzen

### Vorteile

- Fehlende oder falsche Versionszuordnungen bleiben im expliziten Scope sichtbar.
- Bestehende Installationen ändern ihr Verhalten nicht stillschweigend.
- Scope-Quelle, erwartete Version und Evidence bleiben deterministisch und auditierbar.
- Es sind keine neuen Forge-Scopes, Remotes oder Jira-Schreiboperationen erforderlich.

### Nachteile

- Nutzer müssen für unabhängige Prüfung bewusst einen fachlichen JQL-Scope pflegen.
- Die sichere JQL-Teilmenge unterstützt kein `OR`; komplexere boolesche Scopes erfordern eine spätere Parser-/Produktentscheidung.
- `VERSION_ONLY` kann Versionslücken weiterhin prinzipbedingt nicht erkennen, weist diese Grenze nun aber sichtbar aus.

## Verworfen

- Automatische oder KI-basierte Scope-Erkennung: nicht deterministisch und außerhalb des Forge-only-Scopes.
- Jira-Scope nachträglich um die ausgewählte Version erweitern: würde den False-Positive wieder einführen.
- Stilles Umschreiben des Nutzer-JQL: erschwert Auditierbarkeit und kann die beabsichtigte Semantik verändern.
- Persistierte Issue-Snapshots: unnötige Datenhaltung und außerhalb der Datenschutzgrenze.
