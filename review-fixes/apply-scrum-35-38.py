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


# SCRUM-35: bind Jira parser success to the requested controlled JQL.
replace_once(
    "src/shared/validation.ts",
    '''export function validateReleaseScopeJql(
  value: string,
  expectedProjectKey: string,
): ReleaseScopeJqlValidation {''',
    '''function normalizedReleaseScopeJqlSemantics(value: string): string | null {
  const tokenized = tokenizeJql(value);
  if (!tokenized.ok) return null;

  const parsed = parseConjunctiveJql(tokenized.tokens);
  if (!parsed.ok) return null;

  return JSON.stringify(
    parsed.clauses.map((clause) => ({
      field: normalizedJqlFieldReference(clause.field.value),
      operator: clause.operator,
      values: clause.values.map((valueToken) => valueToken.value),
    })),
  );
}

export function releaseScopeJqlSemanticallyMatches(
  expected: string,
  actual: string,
): boolean {
  const expectedSemantics = normalizedReleaseScopeJqlSemantics(expected);
  const actualSemantics = normalizedReleaseScopeJqlSemantics(actual);
  return (
    expectedSemantics !== null &&
    actualSemantics !== null &&
    expectedSemantics === actualSemantics
  );
}

export function validateReleaseScopeJql(
  value: string,
  expectedProjectKey: string,
): ReleaseScopeJqlValidation {''',
)

write(
    "src/infrastructure/jira/forge-jira-client.ts",
    '''import api, { route } from "@forge/api";
import type { JiraJqlValidator } from "../../application/ports";
import { AppError } from "../../shared/errors";
import { releaseScopeJqlSemanticallyMatches } from "../../shared/validation";
import { ForgeJiraGateway, parseResponse } from "./forge-jira-gateway";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(
  value: unknown,
  resource: string,
): Record<string, unknown> {
  if (isRecord(value)) return value;
  throw new AppError(
    "JIRA_UNAVAILABLE",
    `${resource} returned an unexpected response.`,
  );
}

function requireArray(value: unknown, resource: string): unknown[] {
  if (Array.isArray(value)) return value;
  throw new AppError(
    "JIRA_UNAVAILABLE",
    `${resource} returned an unexpected response.`,
  );
}

function requireNonEmptyStrings(value: unknown, resource: string): string[] {
  return requireArray(value, resource).map((item) => {
    if (typeof item === "string" && item.trim().length > 0) return item;
    throw new AppError(
      "JIRA_UNAVAILABLE",
      `${resource} returned an unexpected response.`,
    );
  });
}

export function parsedJqlIsValid(
  value: unknown,
  requestedJql: string,
): boolean {
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
      : requireNonEmptyStrings(query.errors, "JQL validation errors");
  if (errors.length > 0) return false;

  const parsedQuery =
    typeof query.query === "string" && query.query.trim().length > 0
      ? query.query
      : null;
  if (
    !parsedQuery ||
    !releaseScopeJqlSemanticallyMatches(requestedJql, parsedQuery)
  ) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "JQL validation returned an unexpected response.",
    );
  }

  const warnings =
    query.warnings === undefined
      ? []
      : requireNonEmptyStrings(query.warnings, "JQL validation warnings");

  if (warnings.length === 0) {
    const structure = requireRecord(query.structure, "JQL validation structure");
    requireRecord(structure.where, "JQL validation where structure");
  } else if (query.structure !== undefined) {
    const structure = requireRecord(query.structure, "JQL validation structure");
    if (structure.where !== undefined) {
      requireRecord(structure.where, "JQL validation where structure");
    }
  }

  return true;
}

export class ForgeJiraClient
  extends ForgeJiraGateway
  implements JiraJqlValidator
{
  async validateJql(jql: string): Promise<boolean> {
    const validation = "strict";
    const data = await parseResponse(
      await api
        .asUser()
        .requestJira(route`/rest/api/3/jql/parse?validation=${validation}`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ queries: [jql] }),
        }),
    );
    return parsedJqlIsValid(data, jql);
  }
}
''',
)

