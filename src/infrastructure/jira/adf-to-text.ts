function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const MAX_NODES = 10_000;
const MAX_TEXT_LENGTH = 50_000;

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
  if (state.nodes > MAX_NODES || state.textLength >= MAX_TEXT_LENGTH) return;
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
    if (state.nodes > MAX_NODES || state.textLength >= MAX_TEXT_LENGTH) break;
  }
}

export function jiraValueToText(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.slice(0, MAX_TEXT_LENGTH).replace(/\s+/g, " ").trim();
    return text.length > 0 ? text : null;
  }
  if (!isRecord(value) || value.type !== "doc") return null;

  const output: string[] = [];
  collectAdfNode(value, output, { nodes: 0, textLength: 0 });
  const text = output.join(" ").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}
