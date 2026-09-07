import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  I18nProvider,
  type TranslationFunction,
  useI18n,
} from "../../src/frontend/i18n/context";
import type { SupportedLocale } from "../../src/frontend/i18n/locale";
import { localizeProjectConfigValidationFailure } from "../../src/frontend/i18n/project-config-validation";
import type { ProjectConfigValidationFailure } from "../../src/shared/validation";

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

function translator(locale: SupportedLocale): TranslationFunction {
  const messages = flattenTranslations(
    JSON.parse(
      readFileSync(resolve(process.cwd(), "locales", `${locale}.json`), "utf8"),
    ) as unknown,
  );

  return (key, defaultValue) => messages[key] ?? defaultValue ?? key;
}

async function renderFailure(
  locale: SupportedLocale,
  failure: ProjectConfigValidationFailure,
): Promise<string> {
  function ValidationMessage() {
    const { t } = useI18n();
    return createElement(
      "p",
      null,
      localizeProjectConfigValidationFailure(failure, t),
    );
  }

  return renderToStaticMarkup(
    createElement(I18nProvider, {
      locale,
      t: translator(locale),
      children: createElement(ValidationMessage),
    }),
  );
}

describe("Project configuration validation i18n", () => {
  it.each([
    [
      "en-US",
      { code: "APPROVAL_MARKER_REQUIRED" },
      "An approval label is required when approval checking is enabled.",
    ],
    [
      "de-DE",
      { code: "APPROVAL_MARKER_REQUIRED" },
      "Bei aktivierter Freigabeprüfung ist ein Label erforderlich.",
    ],
    [
      "en-US",
      { code: "RELEASE_SCOPE_JQL_REQUIRED" },
      "Enter an explicit release scope.",
    ],
    [
      "de-DE",
      { code: "RELEASE_SCOPE_JQL_REQUIRED" },
      "Bitte geben Sie einen expliziten Release-Umfang an.",
    ],
  ] as const)(
    "localizes %s validation without code leakage",
    async (locale, failure, expected) => {
      const markup = await renderFailure(locale, failure);

      expect(markup).toContain(expected);
      expect(markup).not.toContain(failure.code);
      expect(markup).not.toContain("projectConfiguration.validation.");
    },
  );

  it.each([
    [
      "en-US",
      "The release scope is syntactically incomplete or uses an unsupported JQL form.",
    ],
    [
      "de-DE",
      "Der Release-Umfang ist syntaktisch unvollständig oder verwendet eine nicht unterstützte JQL-Form.",
    ],
  ] as const)(
    "localizes unsupported JQL syntax in %s",
    async (locale, expected) => {
      const markup = await renderFailure(locale, {
        code: "RELEASE_SCOPE_JQL_INVALID",
        validation: {
          valid: false,
          code: "SYNTAX_INVALID",
          reason: "UNSUPPORTED_SYNTAX",
        },
      });

      expect(markup).toContain(expected);
      expect(markup).not.toContain("SYNTAX_INVALID");
      expect(markup).not.toContain("UNSUPPORTED_SYNTAX");
    },
  );

  it.each([
    [
      "en-US",
      "The release scope must be limited to the current project RAW_JIRA_KEY.",
    ],
    [
      "de-DE",
      "Der Release-Umfang muss auf das aktuelle Projekt RAW_JIRA_KEY begrenzt sein.",
    ],
  ] as const)(
    "interpolates the untranslated Jira project key in %s",
    async (locale, expected) => {
      const markup = await renderFailure(locale, {
        code: "RELEASE_SCOPE_JQL_INVALID",
        validation: {
          valid: false,
          code: "PROJECT_MISMATCH",
          expectedProjectKey: "RAW_JIRA_KEY",
        },
      });

      expect(markup).toContain(expected);
      expect(markup).not.toContain("PROJECT_MISMATCH");
    },
  );

  it.each([
    ["en-US", "Check the project configuration."],
    ["de-DE", "Bitte prüfen Sie die Projektkonfiguration."],
  ] as const)(
    "fails closed with a localized fallback in %s",
    async (locale, expected) => {
      const markup = await renderFailure(locale, {
        code: "INVALID_CONFIGURATION",
      });

      expect(markup).toContain(expected);
      expect(markup).not.toContain("INVALID_CONFIGURATION");
      expect(markup).not.toContain("projectConfiguration.validation.");
    },
  );

  it("localizes EMPTY from semantic data alone in en-US", async () => {
    const markup = await renderFailure("en-US", {
      code: "RELEASE_SCOPE_JQL_INVALID",
      validation: {
        valid: false,
        code: "EMPTY",
      },
    });

    expect(markup).toContain("The explicit release scope must not be empty.");
    expect(markup).not.toContain("EMPTY");
  });

  it("fails safely for an unexpected future code", async () => {
    const markup = await renderFailure("en-US", {
      code: "FUTURE_UNKNOWN_CODE",
    } as unknown as ProjectConfigValidationFailure);

    expect(markup).toContain("Check the project configuration.");
    expect(markup).not.toContain("FUTURE_UNKNOWN_CODE");
    expect(markup).not.toContain("projectConfiguration.validation.");
  });
});
