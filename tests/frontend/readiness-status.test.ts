import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ReadinessStatus } from "../../src/domain/models/readiness";
import { StatusBadge } from "../../src/frontend/components/status-badge";
import { readinessStatusLabel } from "../../src/frontend/utils/readiness-status";

const statusCases: ReadonlyArray<readonly [ReadinessStatus, string, string]> = [
  ["READY", "Bereit", "status--ready"],
  ["INCOMPLETE", "Unvollständig", "status--incomplete"],
  ["BLOCKED", "Blockiert", "status--blocked"],
  ["NOT_APPLICABLE", "Nicht anwendbar", "status--not_applicable"],
];

describe("Bereitschaftsstatus-Anzeige", () => {
  it.each(statusCases)("übersetzt %s zentral mit %s", (status, label) => {
    expect(readinessStatusLabel(status)).toBe(label);
  });

  it.each(statusCases)(
    "rendert %s deutsch und behält die interne CSS-Klasse",
    (status, label, cssClass) => {
      const markup = renderToStaticMarkup(
        createElement(StatusBadge, { status }),
      );

      expect(markup).toContain(`class="status ${cssClass}"`);
      expect(markup).toContain(`aria-label="Bereitschaftsstatus: ${label}"`);
      expect(markup).not.toContain("Readiness-Status");
      expect(markup).toContain(`>${label}</span>`);
    },
  );
});
