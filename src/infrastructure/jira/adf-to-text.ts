function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const MAX_NODES = 10_000;
const MAX_TEXT_LENGTH = 50_000;

interface CollectionState {
  nodes: number;
  textLength: number;
}

function collect(
  value: unknown,
  output: string[],
  state: CollectionState,
): void {
  state.nodes += 1;
  if (state.nodes > MAX_NODES || state.textLength >= MAX_TEXT_LENGTH) return;

  if (typeof value === "string") {
    const remaining = MAX_TEXT_LENGTH - state.textLength;
    const text = value.slice(0, remaining);
    output.push(text);
    state.textLength += text.length;
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    collect(String(value), output, state);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collect(item, output, state);
      if (state.nodes > MAX_NODES || state.textLength >= MAX_TEXT_LENGTH) break;
    }
    return;
  }
  if (!isRecord(value)) return;

  if (typeof value.text === "string") collect(value.text, output, state);
  else if (typeof value.value === "string") collect(value.value, output, state);
  else if (Array.isArray(value.content)) collect(value.content, output, state);
}

export function jiraValueToText(value: unknown): string | null {
  const output: string[] = [];
  collect(value, output, { nodes: 0, textLength: 0 });
  const text = output.join(" ").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}
