from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one replacement target, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


ports = Path("src/application/ports.ts")
replace_once(
    ports,
    "  listVersions(projectIdOrKey: string): Promise<JiraVersion[]>;\n",
    "  listVersions(\n    projectIdOrKey: string,\n    expectedProjectId: string,\n  ): Promise<JiraVersion[]>;\n",
)

load_project_data = Path("src/application/load-project-data/load-project-data.ts")
replace_once(
    load_project_data,
    "    jira.listVersions(projectKey),\n",
    "    jira.listVersions(projectKey, projectId),\n",
)

gateway = Path("src/infrastructure/jira/forge-jira-gateway.ts")
replace_once(
    gateway,
    '''export function mapVersionSearchPage(value: unknown): JiraVersion[] {\n  return pageValues(value, "Version search").map((item) =>\n    requireMappedVersion(item, "Version search version"),\n  );\n}\n''',
    '''export function mapVersionSearchPage(\n  value: unknown,\n  expectedProjectId: string,\n): JiraVersion[] {\n  if (!/^\\d+$/.test(expectedProjectId)) {\n    throw new AppError(\n      "JIRA_UNAVAILABLE",\n      "Version search received an invalid expected project context.",\n    );\n  }\n\n  return pageValues(value, "Version search").map((item) => {\n    const version = requireMappedVersion(item, "Version search version");\n    if (version.projectId !== expectedProjectId) {\n      throw new AppError(\n        "JIRA_UNAVAILABLE",\n        "Version search version returned an unexpected project context.",\n      );\n    }\n    return version;\n  });\n}\n''',
)
replace_once(
    gateway,
    "  async listVersions(projectIdOrKey: string): Promise<JiraVersion[]> {\n",
    "  async listVersions(\n    projectIdOrKey: string,\n    expectedProjectId: string,\n  ): Promise<JiraVersion[]> {\n",
)
replace_once(
    gateway,
    "      const pageVersions = mapVersionSearchPage(data);\n",
    "      const pageVersions = mapVersionSearchPage(data, expectedProjectId);\n",
)

load_test = Path("tests/application/load-project-data.test.ts")
replace_once(
    load_test,
    '''  async listVersions(): Promise<JiraVersion[]> {\n    this.calls.push("versions");\n''',
    '''  async listVersions(\n    projectIdOrKey: string,\n    expectedProjectId: string,\n  ): Promise<JiraVersion[]> {\n    this.calls.push(`versions:${projectIdOrKey}:${expectedProjectId}`);\n''',
)
replace_once(
    load_test,
    '      "versions",\n',
    '      "versions:DEMO:10000",\n',
)

page_test = Path("tests/infrastructure/jira-page-boundary-validation.test.ts")
text = page_test.read_text(encoding="utf-8")
text = text.replace(
    "mapVersionSearchPage({ values: [version], isLast: true })",
    'mapVersionSearchPage({ values: [version], isLast: true }, "10000")',
)
text = text.replace(
    "mapVersionSearchPage({ values: [malformedVersion], isLast: true })",
    'mapVersionSearchPage(\n          { values: [malformedVersion], isLast: true },\n          "10000",\n        )',
)
text = text.replace(
    '''mapVersionSearchPage({\n        values: [version, { ...version, id: "30002", archived: null }],\n        isLast: true,\n      })''',
    '''mapVersionSearchPage(\n        {\n          values: [version, { ...version, id: "30002", archived: null }],\n          isLast: true,\n        },\n        "10000",\n      )''',
)

anchor = '''  it("bindet eine Version-Detailantwort an die angefragte ID", () => {\n'''
insert = '''  it("bindet paginierte Versionen an die erwartete Projekt-ID", () => {\n    expect(\n      mapVersionSearchPage({ values: [version], isLast: true }, "10000"),\n    ).toEqual([{ ...version, projectId: "10000" }]);\n\n    expect(() =>\n      mapVersionSearchPage(\n        { values: [{ ...version, projectId: 10001 }], isLast: true },\n        "10000",\n      ),\n    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));\n  });\n\n  it("verwirft eine gemischte Versionsseite mit fremdem Projektkontext vollständig", () => {\n    expect(() =>\n      mapVersionSearchPage(\n        {\n          values: [version, { ...version, id: "30002", projectId: 10001 }],\n          isLast: true,\n        },\n        "10000",\n      ),\n    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));\n  });\n\n'''
if text.count(anchor) != 1:
    raise SystemExit("jira-page-boundary-validation.test.ts: anchor mismatch")
text = text.replace(anchor, insert + anchor, 1)

remaining = text.count("mapVersionSearchPage(")
if remaining < 5:
    raise SystemExit(
        f"jira-page-boundary-validation.test.ts: unexpected mapVersionSearchPage count {remaining}"
    )
page_test.write_text(text, encoding="utf-8")

print("SCRUM-72 source and regression patches applied")
