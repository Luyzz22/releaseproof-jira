import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const harness = "tests/ai-eval/";

function files(directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? files(path)
        : /\.tsx?$/u.test(path)
          ? [path]
          : [];
    },
  );
}

// Load sources once, as in the parent's architecture tests. Filesystem latency
// is setup work; the timed assertions below inspect the parsed dependency graph.
function sources(directory: string) {
  return files(directory).map((file) => ({
    file,
    ast: ts.createSourceFile(
      file,
      readFileSync(join(root, file), "utf8"),
      ts.ScriptTarget.Latest,
      true,
    ),
  }));
}
const productionSources = sources("src");
const harnessSources = sources("tests/ai-eval").filter(
  ({ file }) => !file.endsWith(".test.ts"),
);

function inspect(ast: ts.SourceFile, check: (node: ts.Node) => void): void {
  function visit(node: ts.Node): void {
    check(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

describe("SCRUM-86 offline isolation", () => {
  it("has no production imports/re-exports into the harness or test fixtures", () => {
    for (const { file, ast } of productionSources) {
      inspect(ast, (node) => {
        if (
          ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node)
        ) {
          const target = relative(
            root,
            resolve(root, dirname(file), node.text),
          );
          expect(target.startsWith("tests/"), `${file} -> ${node.text}`).toBe(
            false,
          );
          expect(node.text, file).not.toMatch(/ai-eval|eval-harness/u);
        }
      });
    }
  });

  it("allows only internal modules, domain codes, Evidence Contract v1 and the pure summary adapter", () => {
    for (const { file, ast } of harnessSources) {
      inspect(ast, (node) => {
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          const target = relative(
            root,
            resolve(root, dirname(file), node.moduleSpecifier.text),
          );
          const internal =
            target.startsWith(harness) && !target.endsWith(".test");
          const model = [
            "src/domain/models/evidence-outcome",
            "src/domain/models/readiness",
          ].includes(target);
          const contract = target === "src/application/explanation/contracts";
          const adapter =
            target === "src/application/explanation/evidence-envelope";
          const evidence = target === "src/shared/evidence-contract-v1";
          expect(
            internal || model || contract || adapter || evidence,
            `${file} -> ${target}`,
          ).toBe(true);
          if (contract)
            expect(
              ts.isImportDeclaration(node) && node.importClause?.isTypeOnly,
            ).toBe(true);
        }
        if (ts.isIdentifier(node)) {
          expect(
            [
              "fetch",
              "axios",
              "XMLHttpRequest",
              "WebSocket",
              "EventSource",
              "sendBeacon",
              "OpenAI",
              "Anthropic",
              "Gemini",
              "Mistral",
              "Rovo",
              "requestJira",
              "console",
              "localStorage",
              "sessionStorage",
              "indexedDB",
              "process",
              "Date",
              "performance",
              "crypto",
              "setTimeout",
              "setInterval",
              "queueMicrotask",
              "require",
              "eval",
              "Function",
              "globalThis",
              "window",
              "document",
              "navigator",
            ],
            `${file}: ${node.text}`,
          ).not.toContain(node.text);
        }
        if (ts.isCallExpression(node))
          expect(node.expression.kind, file).not.toBe(
            ts.SyntaxKind.ImportKeyword,
          );
        if (ts.isPropertyAccessExpression(node)) {
          expect(node.getText(), file).not.toBe("Math.random");
        }
        if (ts.isStringLiteral(node))
          expect(node.text, file).not.toMatch(
            /^(?:https?:\/\/|@forge\/|node:)/u,
          );
      });
    }
  });
});
