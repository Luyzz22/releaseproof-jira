import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ErrorState } from "../../src/frontend/components/error-state";
import { InlineError } from "../../src/frontend/components/inline-error";
import {
  I18nProvider,
  type TranslationFunction,
} from "../../src/frontend/i18n/context";
import {
  appErrorDefaultMessage,
  appErrorMessageKey,
} from "../../src/frontend/i18n/error-keys";
import type { SupportedLocale } from "../../src/frontend/i18n/locale";
import { APP_ERROR_CODES, type SafeError } from "../../src/shared/errors";

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

function messages(locale: SupportedLocale): Record<string, string> {
  return flattenTranslations(
    JSON.parse(
      readFileSync(resolve(process.cwd(), "locales", `${locale}.json`), "utf8"),
    ) as unknown,
  );
}

function translator(locale: SupportedLocale): TranslationFunction {
  const translations = messages(locale);

  return (key, defaultValue) => translations[key] ?? defaultValue ?? key;
}

function renderErrors(
  locale: SupportedLocale,
  t: TranslationFunction,
  error: SafeError,
): string {
  return renderToStaticMarkup(
    createElement(I18nProvider, {
      locale,
      t,
      children: createElement(
        "div",
        null,
        createElement(ErrorState, {
          error,
          onRetry: () => undefined,
        }),
        createElement(InlineError, {
          error,
          onDismiss: () => undefined,
        }),
      ),
    }),
  );
}

function visibleText(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const compatibilityError: SafeError = {
  code: "PERMISSION_DENIED",
  message: "COMPATIBILITY_MESSAGE_SENTINEL",
};

describe("SafeError code-first frontend presentation", () => {
  it("keeps emergency defaults exhaustive and equal to canonical en-US resources", () => {
    const english = messages("en-US");
    for (const code of APP_ERROR_CODES) {
      const key = appErrorMessageKey(code);

      expect(english[key]).toBeDefined();
      expect(appErrorDefaultMessage(code)).toBe(english[key]);
    }
  });

  it("renders canonical en-US messages and ignores SafeError.message", () => {
    const markup = renderErrors(
      "en-US",
      translator("en-US"),
      compatibilityError,
    );

    expect(markup).toContain(
      "You do not have the required Jira permissions for this action.",
    );
    expect(markup).not.toContain("COMPATIBILITY_MESSAGE_SENTINEL");
  });

  it("preserves canonical de-DE messages and ignores SafeError.message", () => {
    const markup = renderErrors(
      "de-DE",
      translator("de-DE"),
      compatibilityError,
    );

    expect(markup).toContain(
      "Für diese Aktion fehlen die erforderlichen Jira-Berechtigungen.",
    );
    expect(markup).not.toContain("COMPATIBILITY_MESSAGE_SENTINEL");
  });

  it("uses safe English defaults when translation creation failed", () => {
    const fallbackTranslation: TranslationFunction = (key, defaultValue) =>
      defaultValue ?? key;
    const markup = renderErrors(
      "en-US",
      fallbackTranslation,
      compatibilityError,
    );

    expect(markup).toContain(
      "You do not have the required Jira permissions for this action.",
    );
    expect(markup).not.toContain("errors.message.permissionDenied");
    expect(markup).not.toContain("COMPATIBILITY_MESSAGE_SENTINEL");
  });

  it("preserves localized retryAfterSeconds presentation", () => {
    const markup = renderErrors("de-DE", translator("de-DE"), {
      code: "RATE_LIMITED",
      message: "RATE_LIMITED",
      retryAfterSeconds: 45,
    });

    expect(visibleText(markup)).toContain(
      "Frühester neuer Versuch in etwa 45 Sekunden.",
    );
    expect(markup).toContain(
      "Jira begrenzt die Anfragen vorübergehend. Bitte versuchen Sie es später erneut.",
    );
  });

  it("wires both error components to code-first emergency defaults", () => {
    for (const path of [
      "src/frontend/components/error-state.tsx",
      "src/frontend/components/inline-error.tsx",
    ]) {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");

      expect(source).toContain("appErrorMessageKey(error.code)");
      expect(source).toContain("appErrorDefaultMessage(error.code)");
      expect(source).not.toContain("error.message");
    }
  });

  it("keeps the Forge transport fallback language-neutral and logging-free", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/frontend/api/client.ts"),
      "utf8",
    );

    expect(source).not.toContain("Die Verbindung zu Atlassian Forge");
    expect(source).toMatch(
      /code:\s*"UNKNOWN_ERROR",\s*message:\s*"UNKNOWN_ERROR"/s,
    );
    expect(source).not.toMatch(/console\.(?:log|error|warn)/);
    expect(source).toContain('transportSafe(invoke("getBootstrap"))');
    expect(source).toContain(
      'transportSafe(invoke("saveProjectConfig", input))',
    );
    expect(source).toContain(
      'transportSafe(invoke("analyzeRelease", { versionId }))',
    );
  });
});
