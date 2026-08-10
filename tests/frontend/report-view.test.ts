import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReportView } from "../../src/frontend/pages/report-view";
import { issue, projectConfig, release } from "../fixtures/release";
import { readinessDto } from "../fixtures/readiness-dto";

describe("Report View", () => {
  it("zeigt die Status-Zusammenfassung vollständig deutsch", () => {
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

    expect(markup).toContain("<span>Bereit</span>");
    expect(markup).toContain("<span>Unvollständig</span>");
    expect(markup).toContain("<span>Blockiert</span>");
    expect(markup).not.toContain("<span>Ready</span>");
  });
});
