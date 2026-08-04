import { describe, expect, it } from "vitest";
import {
  analyzeIssue,
  analyzeRelease,
} from "../../src/domain/services/analyze-release";
import { issue, projectConfig, release } from "../fixtures/release";

describe("kombinierte Issue-Auswertung", () => {
  it("erzeugt sieben Evidence Items und ein READY-Ergebnis", () => {
    const candidate = release();
    const result = analyzeIssue(candidate.issues[0]!, candidate, projectConfig);
    expect(result.evidence).toHaveLength(7);
    expect(result.status).toBe("READY");
    expect(result.score).toBe(100);
  });

  it("priorisiert Blocker und zählt fehlende Nachweise getrennt", () => {
    const candidate = release([
      issue({ acceptanceCriteria: null, labels: ["release-blocker"] }),
    ]);
    const result = analyzeIssue(candidate.issues[0]!, candidate, projectConfig);
    expect(result.status).toBe("BLOCKED");
    expect(result.blockerCount).toBe(1);
    expect(result.missingEvidenceCount).toBe(2);
    expect(result.score).toBe(55);
  });
});

describe("Release-Aggregation", () => {
  it("berechnet den gerundeten Mittelwert aller Issue-Scores", () => {
    const candidate = release([
      issue(),
      issue({ key: "DEMO-43", acceptanceCriteria: null }),
    ]);
    const result = analyzeRelease(
      candidate,
      projectConfig,
      "2026-07-11T09:00:00.000Z",
    );
    expect(result.totalIssues).toBe(2);
    expect(result.readyIssues).toBe(1);
    expect(result.incompleteIssues).toBe(1);
    expect(result.score).toBe(95);
    expect(result.status).toBe("INCOMPLETE");
  });

  it("liefert für einen leeren Release einen nachvollziehbaren Zustand", () => {
    const result = analyzeRelease(
      release([]),
      projectConfig,
      "2026-07-11T09:00:00.000Z",
    );
    expect(result.status).toBe("NOT_APPLICABLE");
    expect(result.score).toBe(0);
    expect(result.totalIssues).toBe(0);
  });
});
