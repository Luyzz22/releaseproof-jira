import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReportView } from "../../src/frontend/pages/report-view";
import {
  I18nProvider,
  type TranslationFunction,
} from "../../src/frontend/i18n/context";
import { issue, projectConfig, release } from "../fixtures/release";
import { readinessDto } from "../fixtures/readiness-dto";

function flattenTranslations(
  value: unknown,
  prefix = "",
): Record<string, string> {
  if (typeof value === "string") {
    return { [prefix]: value };
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>(
    (result, [key, child]) => ({
      ...result,
      ...flattenTranslations(
        child,
        prefix.length > 0 ? `${prefix}.${key}` : key,
      ),
    }),
    {},
  );
}

const germanMessages = flattenTranslations(
  JSON.parse(
    readFileSync(resolve(process.cwd(), "locales/de-DE.json"), "utf8"),
  ) as unknown,
);

const germanTranslation: TranslationFunction = (key, defaultValue) =>
  germanMessages[key] ?? defaultValue ?? key;

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
      createElement(I18nProvider, {
        locale: "de-DE",
        t: germanTranslation,
        children: createElement(ReportView, {
          result,
          onBack: () => undefined,
        }),
      }),
    );

    expect(markup).toContain("Bericht zur Release-Bereitschaft");
    expect(markup).toContain("Nachweismatrix");
    expect(markup).toContain("<span>Bereitschaft</span>");
    expect(markup).toContain("<span>Bereit</span>");
    expect(markup).toContain("<span>Unvollständig</span>");
    expect(markup).toContain("<span>Blockiert</span>");
    expect(markup).toContain('<th scope="col">Bewertung</th>');
    expect(markup).toContain('<th scope="col">Blockierungen</th>');
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
