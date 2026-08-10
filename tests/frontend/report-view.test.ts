import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReportView } from "../../src/frontend/pages/report-view";
import { issue, projectConfig, release } from "../fixtures/release";
import { readinessDto } from "../fixtures/readiness-dto";

describe("Berichtsansicht", () => {
  it("zeigt Status-Zusammenfassung und Überschriften vollständig deutsch", () => {
    const result = readinessDto(
      release([
        issue(),
        issue({ key: "DEMO-43", hasAcceptanceCriteria: false }),
        issue({ key: "DEMO-44", labels: ["release-blocker"] }),
      ]),
      projectConfig,
      "2026-08-05T09:00:00.000Z",
    );
    const markup = renderToStaticMarkup(
      createElement(ReportView, { result, onBack: () => undefined }),
    );

    expect(markup).toContain("Bericht zur Release-Bereitschaft");
    expect(markup).toContain("Nachweismatrix");
    expect(markup).toContain("<span>Bereitschaft</span>");
    expect(markup).toContain("<span>Bereit</span>");
    expect(markup).toContain("<span>Unvollständig</span>");
    expect(markup).toContain("<span>Blockiert</span>");
    expect(markup).toContain("<th scope=\"col\">Bewertung</th>");
    expect(markup).toContain("<th scope=\"col\">Blockierungen</th>");
    expect(markup).toContain("Zurück zur Übersicht");
    expect(markup).toContain("Umfang:");
    expect(markup).not.toContain("Release Readiness Report");
    expect(markup).not.toContain("Evidence-Matrix");
    expect(markup).not.toContain("<span>Readiness</span>");
    expect(markup).not.toContain("<span>Ready</span>");
    expect(markup).not.toContain(">Score<");
    expect(markup).not.toContain("Scope:");
    expect(markup).not.toContain("Dashboard");
  });
});