write(
    "tests/infrastructure/jira-jql-validation.test.ts",
    '''import { describe, expect, it } from "vitest";
import { parsedJqlIsValid } from "../../src/infrastructure/jira/forge-jira-client";

const expectedJql = "project = DEMO AND status = Fertig";

describe("Jira-JQL-Validierungsantwort", () => {
  it("akzeptiert eine von Jira erfolgreich validierte Abfrage", () => {
    expect(
      parsedJqlIsValid(
        {
          queries: [
            {
              query: expectedJql,
              structure: { where: { operator: "and" } },
            },
          ],
        },
        expectedJql,
      ),
    ).toBe(true);
  });

  it("akzeptiert semantisch gleiche Jira-Normalisierung", () => {
    expect(
      parsedJqlIsValid(
        {
          queries: [
            {
              query: 'PROJECT = "DEMO" AND STATUS = "Fertig"',
              structure: { where: { operator: "and" } },
            },
          ],
        },
        expectedJql,
      ),
    ).toBe(true);
  });

  it("lehnt eine Parserantwort für eine andere JQL fail-closed ab", () => {
    expect(() =>
      parsedJqlIsValid(
        {
          queries: [
            {
              query: "project = OTHER AND status = Fertig",
              structure: { where: { operator: "and" } },
            },
          ],
        },
        expectedJql,
      ),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

  it("lehnt einen von Jira nicht unterstützten Feldoperator ab", () => {
    const jql = "project = DEMO AND status ~ Fertig";
    expect(
      parsedJqlIsValid(
        {
          queries: [
            {
              query: jql,
              errors: [
                "The operator '~' is not supported by the 'status' field.",
              ],
            },
          ],
        },
        jql,
      ),
    ).toBe(false);
  });

  it("lehnt einen Jira-Parserfehler ab", () => {
    const jql = "project = DEMO AND unknown = value";
    expect(
      parsedJqlIsValid(
        {
          queries: [
            {
              query: jql,
              errors: ["Field 'unknown' does not exist."],
            },
          ],
        },
        jql,
      ),
    ).toBe(false);
  });

  it("akzeptiert dokumentierte Warnungsantworten ohne Parse-Struktur", () => {
    const jql = "project = DEMO AND labels = future-label";
    expect(
      parsedJqlIsValid(
        {
          queries: [
            {
              query: jql,
              warnings: ["The value does not currently exist."],
            },
          ],
        },
        jql,
      ),
    ).toBe(true);
  });

  it.each([
    ["fehlende queries", {}],
    ["queries als Objekt", { queries: {} }],
    ["keine Query", { queries: [] }],
    ["mehrere Queries", { queries: [{}, {}] }],
    ["malformed Query", { queries: [null] }],
    ["Query ohne Erfolgsfelder", { queries: [{}] }],
    ["nur Warnungen ohne Query", { queries: [{ warnings: ["Hinweis"] }] }],
    ["Query-Text ohne Struktur", { queries: [{ query: "project = DEMO" }] }],
    ["leere Parse-Struktur", { queries: [{ query: "project = DEMO", structure: {} }] }],
    ["Struktur ohne Query-Text", { queries: [{ structure: { where: {} } }] }],
    ["leerer Query-Text", { queries: [{ query: "   ", structure: { where: {} } }] }],
    ["errors als null", { queries: [{ errors: null }] }],
    ["malformed error", { queries: [{ errors: [null] }] }],
    [
      "malformed warning",
      {
        queries: [
          { query: "project = DEMO", warnings: [null], structure: { where: {} } },
        ],
      },
    ],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "bricht bei %s fail-closed ab",
    (_case, value) => {
      expect(() => parsedJqlIsValid(value, "project = DEMO")).toThrowError(
        expect.objectContaining({ code: "JIRA_UNAVAILABLE" }),
      );
    },
  );
});
''',
)

