from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"Expected exactly one match in {path}: {text.count(old)}")
    path.write_text(text.replace(old, new, 1))


adf_path = ROOT / "src/infrastructure/jira/adf-to-text.ts"
adf_marker = '''const FORMAT_OR_CONTROL = /[\\p{Cc}\\p{Cf}]/gu;

interface CollectionState {
'''
adf_validator = '''const FORMAT_OR_CONTROL = /[\\p{Cc}\\p{Cf}]/gu;

const ADF_TOP_LEVEL_TYPES = new Set([
  "blockquote",
  "bulletList",
  "codeBlock",
  "expand",
  "heading",
  "mediaGroup",
  "mediaSingle",
  "orderedList",
  "panel",
  "paragraph",
  "rule",
  "table",
]);
const ADF_INLINE_TYPES = new Set([
  "date",
  "emoji",
  "hardBreak",
  "inlineCard",
  "mention",
  "status",
  "text",
  "mediaInline",
]);
const ADF_MARK_TYPES = new Set([
  "border",
  "code",
  "em",
  "link",
  "strike",
  "strong",
  "subsup",
  "textColor",
  "underline",
]);

interface ValidationState {
  nodes: number;
}

function validOptionalAttrs(node: Record<string, unknown>): boolean {
  return node.attrs === undefined || isRecord(node.attrs);
}

function validMarks(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every(
    (mark) =>
      isRecord(mark) &&
      typeof mark.type === "string" &&
      ADF_MARK_TYPES.has(mark.type) &&
      (mark.attrs === undefined || isRecord(mark.attrs)),
  );
}

function validNodeMarks(node: Record<string, unknown>, type: string): boolean {
  if (node.marks === undefined) return true;
  if (type !== "text" && type !== "media" && type !== "expand") {
    return false;
  }
  return validMarks(node.marks);
}

function validChildren(
  node: Record<string, unknown>,
  allowedTypes: ReadonlySet<string>,
  state: ValidationState,
  minimum: number,
  maximum?: number,
): boolean {
  if (node.content === undefined) return minimum === 0;
  if (!Array.isArray(node.content)) return false;
  if (node.content.length < minimum) return false;
  if (maximum !== undefined && node.content.length > maximum) return false;
  return node.content.every((child) =>
    validAdfNode(child, allowedTypes, state),
  );
}

function validLeaf(node: Record<string, unknown>): boolean {
  return node.content === undefined;
}

function validAdfNode(
  value: unknown,
  allowedTypes: ReadonlySet<string>,
  state: ValidationState,
): boolean {
  state.nodes += 1;
  if (state.nodes > MAX_NODES || !isRecord(value)) return false;

  const type = typeof value.type === "string" ? value.type : null;
  if (!type || !allowedTypes.has(type)) return false;
  if (!validOptionalAttrs(value) || !validNodeMarks(value, type)) return false;

  switch (type) {
    case "paragraph":
      return validChildren(value, ADF_INLINE_TYPES, state, 0);
    case "heading": {
      if (!isRecord(value.attrs)) return false;
      const level = value.attrs.level;
      return (
        typeof level === "number" &&
        Number.isInteger(level) &&
        level >= 1 &&
        level <= 6 &&
        validChildren(value, ADF_INLINE_TYPES, state, 0)
      );
    }
    case "blockquote":
      return validChildren(
        value,
        new Set([
          "paragraph",
          "bulletList",
          "orderedList",
          "codeBlock",
          "mediaGroup",
          "mediaSingle",
        ]),
        state,
        1,
      );
    case "bulletList":
    case "orderedList":
      return validChildren(value, new Set(["listItem"]), state, 1);
    case "listItem":
      return validChildren(
        value,
        new Set([
          "bulletList",
          "codeBlock",
          "mediaSingle",
          "orderedList",
          "paragraph",
        ]),
        state,
        1,
      );
    case "codeBlock": {
      if (value.content === undefined) return true;
      if (!Array.isArray(value.content) || value.content.length === 0) {
        return false;
      }
      return value.content.every((child) => {
        if (!validAdfNode(child, new Set(["text"]), state)) return false;
        return isRecord(child) && child.marks === undefined;
      });
    }
    case "panel": {
      if (!isRecord(value.attrs)) return false;
      const panelType = value.attrs.panelType;
      if (
        typeof panelType !== "string" ||
        !new Set(["info", "note", "warning", "success", "error"]).has(
          panelType,
        )
      ) {
        return false;
      }
      return validChildren(
        value,
        new Set(["bulletList", "heading", "orderedList", "paragraph"]),
        state,
        1,
      );
    }
    case "expand":
      return (
        isRecord(value.attrs) &&
        validChildren(
          value,
          new Set([
            "bulletList",
            "blockquote",
            "codeBlock",
            "heading",
            "mediaGroup",
            "mediaSingle",
            "orderedList",
            "panel",
            "paragraph",
            "rule",
            "table",
            "nestedExpand",
          ]),
          state,
          1,
        )
      );
    case "nestedExpand":
      return (
        isRecord(value.attrs) &&
        validChildren(
          value,
          new Set(["paragraph", "heading", "mediaGroup", "mediaSingle"]),
          state,
          1,
        )
      );
    case "mediaGroup":
      return validChildren(value, new Set(["media"]), state, 1);
    case "mediaSingle":
      return (
        isRecord(value.attrs) &&
        typeof value.attrs.layout === "string" &&
        validChildren(value, new Set(["media"]), state, 1, 1)
      );
    case "media": {
      if (!validLeaf(value) || !isRecord(value.attrs)) return false;
      const id = value.attrs.id;
      const mediaType = value.attrs.type;
      const collection = value.attrs.collection;
      return (
        typeof id === "string" &&
        id.trim().length > 0 &&
        (mediaType === "file" || mediaType === "link") &&
        typeof collection === "string" &&
        collection.trim().length > 0
      );
    }
    case "table":
      return validChildren(value, new Set(["tableRow"]), state, 1);
    case "tableRow":
      return validChildren(
        value,
        new Set(["tableCell", "tableHeader"]),
        state,
        1,
      );
    case "tableCell":
    case "tableHeader":
      return validChildren(
        value,
        new Set([
          "blockquote",
          "bulletList",
          "codeBlock",
          "heading",
          "mediaGroup",
          "nestedExpand",
          "orderedList",
          "panel",
          "paragraph",
          "rule",
        ]),
        state,
        1,
      );
    case "rule":
      return validLeaf(value);
    case "text":
      return (
        validLeaf(value) &&
        typeof value.text === "string" &&
        value.text.length > 0
      );
    case "date":
      return (
        validLeaf(value) &&
        isRecord(value.attrs) &&
        typeof value.attrs.timestamp === "string" &&
        value.attrs.timestamp.trim().length > 0
      );
    case "emoji":
      return (
        validLeaf(value) &&
        isRecord(value.attrs) &&
        typeof value.attrs.shortName === "string" &&
        value.attrs.shortName.trim().length > 0
      );
    case "mention":
      return (
        validLeaf(value) &&
        isRecord(value.attrs) &&
        typeof value.attrs.id === "string" &&
        value.attrs.id.trim().length > 0
      );
    case "status":
      return (
        validLeaf(value) &&
        isRecord(value.attrs) &&
        typeof value.attrs.text === "string" &&
        value.attrs.text.trim().length > 0
      );
    case "hardBreak":
      return validLeaf(value);
    case "inlineCard":
    case "mediaInline":
      return validLeaf(value) && isRecord(value.attrs);
    default:
      return false;
  }
}

export function isStructurallyValidAdfDocument(value: unknown): boolean {
  if (
    !isRecord(value) ||
    value.type !== "doc" ||
    value.version !== 1 ||
    !Array.isArray(value.content)
  ) {
    return false;
  }

  const state: ValidationState = { nodes: 1 };
  return value.content.every((child) =>
    validAdfNode(child, ADF_TOP_LEVEL_TYPES, state),
  );
}

interface CollectionState {
'''
replace_once(adf_path, adf_marker, adf_validator)


