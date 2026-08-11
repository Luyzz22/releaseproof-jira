from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one match, found {count}")
    write(path, content.replace(old, new, 1))


# SCRUM-31: Project metadata must fail closed.
replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    "export class ForgeJiraGateway implements JiraGateway {",
    '''export function mapProjectMetadata(value: unknown): ProjectMetadata {
  const items = requireArray(value, "Project metadata");
  const statusMap = new Map<string, JiraStatus>();
  const issueTypes: JiraIssueType[] = items.map((item) => {
    const issueType = requireRecord(item, "Project metadata issue type");
    const id = stringValue(issueType.id);
    const name = stringValue(issueType.name);
    if (!id || !name || typeof issueType.subtask !== "boolean") {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        "Project metadata issue type returned an unexpected response.",
      );
    }

    const statuses = requireArray(
      issueType.statuses,
      "Project metadata issue type statuses",
    );
    for (const statusValue of statuses) {
      const status = mapStatus(statusValue);
      if (!status) {
        throw new AppError(
          "JIRA_UNAVAILABLE",
          "Project metadata status returned an unexpected response.",
        );
      }
      statusMap.set(status.id, status);
    }

    return { id, name, subtask: issueType.subtask };
  });

  return { statuses: [...statusMap.values()], issueTypes };
}

export class ForgeJiraGateway implements JiraGateway {''',
)

old_metadata_method = '''  async getProjectMetadata(projectIdOrKey: string): Promise<ProjectMetadata> {
    const data = await parseResponse(
      await api
        .asUser()
        .requestJira(route`/rest/api/3/project/${projectIdOrKey}/statuses`),
    );
    if (!Array.isArray(data)) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        "Project metadata returned an unexpected response.",
      );
    }
    const statusMap = new Map<string, JiraStatus>();
    const issueTypes: JiraIssueType[] = [];
    for (const item of arrayValue(data)) {
      if (!isRecord(item)) continue;
      const id = stringValue(item.id);
      const name = stringValue(item.name);
      if (id && name)
        issueTypes.push({ id, name, subtask: booleanValue(item.subtask) });
      for (const statusValue of arrayValue(item.statuses)) {
        const status = mapStatus(statusValue);
        if (status) statusMap.set(status.id, status);
      }
    }
    return { statuses: [...statusMap.values()], issueTypes };
  }
'''
new_metadata_method = '''  async getProjectMetadata(projectIdOrKey: string): Promise<ProjectMetadata> {
    const data = await parseResponse(
      await api
        .asUser()
        .requestJira(route`/rest/api/3/project/${projectIdOrKey}/statuses`),
    );
    return mapProjectMetadata(data);
  }
'''
replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    old_metadata_method,
    new_metadata_method,
)

metadata_test = '''import { describe, expect, it } from "vitest";
import { mapProjectMetadata } from "../../src/infrastructure/jira/forge-jira-gateway";

const validIssueType = {
  id: "10001",
  name: "Story",
  subtask: false,
  statuses: [{ id: "31", name: "Fertig" }],
};

describe("Jira-Projektmetadaten", () => {
  it("bildet vollständige Projektmetadaten ab", () => {
    expect(mapProjectMetadata([validIssueType])).toEqual({
      issueTypes: [{ id: "10001", name: "Story", subtask: false }],
      statuses: [{ id: "31", name: "Fertig" }],
    });
  });

  it("akzeptiert ein explizit leeres Status-Array", () => {
    expect(
      mapProjectMetadata([
        { id: "10001", name: "Story", subtask: false, statuses: [] },
      ]),
    ).toEqual({
      issueTypes: [{ id: "10001", name: "Story", subtask: false }],
      statuses: [],
    });
  });

  it.each([
    [
      "fehlendes subtask-Flag",
      [{ id: "10001", name: "Story", statuses: [] }],
    ],
    [
      "falsch typisiertes subtask-Flag",
      [{ id: "10001", name: "Story", subtask: "false", statuses: [] }],
    ],
    [
      "fehlendes statuses-Feld",
      [{ id: "10001", name: "Story", subtask: false }],
    ],
    [
      "statuses als Objekt",
      [{ id: "10001", name: "Story", subtask: false, statuses: {} }],
    ],
    [
      "Status ohne ID",
      [
        {
          id: "10001",
          name: "Story",
          subtask: false,
          statuses: [{ name: "Fertig" }],
        },
      ],
    ],
    [
      "Status ohne Namen",
      [
        {
          id: "10001",
          name: "Story",
          subtask: false,
          statuses: [{ id: "31" }],
        },
      ],
    ],
    [
      "gemischte gültige und ungültige Vorgangstypen",
      [
        validIssueType,
        { id: "10002", name: "Unteraufgabe", statuses: [] },
      ],
    ],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "bricht bei %s fail-closed ab",
    (_case, value) => {
      expect(() => mapProjectMetadata(value)).toThrowError(
        expect.objectContaining({ code: "JIRA_UNAVAILABLE" }),
      );
    },
  );
});
'''
metadata_test_path = ROOT / "tests/infrastructure/project-metadata-validation.test.ts"
if metadata_test_path.exists():
    raise RuntimeError(f"{metadata_test_path}: already exists")