# SCRUM-36/37: make paginated Jira metadata and version status mapping fail closed.
replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''function pageValues(value: unknown): unknown[] {
  return isRecord(value) ? arrayValue(value.values) : [];
}
''',
    '''function pageValues(value: unknown, resource: string): unknown[] {
  const page = requireRecord(value, resource);
  return requireArray(page.values, `${resource} values`);
}
''',
)

replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''function mapProject(value: unknown): JiraProject | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const key = stringValue(value.key);
  const name = stringValue(value.name);
  return id && key && name ? { id, key, name } : null;
}

function mapVersion(value: unknown): JiraVersion | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const name = stringValue(value.name);
  const projectId =
    stringValue(value.projectId) ??
    (typeof value.projectId === "number" ? String(value.projectId) : null);
  return id && name && projectId
    ? {
        id,
        name,
        projectId,
        released: booleanValue(value.released),
        archived: booleanValue(value.archived),
      }
    : null;
}
''',
    '''function mapProject(value: unknown): JiraProject | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const key = stringValue(value.key);
  const name = stringValue(value.name);
  return id && key && name ? { id, key, name } : null;
}

function requireMappedProject(value: unknown, resource: string): JiraProject {
  const project = mapProject(value);
  if (project) return project;
  throw new AppError(
    "JIRA_UNAVAILABLE",
    `${resource} returned an unexpected response.`,
  );
}

function mapVersion(value: unknown): JiraVersion | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const name = stringValue(value.name);
  const projectId =
    stringValue(value.projectId) ??
    (typeof value.projectId === "number" ? String(value.projectId) : null);
  if (
    !id ||
    !name ||
    !projectId ||
    typeof value.released !== "boolean" ||
    typeof value.archived !== "boolean"
  ) {
    return null;
  }
  return {
    id,
    name,
    projectId,
    released: value.released,
    archived: value.archived,
  };
}

function requireMappedVersion(value: unknown, resource: string): JiraVersion {
  const version = mapVersion(value);
  if (version) return version;
  throw new AppError(
    "JIRA_UNAVAILABLE",
    `${resource} returned an unexpected response.`,
  );
}

export function mapProjectSearchPage(value: unknown): JiraProject[] {
  return pageValues(value, "Project search").map((item) =>
    requireMappedProject(item, "Project search project"),
  );
}

export function mapFieldSearchPage(value: unknown): JiraField[] {
  return pageValues(value, "Field search").map((item) => {
    const field = requireRecord(item, "Field search field");
    const id = stringValue(field.id);
    const name = stringValue(field.name);
    if (!id || !name || typeof field.custom !== "boolean") {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        "Field search field returned an unexpected response.",
      );
    }

    const schema =
      field.schema === undefined || field.schema === null
        ? null
        : requireRecord(field.schema, "Field search field schema");
    const schemaType =
      schema === null || schema.type === undefined || schema.type === null
        ? null
        : stringValue(schema.type);
    if (
      schema !== null &&
      schema.type !== undefined &&
      schema.type !== null &&
      schemaType === null
    ) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        "Field search field schema returned an unexpected response.",
      );
    }

    return { id, name, custom: field.custom, schemaType };
  });
}

export function mapVersionSearchPage(value: unknown): JiraVersion[] {
  return pageValues(value, "Version search").map((item) =>
    requireMappedVersion(item, "Version search version"),
  );
}
''',
)

replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''      requireRecord(data, "Project search");
      projects.push(
        ...pageValues(data).flatMap((item) => mapProject(item) ?? []),
      );
''',
    '''      projects.push(...mapProjectSearchPage(data));
''',
)

replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''    const project = mapProject(data);
    if (!project)
      throw new AppError("JIRA_UNAVAILABLE", "Unexpected project response.");
    return project;
''',
    '''    return requireMappedProject(data, "Project");
''',
)

replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''      requireRecord(data, "Field search");
      for (const item of pageValues(data)) {
        if (!isRecord(item)) continue;
        const id = stringValue(item.id);
        const name = stringValue(item.name);
        const schema = isRecord(item.schema) ? item.schema : {};
        if (id && name) {
          fields.push({
            id,
            name,
            custom: booleanValue(item.custom),
            schemaType: stringValue(schema.type),
          });
        }
      }
''',
    '''      fields.push(...mapFieldSearchPage(data));
''',
)

replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''      requireRecord(data, "Version search");
      versions.push(
        ...pageValues(data).flatMap((item) => mapVersion(item) ?? []),
      );
''',
    '''      versions.push(...mapVersionSearchPage(data));
''',
)

replace_once(
    "src/infrastructure/jira/forge-jira-gateway.ts",
    '''    const version = mapVersion(data);
    if (!version)
      throw new AppError("VERSION_NOT_FOUND", "Unexpected version response.");
    return version;
''',
    '''    return requireMappedVersion(data, "Version");
''',
)

