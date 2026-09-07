import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("SCRUM-46 documentation language contract", () => {
  it("keeps AGENTS i18n governance aligned with the product", () => {
    const agents = source("AGENTS.md");

    expect(agents).not.toContain("All user-facing strings are German.");
    expect(agents).toContain("en-US");
    expect(agents).toContain("de-DE");
    expect(agents).toMatch(/default\/fallback/i);
  });

  it("documents user-facing locale behavior in the README", () => {
    const readme = source("README.md");

    expect(readme).toContain("en-US");
    expect(readme).toContain("de-DE");
    expect(readme).toMatch(/Atlassian\/Jira-Benutzerkontext/i);
    expect(readme).toMatch(/Fallback/i);
    expect(readme).toMatch(/keine (?:eigene|separate) Sprachauswahl/i);
    expect(readme).toMatch(/kein separates Benutzerkonto/i);
  });

  it("removes the stale implementation-plan language description", () => {
    const plan = source("docs/implementation-plan.md");

    expect(plan).not.toContain("deutsche React-Oberfläche");
    expect(plan).toContain("en-US");
    expect(plan).toContain("de-DE");
  });

  it("declares localization explicitly in product scope", () => {
    const productScope = source("docs/product-scope.md");
    const inScope = productScope.match(
      /## In Scope([\s\S]*?)## Out of Scope/,
    )?.[1];

    expect(inScope).toMatch(/lokalisierte Benutzeroberfläche/i);
    expect(inScope).toContain("en-US");
    expect(inScope).toContain("de-DE");
  });

  it("provides an internal-only Marketplace positioning source", () => {
    const relativePath = "docs/marketplace-positioning.md";

    expect(existsSync(resolve(process.cwd(), relativePath))).toBe(true);
    const marketplace = source(relativePath);

    expect(marketplace).toMatch(/interne Listing-Grundlage/i);
    expect(marketplace).toContain("en-US");
    expect(marketplace).toContain("de-DE");
    expect(marketplace).toMatch(/Default\s*\/\s*Fallback/i);
    expect(marketplace).toMatch(
      /Atlassian\/Jira-Benutzer(?:sprache|kontext|locale)/i,
    );
    expect(marketplace).toMatch(/deterministisch/i);
    expect(marketplace).toMatch(/keine KI-/i);
    expect(marketplace).toMatch(/LLM-Aufrufe/i);
    expect(marketplace).toMatch(/keine Jira-(?:Vorgänge|Schreibzugriffe)/i);
    expect(marketplace).toContain("read:jira-work");
    expect(marketplace).toContain("storage:app");
    expect(marketplace).toMatch(/keine externen Runtime-Hosts oder Remotes/i);
    expect(marketplace).toMatch(/separate(?:s|n)? Listing-Review/i);
    expect(marketplace).not.toContain("https://marketplace.atlassian.com/");
    expect(marketplace).not.toMatch(
      /^Status:.*Available on Atlassian Marketplace/im,
    );
  });

  it("matches the implemented locale source of truth", () => {
    const locale = source("src/frontend/i18n/locale.ts");
    const manifest = source("manifest.yml");

    expect(locale).toContain(
      'export const SUPPORTED_LOCALES = ["en-US", "de-DE"] as const;',
    );
    expect(locale).toContain(
      'export const DEFAULT_LOCALE: SupportedLocale = "en-US";',
    );
    expect(manifest).toMatch(/fallback:\s*\n\s*default: en-US/);
  });
});
