import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { I18N_KEYS } from "../../src/frontend/i18n/keys";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flattenTranslations(node: unknown, prefix = ""): Map<string, string> {
  if (typeof node === "string") {
    if (!prefix) {
      throw new Error("Translation root must be an object.");
    }

    return new Map([[prefix, node]]);
  }

  if (!isRecord(node)) {
    throw new Error(
      `Translation node "${prefix || "<root>"}" must be an object or string.`,
    );
  }

  const flattened = new Map<string, string>();

  for (const [key, value] of Object.entries(node)) {
    const childPrefix = prefix ? `${prefix}.${key}` : key;

    for (const [childKey, childValue] of flattenTranslations(
      value,
      childPrefix,
    )) {
      flattened.set(childKey, childValue);
    }
  }

  return flattened;
}

function loadTranslations(locale: "en-US" | "de-DE"): Map<string, string> {
  const source = readFileSync(
    resolve(process.cwd(), "locales", `${locale}.json`),
    "utf8",
  );

  const parsed = JSON.parse(source) as unknown;
  return flattenTranslations(parsed);
}

describe("Forge translation resource contract", () => {
  const registeredKeys = Object.values(I18N_KEYS).sort();
  const english = loadTranslations("en-US");
  const german = loadTranslations("de-DE");

  it("registers every translation key exactly once", () => {
    expect(new Set(registeredKeys).size).toBe(registeredKeys.length);
  });

  it("keeps en-US exactly aligned with the canonical key registry", () => {
    expect([...english.keys()].sort()).toEqual(registeredKeys);
  });

  it("keeps de-DE exactly aligned with the canonical key registry", () => {
    expect([...german.keys()].sort()).toEqual(registeredKeys);
  });

  it("keeps en-US and de-DE in exact key parity", () => {
    expect([...german.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("rejects empty translation values in every supported locale", () => {
    for (const translations of [english, german]) {
      for (const value of translations.values()) {
        expect(value.trim()).not.toBe("");
      }
    }
  });

  it("keeps the Forge manifest wired to both locales with en-US fallback", () => {
    const manifest = readFileSync(
      resolve(process.cwd(), "manifest.yml"),
      "utf8",
    );

    expect(manifest).toContain("path: locales/en-US.json");
    expect(manifest).toContain("path: locales/de-DE.json");
    expect(manifest).toContain("default: en-US");
    expect(manifest).toContain("i18n: app.title");
  });
});