metadata_test_path.write_text(metadata_test, encoding="utf-8")

# SCRUM-32: A 200 parser response needs positive parse evidence.
old_jql_function = '''export function parsedJqlIsValid(value: unknown): boolean {
  const payload = requireRecord(value, "JQL validation");
  const queries = requireArray(payload.queries, "JQL validation");
  if (queries.length !== 1) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "JQL validation returned an unexpected response.",
    );
  }

  const query = requireRecord(queries[0], "JQL validation");
  if (query.errors === undefined) return true;

  const errors = requireArray(query.errors, "JQL validation");
  for (const error of errors) {
    if (typeof error !== "string" || error.trim().length === 0) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        "JQL validation returned an unexpected response.",
      );
    }
  }
  return errors.length === 0;
}
'''
new_jql_function = '''export function parsedJqlIsValid(value: unknown): boolean {
  const payload = requireRecord(value, "JQL validation");
  const queries = requireArray(payload.queries, "JQL validation");
  if (queries.length !== 1) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "JQL validation returned an unexpected response.",
    );
  }

  const query = requireRecord(queries[0], "JQL validation");
  const errors =
    query.errors === undefined
      ? []
      : requireArray(query.errors, "JQL validation");
  for (const error of errors) {
    if (typeof error !== "string" || error.trim().length === 0) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        "JQL validation returned an unexpected response.",
      );
    }
  }
  if (errors.length > 0) return false;

  const parsedQuery =
    typeof query.query === "string" && query.query.trim().length > 0
      ? query.query
      : null;
  const structure = isRecord(query.structure) ? query.structure : null;
  if (!parsedQuery || !structure) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "JQL validation returned an unexpected response.",
    );
  }

  return true;
}
'''
replace_once(
    "src/infrastructure/jira/forge-jira-client.ts",
    old_jql_function,
    new_jql_function,
)

replace_once(
    "tests/infrastructure/jira-jql-validation.test.ts",
    '''          {
            query: "project = DEMO AND labels = future-label",
            warnings: ["The value does not currently exist."],
          },''',
    '''          {
            query: "project = DEMO AND labels = future-label",
            structure: {},
            warnings: ["The value does not currently exist."],
          },''',
)
replace_once(
    "tests/infrastructure/jira-jql-validation.test.ts",
    '''    ["malformed Query", { queries: [null] }],
    ["errors als null", { queries: [{ errors: null }] }],''',
    '''    ["malformed Query", { queries: [null] }],
    ["Query ohne Erfolgsfelder", { queries: [{}] }],
    ["nur Warnungen ohne Erfolgsfelder", { queries: [{ warnings: [] }] }],
    ["Query-Text ohne Struktur", { queries: [{ query: "project = DEMO" }] }],
    ["Struktur ohne Query-Text", { queries: [{ structure: {} }] }],
    [
      "leerer Query-Text",
      { queries: [{ query: "   ", structure: {} }] },
    ],
    ["errors als null", { queries: [{ errors: null }] }],''',
)

