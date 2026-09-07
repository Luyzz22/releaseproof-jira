import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { TranslationFunction } from "../../src/frontend/i18n/context";
import type { I18nKey } from "../../src/frontend/i18n/keys";
import type { SupportedLocale } from "../../src/frontend/i18n/locale";
import { formatDateTimeForLocale } from "../../src/frontend/utils/format";
import {
  releaseScopeExplanationForLocale,
  releaseScopeModeLabelForLocale,
} from "../../src/frontend/utils/release-scope";

function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") {
    return { [prefix]: value };
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>(
    (result, [key, child]) => ({
      ...result,
      ...flatten(child, prefix.length > 0 ? `${prefix}.${key}` : key),
    }),
    {},
  );
}

function translator(locale: SupportedLocale): TranslationFunction {
  const messages = flatten(
    JSON.parse(
      readFileSync(resolve(process.cwd(), `locales/${locale}.json`), "utf8"),
    ) as unknown,
  );

  return (key: I18nKey, defaultValue?: string) =>
    messages[key] ?? defaultValue ?? key;
}

describe("locale-aware presentation utilities", () => {
  it("formats timestamps with the active locale", () => {
    const value = "2026-08-05T09:00:00.000Z";

    expect(formatDateTimeForLocale(value, "en-US", translator("en-US"))).toBe(
      new Date(value).toLocaleString("en-US"),
    );

    expect(formatDateTimeForLocale(value, "de-DE", translator("de-DE"))).toBe(
      new Date(value).toLocaleString("de-DE"),
    );
  });

  it("localizes the invalid timestamp fallback", () => {
    expect(
      formatDateTimeForLocale("invalid", "en-US", translator("en-US")),
    ).toBe("Timestamp unavailable");

    expect(
      formatDateTimeForLocale("invalid", "de-DE", translator("de-DE")),
    ).toBe("Zeitpunkt nicht verfügbar");
  });

  it("localizes both release scope modes and explanations", () => {
    const english = translator("en-US");
    const german = translator("de-DE");

    expect(releaseScopeModeLabelForLocale("JQL_SCOPE", english)).toBe(
      "Explicit JQL scope",
    );

    expect(releaseScopeModeLabelForLocale("VERSION_ONLY", english)).toBe(
      "Jira version only",
    );

    expect(
      releaseScopeExplanationForLocale(
        {
          projectKey: "DEMO",
          releaseScopeMode: "VERSION_ONLY",
        },
        english,
      ),
    ).toBe("fixVersion of the selected version in project DEMO");

    expect(releaseScopeModeLabelForLocale("JQL_SCOPE", german)).toBe(
      "Expliziter JQL-Umfang",
    );

    expect(
      releaseScopeExplanationForLocale(
        {
          projectKey: "DEMO",
          releaseScopeMode: "VERSION_ONLY",
        },
        german,
      ),
    ).toBe("fixVersion der ausgewählten Version im Projekt DEMO");
  });

  it("preserves explicit JQL as Jira-supplied data", () => {
    const jql = "project = DEMO AND status != Done";

    expect(
      releaseScopeExplanationForLocale(
        {
          projectKey: "DEMO",
          releaseScopeMode: "JQL_SCOPE",
          releaseScopeJql: jql,
        },
        translator("en-US"),
      ),
    ).toBe(jql);
  });
});
