import { Validator } from "jsonschema";
import { describe, expect, it, vi } from "vitest";
import {
  isStructurallyValidAdfDocument,
  jiraValueToText,
} from "../../src/infrastructure/jira/adf-to-text";

describe("Jira ADF und unbekannte Feldwerte", () => {
  it("stoppt mehr als 10.000 content-Einträge vor der Schema-Validierung", () => {
    const validateSpy = vi.spyOn(Validator.prototype, "validate");

    try {
      expect(
        isStructurallyValidAdfDocument({
          type: "doc",
          version: 1,
          content: Array.from({ length: 10_000 }, () => null),
        }),
      ).toBe(false);
      expect(validateSpy).not.toHaveBeenCalled();
    } finally {
      validateSpy.mockRestore();
    }
  });

  it("stoppt übergroße marks-Arrays vor der Schema-Validierung", () => {
    const validateSpy = vi.spyOn(Validator.prototype, "validate");

    try {
      expect(
        isStructurallyValidAdfDocument({
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Kriterium",
                  marks: Array.from({ length: 10_000 }, () => ({
                    type: "strong",
                  })),
                },
              ],
            },
          ],
        }),
      ).toBe(false);
      expect(validateSpy).not.toHaveBeenCalled();
    } finally {
      validateSpy.mockRestore();
    }
  });

  it("übernimmt einen direkten String", () => {
    expect(jiraValueToText("Erstes Kriterium")).toBe("Erstes Kriterium");
  });

  it("normalisiert Whitespace in einem direkten String", () => {
    expect(jiraValueToText("  Erstes   Kriterium\n\tzweites  ")).toBe(
      "Erstes Kriterium zweites",
    );
  });

  it("behandelt formatierungs- und steuerzeichen-only Strings als leer", () => {
    expect(jiraValueToText("\u200B\u200B")).toBeNull();
    expect(jiraValueToText("\u0000\u200B\t")).toBeNull();
  });

  it("bewahrt Formatierungszeichen innerhalb sichtbaren Textes", () => {
    expect(jiraValueToText("Erstes\u200BKriterium")).toBe(
      "Erstes\u200BKriterium",
    );
  });

  it("weist einen direkten String über 50.000 Zeichen fail-closed zurück", () => {
    expect(() => jiraValueToText("x".repeat(50_001))).toThrowError(
      expect.objectContaining({ code: "JIRA_UNAVAILABLE" }),
    );
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

  it("behandelt ADF mit ausschließlich Formatierungszeichen als leer", () => {
    expect(
      jiraValueToText({
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "\u200B" }],
          },
        ],
      }),
    ).toBeNull();
  });

  it("bewahrt Formatierungszeichen in ansonsten sichtbarem ADF-Text", () => {
    expect(
      jiraValueToText({
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Erstes\u200BKriterium" }],
          },
        ],
      }),
    ).toBe("Erstes\u200BKriterium");
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

  it("weist ADF-Text über 50.000 Zeichen fail-closed zurück", () => {
    expect(() =>
      jiraValueToText({
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "x".repeat(50_001) }],
          },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
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
