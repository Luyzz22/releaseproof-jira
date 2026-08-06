import { describe, expect, it } from "vitest";
import {
  hasSupportedAcceptanceCriteriaField,
  isSupportedAcceptanceCriteriaField,
  type AcceptanceCriteriaFieldDescriptor,
} from "../../src/shared/acceptance-criteria-field";

function field(
  overrides: Partial<AcceptanceCriteriaFieldDescriptor> = {},
): AcceptanceCriteriaFieldDescriptor {
  return {
    id: "customfield_10042",
    custom: true,
    schemaType: "string",
    ...overrides,
  };
}

describe("Akzeptanzkriterien-Feldklassifikation", () => {
  it("erlaubt benutzerdefinierte Textfelder und das Beschreibungsfeld", () => {
    expect(isSupportedAcceptanceCriteriaField(field())).toBe(true);
    expect(
      isSupportedAcceptanceCriteriaField(
        field({ id: "description", custom: false, schemaType: null }),
      ),
    ).toBe(true);
  });

  it.each(["number", "boolean", "date", "datetime", "option", "user", "array"])(
    'verwirft den nicht-textuellen schemaType "%s"',
    (schemaType) => {
      expect(isSupportedAcceptanceCriteriaField(field({ schemaType }))).toBe(
        false,
      );
    },
  );

  it("verwirft technische Systemfelder, unbekannte Schemas und fehlende Feld-IDs", () => {
    expect(
      isSupportedAcceptanceCriteriaField(
        field({ id: "summary", custom: false }),
      ),
    ).toBe(false);
    expect(
      isSupportedAcceptanceCriteriaField(field({ schemaType: null })),
    ).toBe(false);
    expect(
      hasSupportedAcceptanceCriteriaField([field()], "customfield_99999"),
    ).toBe(false);
  });
});