gateway_path = ROOT / "src/infrastructure/jira/forge-jira-gateway.ts"
replace_once(
    gateway_path,
    'import { jiraValueToText } from "./adf-to-text";\n',
    'import {\n  isStructurallyValidAdfDocument,\n  jiraValueToText,\n} from "./adf-to-text";\n',
)
replace_once(
    gateway_path,
    '''  if (\n    !isRecord(value) ||\n    value.type !== "doc" ||\n    value.version !== 1 ||\n    !Array.isArray(value.content)\n  ) {\n''',
    '''  if (!isStructurallyValidAdfDocument(value)) {\n''',
)


client_path = ROOT / "src/infrastructure/jira/forge-jira-client.ts"
replace_once(
    client_path,
    '''  if (warnings.length === 0) {\n    const structure = requireRecord(\n      query.structure,\n      "JQL validation structure",\n    );\n    requireRecord(structure.where, "JQL validation where structure");\n  } else if (query.structure !== undefined) {\n    const structure = requireRecord(\n      query.structure,\n      "JQL validation structure",\n    );\n    if (structure.where !== undefined) {\n      requireRecord(structure.where, "JQL validation where structure");\n    }\n  }\n\n  return true;\n''',
    '''  void warnings;\n  const structure = requireRecord(\n    query.structure,\n    "JQL validation structure",\n  );\n  requireRecord(structure.where, "JQL validation where structure");\n\n  return true;\n''',
)


