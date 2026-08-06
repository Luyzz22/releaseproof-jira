import { describe, expect, it } from "vitest";
import { jiraValueToText } from "../../src/infrastructure/jira/adf-to-text";

describe("Jira ADF und unbekannte Feldwerte", () => {
  it("übernimmt einen direkten String", () => {
    expect(jiraValueToText("Erstes Kriterium")).toBe("Erstes Kriterium");
  });

  it("normalisiert Whitespace in einem direkten String", () => {
    expect(jiraValueToText("  Erstes   Kriterium\n\tzweites  ")).toBe(
      "Erstes Kriterium zweites",
    );
  });

  it("begrenzt einen direkten String auf 50.000 Zeichen", () => {
    expect(jiraValueToText("x".repeat(60_000))).toHaveLength(50_000);
  });

  it("extrahiert Text aus einem gültigen ADF-Dokument", () => {
    expect(
      jiraValueToText({
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Erstes Kriterium" }],
          },
        ],
      }),
    ).toBe("Erstes Kriterium");
  });

  it("extrahiert Text aus verschachtelten ADF-Absätzen", () => {
    expect(
      jiraValueToText({
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Erstes Kriterium" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Zweites Kriterium" }],
          },
        ],
      }),
    ).toBe("Erstes Kriterium Zweites Kriterium");
  });

  it("begrenzt ADF-Text auf 50.000 Zeichen", () => {
    const text = jiraValueToText({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x".repeat(60_000) }],
        },
      ],
    });
    expect(text).toHaveLength(50_000);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["eine Zahl", 42],
    ["true", true],
    ["false", false],
    ["ein Array", ["Kriterium"]],
    ["ein value-Objekt", { value: "Freigegeben" }],
    ["ein text-Objekt ohne ADF-Dokument", { text: "Kein ADF-Dokument" }],
    ["ein Benutzerobjekt", { id: "123", displayName: "Max Mustermann" }],
    ["ein Optionsobjekt", { id: "1", value: "Option A" }],
    ["ein unbekanntes Objekt", { unknown: { nested: true } }],
    ["ein leeres ADF-Dokument", { type: "doc", content: [] }],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "liefert für %s null",
    (_case, value) => {
      expect(jiraValueToText(value)).toBeNull();
    },
  );
});
