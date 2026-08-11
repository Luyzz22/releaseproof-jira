from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"{label}: erwarteter Block nicht exakt gefunden; nichts geändert.")
    path.write_text(text.replace(old, new, 1))


gateway = Path("src/infrastructure/jira/forge-jira-gateway.ts")
replace_once(
    gateway,
    '''function mapResolution(value: unknown): { id: string; name: string } | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const name = stringValue(value.name);
  return id && name ? { id, name } : null;
}
''',
    '''function mapResolution(value: unknown): { id: string; name: string } | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const name = stringValue(value.name);
  return id && /^\\d+$/.test(id) && name ? { id, name } : null;
}
''',
    "SCRUM-41 resolution ID validation",
)


test_file = Path("tests/infrastructure/jira-evidence-validation.test.ts")
replace_once(
    test_file,
    '''    [
      "Subtask mit Whitespace-only Resolution-ID",
      {
        id: "30001",
        key: "DEMO-2",
        fields: {
          status: { id: "31", name: "Fertig" },
          resolution: { id: "   ", name: "Erledigt" },
        },
      },
    ],
    [
      "Subtask mit Whitespace-only Resolution-Name",
''',
    '''    [
      "Subtask mit Whitespace-only Resolution-ID",
      {
        id: "30001",
        key: "DEMO-2",
        fields: {
          status: { id: "31", name: "Fertig" },
          resolution: { id: "   ", name: "Erledigt" },
        },
      },
    ],
    [
      "Subtask mit nichtnumerischer Resolution-ID",
      {
        id: "30001",
        key: "DEMO-2",
        fields: {
          status: { id: "31", name: "Fertig" },
          resolution: { id: "keine-jira-id", name: "Erledigt" },
        },
      },
    ],
    [
      "Subtask mit Whitespace-only Resolution-Name",
''',
    "SCRUM-41 subtask regression",
)

replace_once(
    test_file,
    '''  it.each([
    ["Whitespace-only Resolution-ID", "   ", "Erledigt"],
    ["Whitespace-only Resolution-Name", "1", "   "],
  ])("bricht bei Link mit %s ab", async (_case, id, name) => {
''',
    '''  it.each([
    ["Whitespace-only Resolution-ID", "   ", "Erledigt"],
    ["nichtnumerischer Resolution-ID", "keine-jira-id", "Erledigt"],
    ["Whitespace-only Resolution-Name", "1", "   "],
  ])("bricht bei Link mit %s ab", async (_case, id, name) => {
''',
    "SCRUM-41 linked issue regression",
)

print("SCRUM-41 changes applied successfully.")
