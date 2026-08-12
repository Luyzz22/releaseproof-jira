from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"ABORT: expected snippet not found in {path}")
    path.write_text(text.replace(old, new, 1))


# SCRUM-49: count every scheduled content entry, including malformed primitives,
# before pushing it onto the traversal stack.
adf_path = Path("src/infrastructure/jira/adf-to-text.ts")
replace_once(
    adf_path,
    '''function hasSafeAdfNodeCount(value: unknown): boolean {
  const stack: unknown[] = [value];
  let nodes = 0;

  while (stack.length > 0) {
    const current = stack.pop();

    if (!isRecord(current)) continue;

    nodes += 1;
    if (nodes > MAX_NODES) return false;

    if (current.content === undefined) continue;
    if (!Array.isArray(current.content)) return false;

    for (const child of current.content) {
      stack.push(child);
    }
  }

  return true;
}
''',
    '''function hasSafeAdfNodeCount(value: unknown): boolean {
  const stack: unknown[] = [value];
  let scheduledEntries = 1;

  while (stack.length > 0) {
    const current = stack.pop();

    if (!isRecord(current)) continue;
    if (current.content === undefined) continue;
    if (!Array.isArray(current.content)) return false;

    if (scheduledEntries + current.content.length > MAX_NODES) {
      return false;
    }
    scheduledEntries += current.content.length;

    for (const child of current.content) {
      stack.push(child);
    }
  }

  return true;
}
''',
)


# SCRUM-48: validate every doc-shaped acceptance-criteria value, not only description.
gateway_path = Path("src/infrastructure/jira/forge-jira-gateway.ts")
replace_once(
    gateway_path,
    '''function hasAcceptanceCriteriaEvidence(
  value: unknown,
  fieldId: string,
): boolean {
  if (fieldId !== "description") {
    return jiraValueToText(value) !== null;
  }
  if (value === null) return false;
  if (!isStructurallyValidAdfDocument(value)) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "Issue search description returned an unexpected response.",
    );
  }
  return jiraValueToText(value) !== null;
}
''',
    '''function hasAcceptanceCriteriaEvidence(
  value: unknown,
  fieldId: string,
): boolean {
  if (value === null) return false;

  if (isRecord(value) && value.type === "doc") {
    if (!isStructurallyValidAdfDocument(value)) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        fieldId === "description"
          ? "Issue search description returned an unexpected response."
          : "Issue search acceptance criteria returned an unexpected response.",
      );
    }
    return jiraValueToText(value) !== null;
  }

  if (fieldId === "description") {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "Issue search description returned an unexpected response.",
    );
  }

  return jiraValueToText(value) !== null;
}
''',
)


# SCRUM-48 regression: malformed doc-shaped ADF from a custom text field must fail closed.
acceptance_test_path = Path("tests/infrastructure/acceptance-criteria-evidence.test.ts")
replace_once(
    acceptance_test_path,
    '''describe("Akzeptanzkriterien-Evidence", () => {
  it.each([
''',
    '''describe("Akzeptanzkriterien-Evidence", () => {
  it("weist malformed ADF aus einem Custom-Textfeld fail-closed zurück", async () => {
    await expect(
      mapAcceptanceCriteria({
        type: "doc",
        version: 1,
        content: [
          {
            type: "unsupportedBlock",
            content: [{ type: "text", text: "Kriterium" }],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it.each([
''',
)


# SCRUM-49 regression: prove that the schema validator is never invoked once the
# traversal budget is exceeded by primitive content entries.
adf_test_path = Path("tests/infrastructure/adf-to-text.test.ts")
replace_once(
    adf_test_path,
    '''import { describe, expect, it } from "vitest";
import { jiraValueToText } from "../../src/infrastructure/jira/adf-to-text";
''',
    '''import { Validator } from "jsonschema";
import { describe, expect, it, vi } from "vitest";
import {
  isStructurallyValidAdfDocument,
  jiraValueToText,
} from "../../src/infrastructure/jira/adf-to-text";
''',
)
replace_once(
    adf_test_path,
    '''describe("Jira ADF und unbekannte Feldwerte", () => {
  it("übernimmt einen direkten String", () => {
''',
    '''describe("Jira ADF und unbekannte Feldwerte", () => {
  it("stoppt mehr als 10.000 content-Einträge vor der Schema-Validierung", () => {
    const validateSpy = vi.spyOn(Validator.prototype, "validate");

    try {
      expect(
        isStructurallyValidAdfDocument({
          type: "doc",
          version: 1,
          content: Array.from({ length: 10_000 }, () => null),
        }),
      ).toBe(false);
      expect(validateSpy).not.toHaveBeenCalled();
    } finally {
      validateSpy.mockRestore();
    }
  });

  it("übernimmt einen direkten String", () => {
''',
)

print("SCRUM-48/49 changes applied successfully.")
