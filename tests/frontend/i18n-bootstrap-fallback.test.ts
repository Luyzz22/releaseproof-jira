import { Children, isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { evidenceOutcome } from "../../src/domain/models/evidence-outcome";
import type { TranslationFunction } from "../../src/frontend/i18n/context";
import { localizeEvidenceOutcome } from "../../src/frontend/i18n/evidence-presentation";
import { I18N_KEYS } from "../../src/frontend/i18n/keys";
import { localizeProjectConfigValidationFailure } from "../../src/frontend/i18n/project-config-validation";
import { formatDateTimeForLocale } from "../../src/frontend/utils/format";
import { releaseScopeExplanationForLocale } from "../../src/frontend/utils/release-scope";
import { buildMarkdownReport } from "../../src/frontend/utils/report";
import type { SupportedLocale } from "../../src/frontend/i18n/locale";
import { readinessDto } from "../fixtures/readiness-dto";

const renderMock = vi.hoisted(() => vi.fn());
const createTranslationFunctionMock = vi.hoisted(() => vi.fn());
const getContextMock = vi.hoisted(() => vi.fn());
const enableThemeMock = vi.hoisted(() => vi.fn());

vi.mock("react-dom/client", () => ({
  createRoot: () => ({ render: renderMock }),
}));

vi.mock("@forge/bridge", () => ({
  i18n: { createTranslationFunction: createTranslationFunctionMock },
  makeInvoke: () => vi.fn(),
  view: {
    getContext: getContextMock,
    theme: { enable: enableThemeMock },
  },
}));

function findTranslationFunction(value: unknown): TranslationFunction | null {
  if (!isValidElement(value)) return null;

  const props = value.props as {
    children?: ReactNode;
    t?: unknown;
  };
  if (typeof props.t === "function") {
    return props.t as TranslationFunction;
  }

  for (const child of Children.toArray(props.children)) {
    const translation = findTranslationFunction(child);
    if (translation) return translation;
  }

  return null;
}

interface TranslationRuntime {
  locale: SupportedLocale;
  t: TranslationFunction;
}

function findTranslationRuntime(value: unknown): TranslationRuntime | null {
  if (!isValidElement(value)) return null;

  const props = value.props as {
    children?: ReactNode;
    locale?: unknown;
    t?: unknown;
  };
  if (
    typeof props.t === "function" &&
    (props.locale === "en-US" || props.locale === "de-DE")
  ) {
    return {
      locale: props.locale,
      t: props.t as TranslationFunction,
    };
  }

  for (const child of Children.toArray(props.children)) {
    const runtime = findTranslationRuntime(child);
    if (runtime) return runtime;
  }

  return null;
}

describe("i18n bootstrap emergency fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    renderMock.mockReset();
    createTranslationFunctionMock.mockReset();
    getContextMock.mockReset();
    enableThemeMock.mockReset();

    createTranslationFunctionMock.mockRejectedValue(
      new Error("FORGE_TRANSLATION_BOOTSTRAP_FAILED"),
    );
    getContextMock.mockResolvedValue({ locale: "en-US" });
    enableThemeMock.mockResolvedValue(undefined);

    vi.stubGlobal("document", {
      documentElement: { lang: "en-US" },
      getElementById: () => ({}),
    });
  });

  it("renders complete en-US presentation without exposing keys when Forge translation creation fails", async () => {
    await import("../../src/frontend/main");

    await vi.waitFor(() => expect(renderMock).toHaveBeenCalledOnce());
    expect(createTranslationFunctionMock).toHaveBeenCalledOnce();

    const t = findTranslationFunction(renderMock.mock.calls[0]?.[0]);
    expect(t).not.toBeNull();
    if (!t)
      throw new Error("Bootstrap did not provide a translation function.");

    const regularUi = t(I18N_KEYS.loadingFull);
    const assistive = t(I18N_KEYS.shellHomeAria);
    const error = t(I18N_KEYS.errorAnalysisUnavailable);
    const validation = localizeProjectConfigValidationFailure(
      { code: "ACCEPTED_STATUSES_REQUIRED" },
      t,
    );
    const evidence = localizeEvidenceOutcome(
      evidenceOutcome("accepted-status/accepted", {
        statusName: "Freigabe für Kunde",
      }),
      "en-US",
      t,
    );
    const scope = releaseScopeExplanationForLocale(
      {
        projectKey: "DEMO",
        releaseScopeMode: "VERSION_ONLY",
      },
      t,
    );
    const invalidDate = formatDateTimeForLocale("invalid", "en-US", t);
    const markdown = buildMarkdownReport(readinessDto(), "en-US", t);

    expect(regularUi).toBe("ReleaseProof is loading …");
    expect(assistive).toBe("ReleaseProof home");
    expect(error).toBe("Analysis unavailable");
    expect(validation).toBe("Select at least one accepted status.");
    expect(evidence.explanation).toBe(
      "The status “Freigabe für Kunde” is configured as completed.",
    );
    expect(scope).toBe("fixVersion of the selected version in project DEMO");
    expect(invalidDate).toBe("Timestamp unavailable");
    expect(markdown).toContain("- Status: Ready");

    const testedOutputs = [
      regularUi,
      assistive,
      error,
      validation,
      evidence.title,
      evidence.explanation,
      evidence.remediation,
      scope,
      invalidDate,
      markdown,
    ];
    for (const output of testedOutputs) {
      expect(output).not.toMatch(
        /(?:shell|navigation|states|projectConfiguration|evidence|report|releaseScope)\./,
      );
    }

    const translateUnknown = t as unknown as (
      key: string,
      defaultValue?: string,
    ) => string;
    expect(translateUnknown("internal.noncanonical.key")).toBe(
      "Content unavailable.",
    );
    expect(
      translateUnknown("internal.noncanonical.key", "Safe explicit fallback"),
    ).toBe("Safe explicit fallback");
  });

  it("uses a coherent en-US runtime when translation creation fails for a de-DE context", async () => {
    getContextMock.mockResolvedValue({ locale: "de-DE" });

    await import("../../src/frontend/main");

    await vi.waitFor(() => expect(renderMock).toHaveBeenCalledOnce());
    const runtime = findTranslationRuntime(renderMock.mock.calls[0]?.[0]);
    expect(runtime).not.toBeNull();
    if (!runtime) throw new Error("Bootstrap did not provide an i18n runtime.");

    expect(document.documentElement.lang).toBe("en-US");
    expect(runtime.locale).toBe("en-US");

    const visibleText = runtime.t(I18N_KEYS.loadingFull);
    const assistiveText = runtime.t(I18N_KEYS.shellHomeAria);
    expect(visibleText).toBe("ReleaseProof is loading …");
    expect(assistiveText).toBe("ReleaseProof home");

    const timestamp = "2026-12-31T23:05:00.000Z";
    const expectedEnglishDate = new Date(timestamp).toLocaleString("en-US");
    const germanDate = new Date(timestamp).toLocaleString("de-DE");
    expect(expectedEnglishDate).not.toBe(germanDate);
    expect(formatDateTimeForLocale(timestamp, runtime.locale, runtime.t)).toBe(
      expectedEnglishDate,
    );

    const jiraRuntimeText = "Freigabe für Kunde";
    const evidence = localizeEvidenceOutcome(
      evidenceOutcome("accepted-status/accepted", {
        statusName: jiraRuntimeText,
      }),
      runtime.locale,
      runtime.t,
    );
    expect(evidence.explanation).toBe(
      `The status “${jiraRuntimeText}” is configured as completed.`,
    );

    const report = readinessDto();
    const jiraVersionName = "Release 2.4 — Kund:innenfreigabe";
    const markdown = buildMarkdownReport(
      {
        ...report,
        release: { ...report.release, versionName: jiraVersionName },
        generatedAt: timestamp,
      },
      runtime.locale,
      runtime.t,
    );
    expect(markdown).toContain(`# ReleaseProof: ${jiraVersionName}`);
    expect(markdown).toContain(expectedEnglishDate);
    expect(markdown).not.toContain(germanDate);
  });

  it.each([
    ["de-DE context", { locale: "de-DE" }, "de-DE"],
    ["en-US context", { locale: "en-US" }, "en-US"],
    ["unsupported context", { locale: "fr-FR" }, "en-US"],
    ["missing locale", {}, "en-US"],
  ] satisfies ReadonlyArray<
    readonly [string, Readonly<Record<string, unknown>>, SupportedLocale]
  >)(
    "preserves the normalized effective locale for a successful Forge translator with %s",
    async (_case, context, expectedLocale) => {
      const forgeTranslation: TranslationFunction = (key) => `FORGE:${key}`;
      createTranslationFunctionMock.mockResolvedValue(forgeTranslation);
      getContextMock.mockResolvedValue(context);

      await import("../../src/frontend/main");

      await vi.waitFor(() => expect(renderMock).toHaveBeenCalledOnce());
      const runtime = findTranslationRuntime(renderMock.mock.calls[0]?.[0]);
      expect(runtime).not.toBeNull();
      if (!runtime)
        throw new Error("Bootstrap did not provide an i18n runtime.");

      expect(runtime.t).toBe(forgeTranslation);
      expect(runtime.locale).toBe(expectedLocale);
      expect(document.documentElement.lang).toBe(expectedLocale);
    },
  );
});
