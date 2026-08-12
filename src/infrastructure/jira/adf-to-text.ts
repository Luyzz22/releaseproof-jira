import { Validator } from "jsonschema";
import adfSchema from "./adf-schema.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const MAX_NODES = 10_000;
const MAX_TEXT_LENGTH = 50_000;
const FORMAT_OR_CONTROL = /[\p{Cc}\p{Cf}]/gu;

const adfValidator = new Validator();

function hasSafeAdfNodeCount(value: unknown): boolean {
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

export function isStructurallyValidAdfDocument(value: unknown): boolean {
  if (
    !isRecord(value) ||
    value.type !== "doc" ||
    value.version !== 1 ||
    !Array.isArray(value.content) ||
    !hasSafeAdfNodeCount(value)
  ) {
    return false;
  }

  try {
    return adfValidator.validate(value, adfSchema).valid;
  } catch {
    return false;
  }
}

interface CollectionState {
  nodes: number;
  textLength: number;
}

function collectAdfNode(
  value: unknown,
  output: string[],
  state: CollectionState,
): void {
  state.nodes += 1;

  if (state.nodes > MAX_NODES || state.textLength >= MAX_TEXT_LENGTH) {
    return;
  }

  if (!isRecord(value)) return;

  if (value.type === "text" && typeof value.text === "string") {
    const remaining = MAX_TEXT_LENGTH - state.textLength;
    const text = value.text.slice(0, remaining);

    output.push(text);
    state.textLength += text.length;
    return;
  }

  if (!Array.isArray(value.content)) return;

  for (const child of value.content) {
    collectAdfNode(child, output, state);

    if (state.nodes > MAX_NODES || state.textLength >= MAX_TEXT_LENGTH) {
      break;
    }
  }
}

export function hasVisibleText(value: string): boolean {
  return value.replace(FORMAT_OR_CONTROL, "").trim().length > 0;
}

function normalizeExtractedText(value: string): string | null {
  const text = value.replace(/\s+/gu, " ").trim();
  return hasVisibleText(text) ? text : null;
}

export function jiraValueToText(value: unknown): string | null {
  if (typeof value === "string") {
    return normalizeExtractedText(value.slice(0, MAX_TEXT_LENGTH));
  }

  if (!isRecord(value) || value.type !== "doc") return null;

  const output: string[] = [];
  collectAdfNode(value, output, { nodes: 0, textLength: 0 });

  return normalizeExtractedText(output.join(" "));
}