jql_test_path = ROOT / "tests/infrastructure/jira-jql-validation.test.ts"
replace_once(
    jql_test_path,
    '''  it("akzeptiert dokumentierte Warnungsantworten ohne Parse-Struktur", () => {\n    const jql = "project = DEMO AND labels = future-label";\n    expect(\n      parsedJqlIsValid(\n        {\n          queries: [\n            {\n              query: jql,\n              warnings: ["The value does not currently exist."],\n            },\n          ],\n        },\n        jql,\n      ),\n    ).toBe(true);\n  });\n''',
    '''  it("weist Warnungsantworten ohne Parse-Struktur fail-closed zurück", () => {\n    const jql = "project = DEMO AND labels = future-label";\n    expect(() =>\n      parsedJqlIsValid(\n        {\n          queries: [\n            {\n              query: jql,\n              warnings: ["The value does not currently exist."],\n            },\n          ],\n        },\n        jql,\n      ),\n    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));\n  });\n\n  it("akzeptiert Warnungsantworten mit nachgewiesener Parse-Struktur", () => {\n    const jql = "project = DEMO AND labels = future-label";\n    expect(\n      parsedJqlIsValid(\n        {\n          queries: [\n            {\n              query: jql,\n              warnings: ["The value does not currently exist."],\n              structure: { where: { operator: "and" } },\n            },\n          ],\n        },\n        jql,\n      ),\n    ).toBe(true);\n  });\n''',
)


acceptance_test_path = ROOT / "tests/infrastructure/acceptance-criteria-evidence.test.ts"
replace_once(
    acceptance_test_path,
    '''    [\n      "ADF mit nicht-arrayförmigem content",\n      { type: "doc", version: 1, content: {} },\n    ],\n''',
    '''    [\n      "ADF mit nicht-arrayförmigem content",\n      { type: "doc", version: 1, content: {} },\n    ],\n    [\n      "Inline-Text direkt unter doc",\n      {\n        type: "doc",\n        version: 1,\n        content: [{ type: "text", text: "Kriterium" }],\n      },\n    ],\n    [\n      "Liste mit Absatz statt listItem",\n      {\n        type: "doc",\n        version: 1,\n        content: [\n          {\n            type: "bulletList",\n            content: [\n              {\n                type: "paragraph",\n                content: [{ type: "text", text: "Kriterium" }],\n              },\n            ],\n          },\n        ],\n      },\n    ],\n    [\n      "Tabelle mit tableCell direkt unter table",\n      {\n        type: "doc",\n        version: 1,\n        content: [\n          {\n            type: "table",\n            content: [\n              {\n                type: "tableCell",\n                content: [\n                  {\n                    type: "paragraph",\n                    content: [{ type: "text", text: "Kriterium" }],\n                  },\n                ],\n              },\n            ],\n          },\n        ],\n      },\n    ],\n''',
)
replace_once(
    acceptance_test_path,
    '''  it.each([\n    ["null", null],\n''',
    '''  it("akzeptiert eine gültige ADF-Liste", async () => {\n    await expect(\n      mapDescriptionAcceptanceCriteria({\n        type: "doc",\n        version: 1,\n        content: [\n          {\n            type: "bulletList",\n            content: [\n              {\n                type: "listItem",\n                content: [\n                  {\n                    type: "paragraph",\n                    content: [{ type: "text", text: "Kriterium" }],\n                  },\n                ],\n              },\n            ],\n          },\n        ],\n      }),\n    ).resolves.toBe(true);\n  });\n\n  it("akzeptiert eine gültige ADF-Tabelle", async () => {\n    await expect(\n      mapDescriptionAcceptanceCriteria({\n        type: "doc",\n        version: 1,\n        content: [\n          {\n            type: "table",\n            content: [\n              {\n                type: "tableRow",\n                content: [\n                  {\n                    type: "tableCell",\n                    content: [\n                      {\n                        type: "paragraph",\n                        content: [{ type: "text", text: "Kriterium" }],\n                      },\n                    ],\n                  },\n                ],\n              },\n            ],\n          },\n        ],\n      }),\n    ).resolves.toBe(true);\n  });\n\n  it.each([\n    ["null", null],\n''',
)

print("SCRUM-44/45 changes applied successfully.")
