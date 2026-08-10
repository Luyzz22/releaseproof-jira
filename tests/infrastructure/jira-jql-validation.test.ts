import { describe, expect, it } from "vitest";
import { parsedJqlIsValid } from "../../src/infrastructure/jira/forge-jira-client";

describe("Jira-JQL-Validierungsantwort", () => {
  it("akzeptiert eine von Jira erfolgreich validierte Abfrage", () => {
    expect(
      parsedJqlIsValid({
        queries: [{ query: "project = DEMO AND status = Fertig", structure: {} }],
      }),
    ).toBe(true);
  });

  it("lehnt einen von Jira nicht unterstützten Feldoperator ab", () => {
    expect(
      parsedJqlIsValid({
        queries: [
          {
            query: "project = DEMO AND status ~ Fertig",
            errors: ["The operator '~' is not supported by the 'status' field."],
          },
        ],
      }),
    ).toBe(false);
  });

  it("lehnt einen Jira-Parserfehler ab", () => {
    expect(
      parsedJqlIsValid({
        queries: [
          {
            query: "project = DEMO AND unknown = value",
            errors: ["Field 'unknown' does not exist."],
          },
        ],
      }),
    ).toBe(false);
  });

  it("ignoriert Warnungen ohne Validierungsfehler", () => {
    expect(
      parsedJqlIsValid({
        queries: [
          {
            query: "project = DEMO AND labels = future-label",
            warnings: ["The value does not currently exist."],
          },
        ],
      }),
    ).toBe(true);
  });

  it.each([
    ["fehlende queries", {}],
    ["queries als Objekt", { queries: {} }],
    ["keine Query", { queries: [] }],
    ["mehrere Queries", { queries: [{}, {}] }],
    ["malformed Query", { queries: [null] }],
    ["errors als null", { queries: [{ errors: null }] }],
    ["malformed error", { queries: [{ errors: [null] }] }],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "bricht bei %s fail-closed ab",
    (_case, value) => {
      expect(() => parsedJqlIsValid(value)).toThrowError(
        expect.objectContaining({ code: "JIRA_UNAVAILABLE" }),
      );
    },
  );
});
