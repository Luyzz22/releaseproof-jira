# Automatisierte Qualitätsprüfungen

Der GitHub-Actions-Workflow `.github/workflows/quality.yml` prüft Pull Requests
(auch Drafts und gestapelte Entwicklungsbranches), Pushes auf `main` und manuell
gestartete Läufe. Es gibt keine Pfadfilter: Auch Dokumentationsänderungen erhalten
ein eindeutiges Prüfergebnis. Neue Läufe ersetzen laufende Prüfungen desselben
Pull Requests bzw. Branches und Ereignistyps.

## Prüfumfang

Der stabile Jobname ist **Quality gates**. Auf einem GitHub-gehosteten
`ubuntu-24.04`-Runner verwendet er Node.js **22.23.2** aus `.node-version` und
prüft die mitgelieferte npm-Version **10.9.8**. Abhängigkeiten werden mit `npm ci`
aus dem unveränderten Lockfile installiert. Die Toolchain ist fixiert; Runner-Image
und Paketverfügbarkeit bleiben externe Voraussetzungen.

Nach erfolgreicher Installation laufen diese Gates auch dann weiter, wenn ein
vorheriges Gate fehlschlägt:

- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run test` mit Standard- und JUnit-Reporter
- `npm run build`
- `git diff --check` gegen PR-Basis bzw. den vorherigen Push-Stand
- Prüfung, dass Installation und Prüfungen keine versionierten Dateien verändern

Ein fehlgeschlagenes Gate lässt den Job fehlschlagen. Es gibt kein
`continue-on-error`. Bei fehlgeschlagener Installation werden abhängige Gates
übersprungen; die Installation bleibt ein Fehler. Ein abgebrochener Lauf ist kein
erfolgreicher Nachweis.

## Prüfnachweise

Die Job-Zusammenfassung zeigt die einzelnen Gate-Ergebnisse. Das Artefakt
`quality-<run-id>-<attempt>` enthält für 14 Tage:

- `evidence.json`: tatsächlich ausgecheckter Commit und Tree, PR-Head/-Basis,
  Ereignis, Run-URL/-Versuch, Node-/npm-Version und Gate-Ergebnisse;
- `junit.xml`, sofern der Testlauf einen Bericht erzeugt hat. Es enthält nur die
  Ausgaben der synthetischen Repository-Tests.

Bei Pull Requests testet der Standard-Checkout den von GitHub erzeugten
Merge-Commit. Dieser ist ausdrücklich vom PR-Head zu unterscheiden. Bei Pushes
und manuellen Läufen wird die jeweilige Revision geprüft. Der manuelle Diff-Check
bezieht sich auf deren letzten Commit, bei einem Root-Commit auf den leeren Tree.

Die Nachweise werden auch nach fehlgeschlagenen Gates erzeugt und hochgeladen,
soweit Checkout, Runner und Node noch verfügbar sind. Ein fehlender Bericht oder
ein Artefakt allein belegt keinen erfolgreichen Lauf. Es werden weder Buildpakete
noch Caches, Umgebungsdateien oder Zugangsdaten hochgeladen.

## Berechtigungen und Release-Grenze

Der Workflow hat ausschließlich `contents: read`, verwendet keine Repository-
Secrets und speichert Checkout-Zugangsdaten nicht für nachfolgende Befehle.
Er verwendet `pull_request`, nicht `pull_request_target`, und keine selbst
gehosteten Runner. Abhängigkeiten werden ohne Actions-Cache installiert.
Die drei offiziellen GitHub Actions sind auf vollständige Commit-SHAs fixiert;
Updates werden als normale Codeänderungen geprüft.

Der Workflow enthält keinen Deploy, Merge, Marketplace-Zugriff, Forge-Login,
Jira-Aufruf oder Nachrichtenversand. Er setzt keine Branch-Schutzregel und ersetzt
keine unabhängige Prüfung oder Release-Freigabe. Die Forge-Runtime bleibt
`nodejs24.x`; der Node-22-Buildtest behauptet keine Forge-Runtime-Verifikation.

`npm run forge:lint` bleibt mit vorhandener persönlicher Forge-Authentifizierung
separat auszuführen. Eine automatisierte Prüfung mit Forge-Zugangsdaten und eine
Installation-/Jira-Smoke-Prüfung sind nicht Teil dieses Workflows. Auch ein
Dependency-Audit bleibt ein gesonderter, aktueller Sicherheitsnachweis.

Nach dem ersten erfolgreichen GitHub-Lauf kann ein Administrator **Quality gates**
als erforderlichen Statuscheck für `main` konfigurieren. Erst eine tatsächlich
aktivierte Schutzregel erzwingt diesen Check vor einem Merge; diese Änderung ist
kein Bestandteil des CI-Patches. Der Workflow wird mit einem Draft-PR zur Prüfung
bereitgestellt. Bestehende R&D-Branches und der eingereichte Produktstand werden
nicht verändert.

## Lokal reproduzieren

Node.js aus `.node-version` und npm 10.9.8 verwenden, dann:

```bash
npm ci --no-audit --no-fund
npm run typecheck
npm run lint
npm run format:check
npm run test -- --reporter=default --reporter=junit --outputFile.junit=artifacts/ci/junit.xml
npm run build
git diff --check
npm run forge:lint
```

`artifacts/ci/` ist lokal ignoriert. Versionsänderungen an `.node-version` müssen
die npm-Prüfung im Workflow und diese Dokumentation entsprechend aktualisieren.

Referenzen: [Checkout](https://github.com/actions/checkout),
[Setup Node](https://github.com/actions/setup-node),
[Upload Artifact](https://github.com/actions/upload-artifact).
