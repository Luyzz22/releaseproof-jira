import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  I18nProvider,
  type TranslationFunction,
} from "../../src/frontend/i18n/context";
import { ReportView } from "../../src/frontend/pages/report-view";
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

const englishMessages = flattenTranslations(
  JSON.parse(
    readFileSync(resolve(process.cwd(), "locales/en-US.json"), "utf8"),
  ) as unknown,
);

const englishTranslation: TranslationFunction = (key, defaultValue) =>
  englishMessages[key] ?? defaultValue ?? key;

describe("ReportView readiness status i18n", () => {
  it("renders status badges and summary counters in en-US", () => {
    const result = readinessDto(
      release([
        issue(),
        issue({
          key: "DEMO-43",
          hasAcceptanceCriteria: false,
        }),
        issue({
          key: "DEMO-44",
          labels: ["release-blocker"],
        }),
      ]),
      projectConfig,
      "2026-08-05T09:00:00.000Z",
    );

    const markup = renderToStaticMarkup(
      createElement(I18nProvider, {
        locale: "en-US",
        t: englishTranslation,
        children: createElement(ReportView, {
          result,
          onBack: () => undefined,
        }),
      }),
    );

    expect(markup).toContain("<span>Ready</span>");
    expect(markup).toContain("<span>Incomplete</span>");
    expect(markup).toContain("<span>Blocked</span>");

    expect(markup).toContain("Readiness status:");

    expect(markup).not.toContain("<span>Bereit</span>");
    expect(markup).not.toContain("<span>Unvollständig</span>");
    expect(markup).not.toContain("<span>Blockiert</span>");
  });
});