# SCRUM-33: Remaining user-facing English/technical terminology.
replace_once(
    "src/frontend/pages/empty-state.tsx",
    "Readiness-Konfiguration hinterlegt.",
    "Bereitschaftskonfiguration hinterlegt.",
)
replace_once(
    "src/shared/errors.ts",
    "Bitte verkleinern Sie den Release-Scope.",
    "Bitte verkleinern Sie den Release-Umfang.",
)
replace_once(
    "src/domain/rules/no-open-subtasks.ts",
    "aus dem Release-Scope entfernen.",
    "aus dem Release-Umfang entfernen.",
)

validation_replacements = {
    "Der explizite Release-Scope darf nicht leer sein.": "Der explizite Release-Umfang darf nicht leer sein.",
    "Der Release-Scope darf höchstens ${RELEASE_SCOPE_JQL_MAX_LENGTH} Zeichen enthalten.": "Der Release-Umfang darf höchstens ${RELEASE_SCOPE_JQL_MAX_LENGTH} Zeichen enthalten.",
    "Der Release-Scope enthält eine nicht geschlossene Zeichenfolge.": "Der Release-Umfang enthält eine nicht geschlossene Zeichenfolge.",
    "Der Release-Scope enthält ein nicht unterstütztes unquoted JQL-Token. Werte mit Sonderzeichen müssen in Anführungszeichen stehen.": "Der Release-Umfang enthält einen nicht unterstützten ungequoteten JQL-Wert. Werte mit Sonderzeichen müssen in Anführungszeichen stehen.",
    "Der Release-Scope darf keine fixVersion-Bedingung enthalten.": "Der Release-Umfang darf keine fixVersion-Bedingung enthalten.",
    "OR ist im Release-Scope nicht zulässig, weil die Projektbegrenzung für jeden Treffer gelten muss.": "OR ist im Release-Umfang nicht zulässig, weil die Projektbegrenzung für jeden Treffer gelten muss.",
    "Der Release-Scope ist syntaktisch unvollständig oder verwendet eine nicht unterstützte JQL-Form.": "Der Release-Umfang ist syntaktisch unvollständig oder verwendet eine nicht unterstützte JQL-Form.",
    "Der Release-Scope muss mit „project = PROJEKTKEY“ beginnen.": "Der Release-Umfang muss mit „project = PROJEKTKEY“ beginnen.",
    "Der Release-Scope muss auf das aktuelle Projekt ${expectedProjectKey} begrenzt sein.": "Der Release-Umfang muss auf das aktuelle Projekt ${expectedProjectKey} begrenzt sein.",
    "Der Release-Scope darf die Projektbegrenzung nicht erneut verändern.": "Der Release-Umfang darf die Projektbegrenzung nicht erneut verändern.",
    "Ein Release-Scope-JQL ist nur im Modus JQL_SCOPE zulässig.": "Eine JQL für den Release-Umfang ist nur im Modus „Expliziter JQL-Umfang“ zulässig.",
    "Bitte geben Sie einen expliziten Release-Scope an.": "Bitte geben Sie einen expliziten Release-Umfang an.",
}
for old, new in validation_replacements.items():
    replace_once("src/shared/validation.ts", old, new)

# Extend rendering regression for the first-use state.
replace_once(
    "tests/frontend/empty-state.test.ts",
    '''describe("Recovery Empty State", () => {
  it("erklärt die beschädigte Konfiguration und bietet die Neukonfiguration an", () => {''',
    '''describe("Recovery Empty State", () => {
  it("verwendet im Erstzustand ausschließlich deutsche Bereitschaftsterminologie", () => {
    const markup = renderToStaticMarkup(
      createElement(EmptyState, {
        data: { ...recoveryData, configRecoveryRequired: false },
        onConfigure: () => undefined,
      }),
    );

    expect(markup).toContain("Bereitschaftskonfiguration");
    expect(markup).not.toContain("Readiness-Konfiguration");
  });

  it("erklärt die beschädigte Konfiguration und bietet die Neukonfiguration an", () => {''',
)

