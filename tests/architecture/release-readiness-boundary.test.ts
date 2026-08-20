import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), "utf8");
}

function sourceFiles(directory: string): string[] {
  return readdirSync(join(repositoryRoot, directory), {
    withFileTypes: true,
  }).flatMap((entry) => {
    const relativePath = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(relativePath);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [relativePath] : [];
  });
}

describe("Architekturgrenze für Analyseergebnisse", () => {
  it("exportiert am Resolver und im Frontend nur den DTO-Ergebnistyp", () => {
    const resolverContract = source("src/shared/resolver-contract.ts");
    expect(resolverContract).not.toMatch(/\bReleaseReadinessResult\b/);
    expect(resolverContract).toContain("ReleaseReadinessResultDto");

    for (const file of sourceFiles("src/frontend")) {
      expect(source(file), file).not.toMatch(/\bReleaseReadinessResult\b/);
    }
  });

  it("verwendet im Mapper keine internen Objekt-Spreads oder Array-Referenzen", () => {
    const mapper = source(
      "src/application/analyze-release/to-release-readiness-dto.ts",
    );

    expect(mapper).not.toMatch(/\.\.\.\s*result\b/);
    expect(mapper).not.toMatch(/\.\.\.\s*result\.release\b/);
    expect(mapper).not.toMatch(/\.\.\.\s*issue\b/);
    expect(mapper).not.toMatch(/issues:\s*result\.release\.issues\s*[,}]/);
    expect(mapper).toContain("result.release.issues.map");
    expect(mapper).toContain("issueResult.evidence.map");
  });
});
