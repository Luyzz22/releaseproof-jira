# ADR 0001: Forge-only-Architektur

- Status: Angenommen
- Datum: 2026-07-11

## Kontext

ReleaseProof benötigt Jira-Projektkontext, read-only Zugriff auf Release-Issues, eine kleine Projektkonfiguration und eine Jira-nahe Oberfläche. Der erste Stand darf keine Jira-Inhalte an externe Hosts übertragen und soll keine allgemeine SaaS-Plattform aufbauen.

## Entscheidung

Die Anwendung wird vollständig mit Atlassian Forge umgesetzt:

- Jira `projectPage` mit Forge Custom UI und React.
- Forge Resolver als validierte Backend-Grenze.
- Jira Cloud REST API v3 über `@forge/api` im aktuellen Benutzerkontext.
- Forge KVS ausschließlich für Projektkonfiguration und technische Schema-Version.
- Reine TypeScript-Domain-Engine ohne Forge-Abhängigkeiten.
- Keine Remotes, externe APIs, Datenbanken oder Telemetrie.

## Vorteile

- Jira-Daten bleiben innerhalb der Atlassian-/Forge-Ausführungsgrenze.
- Kein eigener Hosting-, Auth-, Tenant- oder Datenbankbetrieb.
- Jira-Berechtigungen bleiben durch `asUser` wirksam.
- Kleine Angriffsfläche und nachvollziehbare Datenflüsse.
- Potenziell günstige Ausgangslage für „Runs on Atlassian“.

## Nachteile

- Forge-Invocation-, Storage- und Jira-Rate-Limits begrenzen große synchrone Analysen.
- Custom UI und Resolver benötigen getrennte Build-Pfade.
- Lokale End-to-End-Tests erfordern Forge Login, Tunnel und eine Jira-Entwicklerinstanz.
- Stärkere Plattformbindung an Atlassian-Manifest, Runtime und Bridge.

## Spätere Ausstiegsmöglichkeiten

Ports trennen Domain/Application von Forge. Ein späterer Jira-Adapter, Storage-Adapter oder alternativer UI-Host kann ersetzt werden, ohne Regeln und Aggregation neu zu schreiben. Ein externer Dienst würde jedoch eine neue Datenschutz-, Egress-, Auth- und Marketplace-Entscheidung erfordern und ist kein stiller Refactor.
