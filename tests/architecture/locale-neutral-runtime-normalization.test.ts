import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("locale-neutral runtime normalization", () => {
  it.each([
    ["approval-marker rule", "src/domain/rules/approval-marker-present.ts"],
    ["blocker-label rule", "src/domain/rules/no-blocker-label.ts"],
    ["Jira link mapping", "src/infrastructure/jira/forge-jira-gateway.ts"],
  ] as const)("keeps %s independent of de-DE", (_case, relativePath) => {
    const implementation = source(relativePath);

    expect(implementation).not.toContain('toLocaleLowerCase("de-DE")');
    expect(implementation).toContain(".toLowerCase()");
  });
});
