# Readiness-Status und Score

## Evidence-Status

Jede Regel liefert genau ein Evidence Item:

- `READY`: Anforderung erfüllt.
- `INCOMPLETE`: Nachweis oder erwartete Angabe fehlt.
- `BLOCKED`: blockierender Zustand verhindert Readiness.
- `NOT_APPLICABLE`: optionale oder deaktivierte Regel ist nicht anzuwenden.

## Issue-Status

1. Mindestens ein `BLOCKED` Evidence Item ergibt `BLOCKED`.
2. Sonst ergibt mindestens ein `INCOMPLETE` Evidence Item `INCOMPLETE`.
3. Sonst ergibt das Issue `READY`.

## Issue-Score

Ausgangswert ist 100. Pro Evidence Item gelten:

- `BLOCKED`: −25 Punkte.
- `INCOMPLETE`: −10 Punkte.
- `READY` und `NOT_APPLICABLE`: 0 Punkte.

Der Score wird auf mindestens 0 begrenzt:

```text
issueScore = max(0, 100 - blockedCount * 25 - incompleteCount * 10)
```

Die Implementierung erhält die Gewichte als explizite `ScoringWeights`. Dadurch kann eine spätere, separat freizugebende Konfiguration die Standardwerte ersetzen, ohne Regeln umzubauen.

## Versionsregel und Scope-Modus

- `VERSION_ONLY`: `correct-fix-version` liefert `NOT_APPLICABLE`, weil Jira nur bereits passend zugeordnete Vorgänge in den Scope aufgenommen hat. Die Regel verursacht keinen Punktabzug und erklärt diese Vorfilterung ausdrücklich.
- `JQL_SCOPE`: `correct-fix-version` prüft die erwartete Versions-ID unabhängig vom fachlichen Scope. Eine fehlende oder falsche Version liefert `INCOMPLETE` und zieht 10 Punkte ab; eine korrekte Version liefert `READY`.

Damit wird eine Versionslücke nicht als wirksame Prüfung dargestellt, wenn sie technisch nicht beobachtbar ist.

## Release-Score

Der Release-Score ist das arithmetische Mittel aller Issue-Scores und wird auf die nächste ganze Zahl gerundet. Ein leerer Release hat Score 0 und Status `NOT_APPLICABLE`.

## Release-Status

- Mindestens ein blockiertes Issue: `BLOCKED`.
- Sonst mindestens ein unvollständiges Issue: `INCOMPLETE`.
- Sonst bei mindestens einem Issue: `READY`.
- Bei keinem Issue: `NOT_APPLICABLE`.
