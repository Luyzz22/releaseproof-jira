import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layerDirectories = [
  "src/application/explanation/",
  "src/application/explain-finding/",
  "src/application/summarize-release/",
];

function layer(file: string): boolean {
  return layerDirectories.some((directory) => file.startsWith(directory));
}

function files(directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? files(path)
        : /\.tsx?$/.test(path)
          ? [path]
          : [];
    },
  );
}
const sources = files("src").map((file) => ({
  file,
  ast: ts.createSourceFile(
    file,
    readFileSync(join(root, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  ),
}));

describe("SCRUM-83 production isolation", () => {
  it("has no imports from the existing product into the R&D layer", () => {
    for (const { file, ast } of sources.filter(({ file }) => !layer(file))) {
      function visit(node: ts.Node): void {
        if (ts.isStringLiteral(node)) {
          const target = relative(
            root,
            resolve(root, dirname(file), node.text),
          );
          expect(layer(`${target}/`), `${file} -> ${node.text}`).toBe(false);
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
  });

  it("allows only model contracts, safe errors, Zod and internal explanation imports", () => {
    for (const { file, ast } of sources.filter(({ file }) => layer(file))) {
      function visit(node: ts.Node): void {
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          const name = node.moduleSpecifier.text;
          const target = relative(root, resolve(root, dirname(file), name));
          expect(
            name === "zod" ||
              layer(`${target}/`) ||
              [
                "src/domain/models/evidence-outcome",
                "src/domain/models/readiness",
                "src/shared/errors",
                "src/shared/release-readiness-dto",
              ].includes(target),
            `${file} -> ${name}`,
          ).toBe(true);
        }
        if (ts.isCallExpression(node)) {
          expect(node.expression.kind, file).not.toBe(
            ts.SyntaxKind.ImportKeyword,
          );
          if (ts.isIdentifier(node.expression)) {
            expect(
              ["require", "fetch", "eval", "Function"],
              file,
            ).not.toContain(node.expression.text);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
  });
});
