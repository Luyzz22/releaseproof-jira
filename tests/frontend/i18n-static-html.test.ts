import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("static HTML default language contract", () => {
  it("uses en-US as the safe pre-bootstrap document language", () => {
    const html = source("src/frontend/index.html");

    expect(html).toContain('<html lang="en-US">');
    expect(html).not.toContain('<html lang="de">');
    expect(html).toContain("<title>ReleaseProof</title>");
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('<script type="module" src="/main.tsx"></script>');
  });

  it("preserves the runtime document-language override", () => {
    const main = source("src/frontend/main.tsx");

    expect(main).toContain(
      "normalizeSupportedLocale(readContextLocale(context))",
    );
    expect(main).toContain("document.documentElement.lang = locale");
  });

  it("keeps the locale and manifest fallback contracts aligned", () => {
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
