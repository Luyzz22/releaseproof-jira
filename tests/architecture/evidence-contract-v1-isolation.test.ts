import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const baseline = "c7f87016f8436cb974f66f58157b8f114fb3598f";
const contractFile = "src/shared/evidence-contract-v1.ts";
const builderFile =
  "src/application/evidence-contract/build-evidence-contract-v1.ts";
const contractFiles = [contractFile, builderFile];

function sourceFiles(directory: string): string[] {
  return readdirSync(join(repositoryRoot, directory), {
    withFileTypes: true,
  }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(path)) ? [path] : [];
  });
}

function syntax(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(join(repositoryRoot, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function dependencies(source: ts.SourceFile): string[] {
  const result: string[] = [];
  const add = (node: ts.Node | undefined): void => {
    // A computed import cannot establish an auditable R&D isolation boundary.
    if (!node || !ts.isStringLiteralLike(node))
      throw new Error(`Non-literal dependency in ${source.fileName}`);
    const resolved = ts.resolveModuleName(
      node.text,
      resolve(repositoryRoot, source.fileName),
      { moduleResolution: ts.ModuleResolutionKind.Bundler },
      ts.sys,
    ).resolvedModule;
    if (!resolved) {
      // Vite's existing stylesheet import is an asset, not a TS module edge.
      const asset = resolve(
        repositoryRoot,
        dirname(source.fileName),
        node.text,
      );
      if (
        node.text.startsWith(".") &&
        node.text.endsWith(".css") &&
        ts.sys.fileExists(asset)
      ) {
        result.push(relative(repositoryRoot, asset));
        return;
      }
      throw new Error(`Unresolved dependency: ${node.text}`);
    }
    result.push(relative(repositoryRoot, resolved.resolvedFileName));
  };
  walk(source, (node) => {
    if (ts.isImportDeclaration(node)) add(node.moduleSpecifier);
    if (ts.isExportDeclaration(node) && node.moduleSpecifier)
      add(node.moduleSpecifier);
    if (ts.isImportTypeNode(node)) {
      if (!ts.isLiteralTypeNode(node.argument))
        throw new Error(`Non-literal import type in ${source.fileName}`);
      add(node.argument.literal);
    }
    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    )
      add(node.moduleReference.expression);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    )
      add(node.arguments[0]);
  });
  return result;
}

describe("Evidence Contract v1 R&D isolation", () => {
  it("has no incoming import/re-export/type/dynamic edge from existing src modules", () => {
    for (const file of sourceFiles("src")) {
      if (contractFiles.includes(file)) continue;
      // Any transitive path into either module must cross an incoming edge.
      // This covers domain, resolvers, frontend, reports, Jira and storage.
      expect(
        dependencies(syntax(file)).filter((path) =>
          contractFiles.includes(path),
        ),
        file,
      ).toEqual([]);
    }
  });

  it("depends only on the contract, domain constants/types and the existing DTO type", () => {
    expect(dependencies(syntax(contractFile))).toEqual([
      "src/domain/models/evidence-outcome.ts",
      "src/domain/models/readiness.ts",
    ]);
    expect(dependencies(syntax(builderFile))).toEqual([
      contractFile,
      "src/shared/release-readiness-dto.ts",
    ]);
    const dtoImport = syntax(builderFile).statements.find(
      (node): node is ts.ImportDeclaration =>
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text.endsWith("/release-readiness-dto"),
    );
    expect(dtoImport?.importClause?.isTypeOnly).toBe(true);
  });

  it("contains no network, logging, storage, clock, random, timer or dynamic-code capability", () => {
    // A closed import allowlist above prevents provider/Forge/Node dependencies;
    // inspect syntax below so comments and documentation are not runtime findings.
    const forbidden = new Set([
      "fetch",
      "requestJira",
      "invoke",
      "console",
      "Date",
      "Math",
      "performance",
      "crypto",
      "Intl",
      "localeCompare",
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "setImmediate",
      "clearImmediate",
      "queueMicrotask",
      "requestAnimationFrame",
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "caches",
      "storage",
      "kvs",
      "WebSocket",
      "XMLHttpRequest",
      "EventSource",
      "navigator",
      "window",
      "document",
      "self",
      "globalThis",
      "global",
      "process",
      "require",
      "eval",
      "Function",
    ]);
    for (const file of contractFiles) {
      const violations: string[] = [];
      walk(syntax(file), (node) => {
        if (ts.isIdentifier(node) && forbidden.has(node.text))
          violations.push(node.text);
        if (node.kind === ts.SyntaxKind.ImportKeyword)
          violations.push("dynamic import");
      });
      expect(violations, file).toEqual([]);
    }
  });

  it.each([
    "manifest.yml",
    "package.json",
    "package-lock.json",
    "src/shared/release-readiness-dto.ts",
    "src/application/analyze-release/to-release-readiness-dto.ts",
    "src/application/analyze-release/analyze-release.ts",
    "src/domain/services/analyze-release.ts",
  ])("preserves the Production baseline bytes of %s", (file) => {
    expect(readFileSync(join(repositoryRoot, file))).toEqual(
      execFileSync("git", ["show", `${baseline}:${file}`], {
        cwd: repositoryRoot,
      }),
    );
  });
});
