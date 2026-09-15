import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ReadinessStatus } from "../../src/domain/models/readiness";
import { StatusBadge } from "../../src/frontend/components/status-badge";
import {
  I18nProvider,
  type TranslationFunction,
} from "../../src/frontend/i18n/context";
import { I18N_KEYS } from "../../src/frontend/i18n/keys";

const statusCases: ReadonlyArray<
  readonly [ReadinessStatus, string, string, string]
> = [
  ["READY", "Bereit", "Ready", "status--ready"],
  ["INCOMPLETE", "Unvollständig", "Incomplete", "status--incomplete"],
  ["BLOCKED", "Blockiert", "Blocked", "status--blocked"],
  [
    "NOT_APPLICABLE",
    "Nicht anwendbar",
    "Not applicable",
    "status--not_applicable",
  ],
];

const germanTranslation: TranslationFunction = (key) => {
  switch (key) {
    case I18N_KEYS.readinessStatusAria:
      return "Bereitschaftsstatus";
    case I18N_KEYS.readinessStatusReady:
      return "Bereit";
    case I18N_KEYS.readinessStatusIncomplete:
      return "Unvollständig";
    case I18N_KEYS.readinessStatusBlocked:
      return "Blockiert";
    case I18N_KEYS.readinessStatusNotApplicable:
      return "Nicht anwendbar";
    default:
      return key;
  }
};

const englishTranslation: TranslationFunction = (key) => {
  switch (key) {
    case I18N_KEYS.readinessStatusAria:
      return "Readiness status";
    case I18N_KEYS.readinessStatusReady:
      return "Ready";
    case I18N_KEYS.readinessStatusIncomplete:
      return "Incomplete";
    case I18N_KEYS.readinessStatusBlocked:
      return "Blocked";
    case I18N_KEYS.readinessStatusNotApplicable:
      return "Not applicable";
    default:
      return key;
  }
};

function renderBadge(
  status: ReadinessStatus,
  locale: "en-US" | "de-DE",
  t: TranslationFunction,
): string {
  return renderToStaticMarkup(
    createElement(I18nProvider, {
      locale,
      t,
      children: createElement(StatusBadge, { status }),
    }),
  );
}

describe("readiness status badge i18n", () => {
  it.each(statusCases)(
    "renders %s in German while preserving the internal CSS class",
    (status, germanLabel, _englishLabel, cssClass) => {
      const markup = renderBadge(status, "de-DE", germanTranslation);

      expect(markup).toContain(`class="status ${cssClass}"`);
      expect(markup).toContain(
        `aria-label="Bereitschaftsstatus: ${germanLabel}"`,
      );
      expect(markup).toContain(`>${germanLabel}</span>`);
    },
  );

  it.each(statusCases)(
    "renders %s in English while preserving the internal CSS class",
    (status, _germanLabel, englishLabel, cssClass) => {
      const markup = renderBadge(status, "en-US", englishTranslation);

      expect(markup).toContain(`class="status ${cssClass}"`);
      expect(markup).toContain(
        `aria-label="Readiness status: ${englishLabel}"`,
      );
      expect(markup).toContain(`>${englishLabel}</span>`);
    },
  );

  it("does not keep German readiness labels hard-coded in StatusBadge", () => {
    const source = StatusBadge.toString();

    expect(source).not.toContain("Bereitschaftsstatus");
    expect(source).not.toContain("Bereit");
    expect(source).not.toContain("Unvollständig");
    expect(source).not.toContain("Blockiert");
    expect(source).not.toContain("Nicht anwendbar");
  });
});