write(
    "tests/infrastructure/jira-page-boundary-validation.test.ts",
    '''import { describe, expect, it } from "vitest";
import {
  mapFieldSearchPage,
  mapProjectSearchPage,
  mapVersionSearchPage,
} from "../../src/infrastructure/jira/forge-jira-gateway";

const project = { id: "10000", key: "DEMO", name: "Demo" };
const field = {
  id: "customfield_10042",
  name: "Akzeptanzkriterien",
  custom: true,
  schema: { type: "string" },
};
const version = {
  id: "30001",
  name: "1.0.0",
  projectId: 10000,
  released: false,
  archived: false,
};

describe("paginierte Jira-Metadatengrenze", () => {
  it("bildet vollständige Projekt-, Feld- und Versionsseiten ab", () => {
    expect(mapProjectSearchPage({ values: [project], isLast: true })).toEqual([
      project,
    ]);
    expect(mapFieldSearchPage({ values: [field], isLast: true })).toEqual([
      {
        id: "customfield_10042",
        name: "Akzeptanzkriterien",
        custom: true,
        schemaType: "string",
      },
    ]);
    expect(mapVersionSearchPage({ values: [version], isLast: true })).toEqual([
      {
        ...version,
        projectId: "10000",
      },
    ]);
  });

  it.each([
    ["fehlendem values-Feld", { isLast: true }],
    ["values als Objekt", { values: {}, isLast: true }],
    ["values als null", { values: null, isLast: true }],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "weist Projektseite mit %s fail-closed zurück",
    (_case, payload) => {
      expect(() => mapProjectSearchPage(payload)).toThrowError(
        expect.objectContaining({ code: "JIRA_UNAVAILABLE" }),
      );
    },
  );

  it("weist ein einzelnes malformed Projekt-Element zurück", () => {
    expect(() =>
      mapProjectSearchPage({ values: [project, { id: "10001" }], isLast: true }),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });

  it.each([
    ["fehlendem custom-Flag", { ...field, custom: undefined }],
    ["falsch typisiertem custom-Flag", { ...field, custom: "true" }],
    ["malformed Schema-Typ", { ...field, schema: { type: {} } }],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "weist Feld mit %s fail-closed zurück",
    (_case, malformedField) => {
      expect(() =>
        mapFieldSearchPage({ values: [malformedField], isLast: true }),
      ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
    },
  );

  it.each([
    ["fehlendem released", { ...version, released: undefined }],
    ["falsch typisiertem released", { ...version, released: "false" }],
    ["fehlendem archived", { ...version, archived: undefined }],
    ["falsch typisiertem archived", { ...version, archived: 0 }],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "weist Version mit %s fail-closed zurück",
    (_case, malformedVersion) => {
      expect(() =>
        mapVersionSearchPage({ values: [malformedVersion], isLast: true }),
      ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
    },
  );

  it("verwirft bei gemischten gültigen und malformed Versionen die gesamte Seite", () => {
    expect(() =>
      mapVersionSearchPage({
        values: [version, { ...version, id: "30002", archived: null }],
        isLast: true,
      }),
    ).toThrowError(expect.objectContaining({ code: "JIRA_UNAVAILABLE" }));
  });
});
''',
)

# SCRUM-38: document the singular project read endpoint actually used by getProject.
replace_once(
    "docs/permissions.md",
    '''| Sichtbare Projekte laden                 | `GET /rest/api/3/project/search`                    |
| Projekt und Issue-Typen/Status laden     | `GET /rest/api/3/project/{projectIdOrKey}/statuses` |
| Verfügbare Felder laden                  | `GET /rest/api/3/field/search`                      |''',
    '''| Sichtbare Projekte laden                 | `GET /rest/api/3/project/search`                    |
| Projektstammdaten laden                  | `GET /rest/api/3/project/{projectIdOrKey}`          |
| Issue-Typen und Status laden             | `GET /rest/api/3/project/{projectIdOrKey}/statuses` |
| Verfügbare Felder laden                  | `GET /rest/api/3/field/search`                      |''',
)

replace_once(
    "docs/learning-log.md",
    '''- Projektstatus werden nach Issue-Typ gruppiert geliefert. Diese Antwort kann Status und relevante Issue-Typen ohne zusätzlichen Admin-Scope bereitstellen.
- Atlassian empfiehlt für alle verwendeten Read-Endpunkte den Classic Scope `read:jira-work`; zusätzlich benötigt KVS `storage:app`.''',
    '''- Projektstammdaten werden zusätzlich über `GET /rest/api/3/project/{projectIdOrKey}` geladen; der Aufruf läuft wie die übrigen Jira-Lesezugriffe mit `asUser` und dem Classic Scope `read:jira-work`.
- Projektstatus werden nach Issue-Typ gruppiert geliefert. Diese Antwort kann Status und relevante Issue-Typen ohne zusätzlichen Admin-Scope bereitstellen.
- Atlassian empfiehlt für alle verwendeten Read-Endpunkte den Classic Scope `read:jira-work`; zusätzlich benötigt KVS `storage:app`.''',
)

# Remove the tracked helper after successful application so the final net tree stays clean.
Path(__file__).unlink()
print("SCRUM-35/38 changes applied successfully.")
