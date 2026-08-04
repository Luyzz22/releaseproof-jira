# Produktumfang

## Zielgruppe

Softwareagenturen, die Releases über Jira Cloud organisieren und vor einer Kundenabnahme einen nachvollziehbaren Dokumentations- und Übergabecheck benötigen.

## Problem

Vor einer Abnahme fehlen häufig Akzeptanzkriterien, Abschlussstatus, Release-Zuordnung, Freigabemarker oder Nachweise über gelöste Abhängigkeiten. Diese Lücken werden spät und uneinheitlich entdeckt.

## Kernworkflow

1. Ein Projektverantwortlicher öffnet ReleaseProof im Jira-Projekt.
2. Er wählt den rückwärtskompatiblen Versions-Scope oder einen expliziten projektgebundenen JQL-Scope und konfiguriert anerkannte Status, das Akzeptanzkriterien-Feld, relevante Issue-Typen und Blockerregeln.
3. Er wählt eine Jira-Version und startet die Analyse.
4. ReleaseProof lädt den konfigurierten fachlichen Scope und prüft alle enthaltenen Vorgänge deterministisch gegen die erwartete Jira-Version.
5. Dashboard, Evidence-Detail und Markdown-Bericht zeigen Status, Quelle und konkrete Behebung.

## In Scope

- Forge Custom UI als Jira-Projektseite.
- Projektbezogene Konfiguration in Forge KVS.
- Zwei transparente Scope-Modi: `VERSION_ONLY` und `JQL_SCOPE`.
- Projektgebundene JQL-Validierung ohne `fixVersion` und ausbrechendes `OR`.
- Read-only Jira REST API v3.
- Sieben definierte Readiness-Regeln.
- Transparenter Score von 0 bis 100.
- Empty State, Konfiguration, Release-Auswahl, Dashboard, Issue-Detail und Report View.
- Kopierbarer Markdown-Bericht und druckoptimierte Browseransicht.
- Verständliche Fehler- und Leerzustände.

## Out of Scope

- GitHub- oder Bitbucket-Integration.
- KI, LLM-Aufrufe, semantische Extraktion oder Prognosen.
- PDF-Erzeugung, E-Mail, Webhooks oder externe APIs.
- Externe Datenbank, eigener Server oder eigenes Auth-System.
- Billing, Marketplace Licensing, Tarife, Organisationen oder SSO.
- Automatische Änderungen an Jira-Vorgängen.
- Audit-, Compliance- oder Abnahmegarantien.
- Allgemeine Projektmanagementfunktionen.
