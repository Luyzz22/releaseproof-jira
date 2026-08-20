import { describe, expect, it } from "vitest";
import {
  normalizeStoredProjectConfig,
  projectConfigInputSchema,
  projectConfigSchema,
  RELEASE_SCOPE_JQL_MAX_LENGTH,
  validateReleaseScopeJql,
} from "../../src/shared/validation";
import { projectConfig } from "../fixtures/release";

describe("Release-Scope-JQL-Validierung", () => {
  it("liefert deutsche benutzerseitige Fehlermeldungen ohne technische Moduswerte", () => {
    const unsafe = validateReleaseScopeJql(
      "project = SCRUM AND status = foo;bar",
      "SCRUM",
    );
    expect(unsafe.valid).toBe(false);
    if (!unsafe.valid) {
      expect(unsafe.message).toContain("ungequoteten");
      expect(unsafe.message).not.toContain("unquoted");
      expect(unsafe.message).not.toContain("Release-Scope");
    }

    const invalidMode = projectConfigInputSchema.safeParse({
      ...projectConfig,
      releaseScopeMode: "VERSION_ONLY",
      releaseScopeJql: "project = SCRUM",
    });
    expect(invalidMode.success).toBe(false);
    if (!invalidMode.success) {
      const message = invalidMode.error.issues[0]?.message ?? "";
      expect(message).toContain("Expliziter JQL-Umfang");
      expect(message).not.toContain("JQL_SCOPE");
      expect(message).not.toContain("Release-Scope");
    }
  });
  it.each([
    "project = SCRUM",
    'project = "SCRUM"',
    "project = SCRUM AND key = SCRUM-1",
    "project = SCRUM AND key in (SCRUM-1, SCRUM-2, SCRUM-3)",
    "project = SCRUM AND key is not EMPTY",
    "project = SCRUM AND labels not in (skip-release, archived)",
    "project = SCRUM AND labels = release_2026",
    "project = SCRUM AND customfield_10042 = value-1",
    'project = SCRUM AND summary ~ "release ready"',
    'project = SCRUM AND summary ~ "foo;bar / release@ready"',
  ])("akzeptiert die unterstützte Syntax: %s", (jql) => {
    expect(validateReleaseScopeJql(jql, "SCRUM")).toEqual({ valid: true });
  });

  it.each([
    "project = SCRUM AND",
    "AND project = SCRUM",
    "project = SCRUM AND AND key = SCRUM-1",
    "project = SCRUM AND key",
    "project = SCRUM AND key =",
    "project = SCRUM AND = SCRUM-1",
    "project = SCRUM AND key in ()",
    "project = SCRUM AND key in (SCRUM-1,)",
    "project = SCRUM AND key in (,SCRUM-1)",
    "project = SCRUM AND key in (SCRUM-1 SCRUM-2)",
    "project = SCRUM AND key in (SCRUM-1",
    "project = SCRUM)",
    'project = "SCRUM',
    "project = SCRUM AND key = SCRUM-1 unexpected",
  ])("weist unvollständige oder unerwartete Syntax zurück: %s", (jql) => {
    expect(validateReleaseScopeJql(jql, "SCRUM")).toMatchObject({
      valid: false,
      code: "SYNTAX_INVALID",
    });
  });

  it.each([
    "project = SCRUM AND status = foo;bar",
    "project = SCRUM AND status = foo:bar",
    "project = SCRUM AND status = foo/bar",
    "project = SCRUM AND status = foo?bar",
    "project = SCRUM AND status = foo#bar",
    "project = SCRUM AND status = foo.bar",
    "project = SCRUM AND status = foo@bar",
    "project = SCRUM AND status = foo&bar",
  ])("weist reservierte Sonderzeichen in Bare Values zurück: %s", (jql) => {
    expect(validateReleaseScopeJql(jql, "SCRUM")).toMatchObject({
      valid: false,
      code: "SYNTAX_INVALID",
    });
  });

  it("akzeptiert Sonderzeichen weiterhin in gequoteten Values", () => {
    expect(
      validateReleaseScopeJql(
        'project = SCRUM AND status = "foo;bar/baz@example.com"',
        "SCRUM",
      ),
    ).toEqual({ valid: true });
  });

  it.each([
    'project = SCRUM AND labels = "fixVersion"',
    "project = SCRUM AND labels = fixVersion",
    'project = SCRUM AND summary ~ "fixVersions"',
  ])("erlaubt fixVersion ausschließlich als Klauselwert: %s", (jql) => {
    expect(validateReleaseScopeJql(jql, "SCRUM")).toEqual({ valid: true });
  });

  it.each([
    ["leer", "", "EMPTY"],
    ["ohne Projekt", "key = SCRUM-1", "PROJECT_REQUIRED"],
    [
      "falsches Projekt",
      "project = OTHER AND key = OTHER-1",
      "PROJECT_MISMATCH",
    ],
    [
      "mit fixVersion",
      "project = SCRUM AND fixVersion = 10000",
      "FIX_VERSION_FORBIDDEN",
    ],
    [
      "mit fixVersions",
      "project = SCRUM AND fixVersions = 10000",
      "FIX_VERSION_FORBIDDEN",
    ],
    [
      "mit ausbrechendem OR",
      "project = SCRUM OR key = SCRUM-1",
      "OR_FORBIDDEN",
    ],
  ])("weist %s zurück", (_case, jql, code) => {
    expect(validateReleaseScopeJql(jql, "SCRUM")).toMatchObject({
      valid: false,
      code,
    });
  });

  it("weist eine Überschreitung der definierten Maximallänge zurück", () => {
    const jql = `project = SCRUM AND text ~ "${"x".repeat(
      RELEASE_SCOPE_JQL_MAX_LENGTH,
    )}"`;
    expect(validateReleaseScopeJql(jql, "SCRUM")).toMatchObject({
      valid: false,
      code: "TOO_LONG",
    });
  });

  it("lehnt syntaktisch ungültiges JQL im gemeinsamen Eingabeschema ab", () => {
    const invalid = {
      ...projectConfig,
      releaseScopeMode: "JQL_SCOPE" as const,
      releaseScopeJql: "project = DEMO AND",
    };
    const parsed = projectConfigInputSchema.safeParse(invalid);
    const validation = validateReleaseScopeJql(invalid.releaseScopeJql, "DEMO");
    expect(parsed.success).toBe(false);
    expect(validation.valid).toBe(false);
    if (!parsed.success && !validation.valid) {
      expect(parsed.error.issues[0]?.message).toBe(validation.message);
    }
  });

  it("lehnt reservierte Bare-Value-Zeichen im gemeinsamen Eingabeschema ab", () => {
    const invalid = {
      ...projectConfig,
      releaseScopeMode: "JQL_SCOPE" as const,
      releaseScopeJql: "project = DEMO AND status = foo;bar",
    };
    const parsed = projectConfigInputSchema.safeParse(invalid);
    const validation = validateReleaseScopeJql(invalid.releaseScopeJql, "DEMO");
    expect(parsed.success).toBe(false);
    expect(validation).toMatchObject({ valid: false, code: "SYNTAX_INVALID" });
  });

  it("lehnt syntaktisch ungültiges JQL vor KVS-Schreibvorgang und Normalisierung ab", () => {
    const invalid = {
      ...projectConfig,
      releaseScopeJql: "project = DEMO AND",
    };
    expect(projectConfigSchema.safeParse(invalid).success).toBe(false);
    expect(normalizeStoredProjectConfig(invalid)).toBeNull();
  });

  it("lehnt unsichere Bare Values auch bei gespeicherter Konfiguration ab", () => {
    const invalid = {
      ...projectConfig,
      releaseScopeJql: "project = DEMO AND status = foo;bar",
    };
    expect(projectConfigSchema.safeParse(invalid).success).toBe(false);
    expect(normalizeStoredProjectConfig(invalid)).toBeNull();
  });

  it("fordert im JQL_SCOPE ein JQL und verbietet es in VERSION_ONLY", () => {
    const missing = projectConfigInputSchema.safeParse({
      ...projectConfig,
      releaseScopeJql: undefined,
    });
    const versionOnlyWithJql = projectConfigInputSchema.safeParse({
      ...projectConfig,
      releaseScopeMode: "VERSION_ONLY",
    });
    expect(missing.success).toBe(false);
    expect(versionOnlyWithJql.success).toBe(false);
  });
});
