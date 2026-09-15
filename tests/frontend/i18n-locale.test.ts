import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  normalizeSupportedLocale,
  readContextLocale,
} from "../../src/frontend/i18n/locale";

describe("frontend i18n locale contract", () => {
  it("keeps de-DE as the supported German locale", () => {
    expect(normalizeSupportedLocale("de-DE")).toBe("de-DE");
  });

  it("keeps en-US as the default locale", () => {
    expect(normalizeSupportedLocale("en-US")).toBe("en-US");
    expect(DEFAULT_LOCALE).toBe("en-US");
  });

  it("falls back deterministically to en-US for unsupported locales", () => {
    for (const locale of ["fr-FR", "de-AT", "en-GB", "", null, undefined]) {
      expect(normalizeSupportedLocale(locale)).toBe("en-US");
    }
  });

  it("reads only a string locale from the Forge view context", () => {
    expect(readContextLocale({ locale: "de-DE" })).toBe("de-DE");
    expect(readContextLocale({ locale: "en-US" })).toBe("en-US");
    expect(readContextLocale({ locale: 123 })).toBeNull();
    expect(readContextLocale({})).toBeNull();
    expect(readContextLocale(null)).toBeNull();
  });
});
