import { describe, expect, it } from "vitest";
import {
  projectConfigInputSchema,
  RELEASE_SCOPE_JQL_MAX_LENGTH,
  validateReleaseScopeJql,
} from "../../src/shared/validation";
import { projectConfig } from "../fixtures/release";

describe("Release-Scope-JQL-Validierung", () => {
  it("akzeptiert den kontrollierten, projektgebundenen Test-Scope", () => {
    const jql = "project = SCRUM AND key in (SCRUM-1, SCRUM-2, SCRUM-3)";
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
      "project = SCRUM AND fixVersion is EMPTY",
      "FIX_VERSION_FORBIDDEN",
    ],
    [
      "mit ausbrechendem OR",
      "project = SCRUM OR project = OTHER",
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

  it("verwendet für Client und Resolver dasselbe fachliche Schema", () => {
    const invalid = {
      ...projectConfig,
      releaseScopeMode: "JQL_SCOPE" as const,
      releaseScopeJql: "project = OTHER",
    };
    const parsed = projectConfigInputSchema.safeParse(invalid);
    const validation = validateReleaseScopeJql(invalid.releaseScopeJql, "DEMO");
    expect(parsed.success).toBe(false);
    expect(validation.valid).toBe(false);
    if (!parsed.success && !validation.valid) {
      expect(parsed.error.issues[0]?.message).toBe(validation.message);
    }
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
