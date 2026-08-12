import { Validator } from "jsonschema";
import { AppError } from "../../shared/errors";
import adfSchema from "./adf-schema.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const MAX_NODES = 10_000;
const MAX_TEXT_LENGTH = 50_000;
const FORMAT_OR_CONTROL = /[\p{Cc}\p{Cf}]/gu;

const adfValidator = new Validator();

function hasSafeAdfStructureSize(value: unknown): boolean {
  const stack: unknown[] = [value];
  let scheduledEntries = 1;

  while (stack.length > 0) {
    const current = stack.pop();

    if (Array.isArray(current)) {
      if (scheduledEntries + current.length > MAX_NODES) return false;
      scheduledEntries += current.length;
      for (const item of current) stack.push(item);
      continue;
    }

    if (!isRecord(current)) continue;

    const values = Object.values(current);
    if (scheduledEntries + values.length > MAX_NODES) return false;
    scheduledEntries += values.length;
    for (const item of values) stack.push(item);
  }

  return true;
}

export function isStructurallyValidAdfDocument(value: unknown): boolean {
  if (
    !isRecord(value) ||
    value.type !== "doc" ||
    value.version !== 1 ||
    !Array.isArray(value.content) ||
    !hasSafeAdfStructureSize(value)
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
  textLimitExceeded: boolean;
}

function collectAdfNode(
  value: unknown,
  output: string[],
  state: CollectionState,
): void {
  state.nodes += 1;

  if (state.nodes > MAX_NODES || state.textLimitExceeded) {
    return;
  }

  if (!isRecord(value)) return;

  if (value.type === "text" && typeof value.text === "string") {
    const remaining = MAX_TEXT_LENGTH - state.textLength;
    if (value.text.length > remaining) {
      state.textLimitExceeded = true;
      return;
    }

    output.push(value.text);
    state.textLength += value.text.length;
    return;
  }

  if (!Array.isArray(value.content)) return;

  for (const child of value.content) {
    collectAdfNode(child, output, state);

    if (state.nodes > MAX_NODES || state.textLimitExceeded) {
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
    if (value.length > MAX_TEXT_LENGTH) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        "Jira text evidence exceeded the configured processing limit.",
      );
    }
    return normalizeExtractedText(value);
  }

  if (!isRecord(value) || value.type !== "doc") return null;

  const output: string[] = [];
  const state: CollectionState = {
    nodes: 0,
    textLength: 0,
    textLimitExceeded: false,
  };
  collectAdfNode(value, output, state);

  if (state.textLimitExceeded) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "Jira text evidence exceeded the configured processing limit.",
    );
  }

  return normalizeExtractedText(output.join(" "));
}
