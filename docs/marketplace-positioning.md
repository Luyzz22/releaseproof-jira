# Marketplace-Positionierung

> **Status:** interne Listing-Grundlage; keine Aussage über aktuelle Marketplace-Veröffentlichung oder Atlassian-Freigabe.

## Produktpositionierung

ReleaseProof ist ein deterministischer Release-Readiness- und Evidence-Check für Jira-Cloud-Softwareagenturen und Teams, die Kundenabnahmen oder Übergaben vorbereiten.

- Bewertet sieben deterministische Readiness-Regeln.
- Macht Blocker und fehlende Nachweise auf Vorgangs- und Release-Ebene sichtbar.
- Stellt Evidence Details sowie Markdown- und druckbare Berichte bereit.
- Führt keine Jira-Schreibzugriffe aus und ändert keine Jira-Vorgänge.
- Nutzt keine KI- oder LLM-Aufrufe.
- Gibt keine Audit-, Compliance- oder Abnahmegarantie.

## Unterstützte Sprachen

**Default / Fallback**

- Englisch (`en-US`)

**Vollständig unterstützt**

- Deutsch (`de-DE`)

Für unterstützte Sprachen bestimmt die Atlassian/Jira-Benutzersprache die Darstellung. Eine fehlende oder nicht unterstützte Locale fällt auf `en-US` zurück. ReleaseProof hat keine eigene Spracheinstellung.

Die Lokalisierung umfasst sichtbare UI-Texte, assistive und barrierebezogene Beschriftungen, Validierungs- und Fehlerdarstellung, Readiness- und Evidence-Darstellung, Datumsangaben sowie erzeugte Markdown-Berichte.

Von Jira gelieferte Laufzeitdaten werden nicht übersetzt. Dazu gehören Projektnamen, Vorgangsschlüssel, Vorgangstyp- und Statusnamen, Versionsnamen, Labels, JQL und weitere Jira-Laufzeittexte.

## Datenschutz- und Hosting-Positionierung

- ReleaseProof verwendet ausschließlich eine Forge-Architektur.
- Jira-Anfragen laufen im Kontext des aktuellen Benutzers.
- In Forge KVS werden ausschließlich die Projektkonfiguration und eine nicht-personenbezogene technische Schema-Version gespeichert.
- Vollständige Jira-Vorgänge, Berichte und Benutzerprofile werden nicht persistiert.
- Es gibt keine externen Runtime-Hosts oder Remotes und keine Telemetrie.
- Es gibt keine KI- oder LLM-Aufrufe.

## Berechtigungen

ReleaseProof verwendet ausschließlich:

- `read:jira-work`
- `storage:app`

Änderungen an Projektkonfigurationen erfordern eine serverseitig geprüfte Jira-Projektadministratorberechtigung.

## Marketplace-Aussagen, die NICHT ohne weitere Freigabe gemacht werden dürfen

Die folgenden Aussagen benötigen ein separates Listing-Review und dürfen nicht als aktueller Produktstatus veröffentlicht werden:

- „Available on Atlassian Marketplace“ oder eine gleichbedeutende Verfügbarkeitsaussage.
- Eine erfolgte Atlassian-Prüfung, -Freigabe oder ein bestimmter Listing-Status.
- Eine Listing- oder Installations-URL.
- Preise, Lizenzmodelle oder Trial-Konditionen.
- Eine Berechtigung oder Zertifizierung für „Runs on Atlassian“.
- Eine Empfehlung oder Billigung durch Atlassian.
- Compliance-Zertifizierungen oder regulatorische Freigaben.

## Listing-Kurztext — interne Vorlage

**NOT FOR PUBLICATION WITHOUT LISTING REVIEW**

**English**

> ReleaseProof gives Jira Cloud teams a deterministic release-readiness check before customer handover. It evaluates documented evidence, completion status, dependencies, blockers and approvals, then provides a transparent readiness score and reviewable report — without AI, Jira writes or external data processing.

**Deutsch**

> ReleaseProof bietet Jira-Cloud-Teams vor der Kundenübergabe einen deterministischen Release-Readiness-Check. Es bewertet dokumentierte Nachweise, Abschlussstatus, Abhängigkeiten, Blocker und Freigaben und stellt anschließend einen transparenten Readiness-Score sowie einen überprüfbaren Bericht bereit — ohne KI, Jira-Schreibzugriffe oder externe Datenverarbeitung.