# Add a regression that the relevant validation messages no longer leak technical English terms.
replace_once(
    "tests/shared/release-scope-validation.test.ts",
    '''describe("Release-Scope-JQL-Validierung", () => {''',
    '''describe("Release-Scope-JQL-Validierung", () => {
  it("liefert deutsche benutzerseitige Fehlermeldungen ohne technische Moduswerte", () => {
    const unsafe = validateReleaseScopeJql(
      "project = SCRUM AND status = foo;bar",
      "SCRUM",
    );
    expect(unsafe.valid).toBe(false);
    if (!unsafe.valid) {
      expect(unsafe.message).toContain("ungequoteten");
      expect(unsafe.message).not.toContain("unquoted");
      expect(unsafe.message).not.toContain("Release-Scope");
    }

    const invalidMode = projectConfigInputSchema.safeParse({
      ...projectConfig,
      releaseScopeMode: "VERSION_ONLY",
      releaseScopeJql: "project = SCRUM",
    });
    expect(invalidMode.success).toBe(false);
    if (!invalidMode.success) {
      const message = invalidMode.error.issues[0]?.message ?? "";
      expect(message).toContain("Expliziter JQL-Umfang");
      expect(message).not.toContain("JQL_SCOPE");
      expect(message).not.toContain("Release-Scope");
    }
  });''',
)

# SCRUM-34: document the strict Jira parser endpoint.
replace_once(
    "docs/permissions.md",
    "| Scope-Issues und benötigte Details laden | `POST /rest/api/3/search/jql`                       |",
    "| Scope-Issues und benötigte Details laden | `POST /rest/api/3/search/jql`                       |\n| Projektgebundene JQL strikt validieren    | `POST /rest/api/3/jql/parse`                        |",
)
replace_once(
    "docs/permissions.md",
    "Der Endpunkt ist für beide Scope-Modi identisch. `VERSION_ONLY` verwendet serverseitig erzeugtes JQL; `JQL_SCOPE` verwendet den unveränderten, projektgebunden validierten Ausdruck. Es entstehen keine Jira-Schreiboperationen und keine zusätzlichen Scopes.",
    "Der Suchendpunkt ist für beide Scope-Modi identisch. `VERSION_ONLY` verwendet serverseitig erzeugtes JQL; `JQL_SCOPE` verwendet den unveränderten, projektgebunden validierten Ausdruck. Zusätzlich prüft `POST /rest/api/3/jql/parse` explizite JQL vor Persistenz und erneut vor Analyse mit `validation=strict`. Der Parser-Aufruf validiert ausschließlich die Abfrage; er verändert keine Jira-Daten. Es entstehen keine Jira-Schreiboperationen, keine externen Remotes und keine zusätzlichen Scopes.",
)
replace_once(
    "docs/permissions.md",
    "- [Jira issue search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/)",
    "- [Jira issue search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/)\n- [Jira JQL APIs](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-jql/)",
)

learning_addition = '''

## 2026-08-10 — Strikte Jira-JQL-Validierung

- Explizite projektgebundene JQL wird zusätzlich zur kontrollierten lokalen Grammatik über `POST /rest/api/3/jql/parse?validation=strict` im aktuellen Benutzerkontext geprüft.
- Der Parser-Aufruf dient ausschließlich der Validierung vor Persistenz und erneut vor Analyse; er führt keine Jira-Schreiboperation aus und benötigt keinen zusätzlichen Scope über `read:jira-work` hinaus.
- Die Parser-Antwort wird fail-closed ausgewertet: Genau ein Query-Ergebnis ist erforderlich; Fehler machen die JQL ungültig, und ein fehlerfreies Ergebnis wird nur mit nicht leerem Query-Text und vorhandener Parse-Struktur als Erfolg akzeptiert.
- Unvollständige oder unerwartete 200-Antworten werden als Jira-Verfügbarkeitsfehler behandelt, statt eine nicht nachweislich validierte JQL zu persistieren.
- Es wurden keine externen Remotes, zusätzlichen Egress-Ziele oder neuen Berechtigungen eingeführt.
'''
learning_path = "docs/learning-log.md"
learning = read(learning_path)
if "## 2026-08-10 — Strikte Jira-JQL-Validierung" in learning:
    raise RuntimeError("docs/learning-log.md: SCRUM-34 section already exists")
write(learning_path, learning.rstrip() + learning_addition + "\n")

# The helper is temporary and must not remain in the final tree.
Path(__file__).unlink()
print("SCRUM-31/34 changes applied successfully.")
