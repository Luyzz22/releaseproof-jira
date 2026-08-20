import api, { route } from "@forge/api";
import type { JiraField, JiraJqlValidator } from "../../application/ports";
import { AppError } from "../../shared/errors";
import {
  parseReleaseScopeJqlSemantics,
  releaseScopeJqlSemanticallyMatches,
} from "../../shared/validation";
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

const JQL_COMPARISON_OPERATORS = new Set([
  "=",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "~",
  "!~",
]);
const JQL_LIST_OPERATORS = new Set(["in", "not in"]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizedJqlFieldCandidate(value: string): string {
  const normalized = value.trim().toLocaleLowerCase("en-US");
  const customFieldMatch = /^cf\[(\d+)\]$/.exec(normalized);
  if (customFieldMatch) return `customfield_${customFieldMatch[1]}`;
  return normalized === "issuekey" ? "key" : normalized;
}

interface JiraFieldIdentity {
  name: string | null;
  encodedName: string | null;
}

function isCustomFieldReference(value: string): boolean {
  return /^customfield_\d+$/.test(value);
}

function jiraFieldIdentity(value: unknown): JiraFieldIdentity | null {
  if (!isRecord(value)) return null;

  const name = isNonEmptyString(value.name)
    ? normalizedJqlFieldCandidate(value.name)
    : null;
  const encodedName = isNonEmptyString(value.encodedName)
    ? normalizedJqlFieldCandidate(value.encodedName)
    : null;
  if (name === null && encodedName === null) return null;

  return { name, encodedName };
}

interface ExpectedJiraFieldIdentity {
  canonical: string;
  names: ReadonlySet<string>;
  custom: boolean;
}

const CONTROLLED_SYSTEM_FIELD_REFERENCES = new Set(["project", "key"]);

function expectedJiraFieldIdentity(
  expectedField: string,
  fields: readonly JiraField[],
): ExpectedJiraFieldIdentity | null {
  const expected = normalizedJqlFieldCandidate(expectedField);

  if (CONTROLLED_SYSTEM_FIELD_REFERENCES.has(expected)) {
    return {
      canonical: expected,
      names: new Set([expected]),
      custom: false,
    };
  }

  const idMatches = fields.filter(
    (field) => normalizedJqlFieldCandidate(field.id) === expected,
  );
  const candidates =
    idMatches.length > 0
      ? idMatches
      : fields.filter(
          (field) => normalizedJqlFieldCandidate(field.name) === expected,
        );

  if (candidates.length === 0) {
    return {
      canonical: expected,
      names: new Set([expected]),
      custom: isCustomFieldReference(expected),
    };
  }

  const canonicalIds = new Set(
    candidates.map((field) => normalizedJqlFieldCandidate(field.id)),
  );
  if (canonicalIds.size !== 1) return null;

  const canonical = canonicalIds.values().next().value;
  if (typeof canonical !== "string") return null;

  const canonicalFieldNames = new Set(
    fields
      .filter((field) => normalizedJqlFieldCandidate(field.id) === canonical)
      .map((field) => normalizedJqlFieldCandidate(field.name)),
  );
  if (canonicalFieldNames.size > 1) return null;

  const names = new Set<string>([expected, canonical, ...canonicalFieldNames]);

  return {
    canonical,
    names,
    custom: isCustomFieldReference(canonical),
  };
}

function jiraFieldMatchesExpected(
  identity: JiraFieldIdentity,
  expectedField: string,
  fields: readonly JiraField[],
): boolean {
  const expected = expectedJiraFieldIdentity(expectedField, fields);
  if (!expected) return false;

  if (expected.custom) {
    if (identity.encodedName !== null) {
      if (identity.encodedName !== expected.canonical) return false;
      if (identity.name === null || expected.names.has(identity.name)) {
        return true;
      }

      return fields.length === 0 && !isCustomFieldReference(identity.name);
    }
    return identity.name !== null && expected.names.has(identity.name);
  }

  if (identity.encodedName !== null) {
    if (isCustomFieldReference(identity.encodedName)) return false;
    if (!expected.names.has(identity.encodedName)) return false;
  }
  if (identity.name !== null && !expected.names.has(identity.name)) {
    return false;
  }

  return identity.name !== null || identity.encodedName !== null;
}

function jiraSingleOperandValue(value: unknown): string | null {
  if (!isRecord(value) || typeof value.value !== "string") return null;
  return value.value;
}

function jiraListOperandValues(value: unknown): string[] | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.values) ||
    value.values.length === 0
  ) {
    return null;
  }

  const values: string[] = [];
  for (const entry of value.values) {
    if (!isRecord(entry) || typeof entry.value !== "string") return null;
    values.push(entry.value);
  }
  return values;
}

interface JiraWhereSemanticClause {
  fieldIdentity: JiraFieldIdentity;
  operator: string;
  values: string[];
}

function jiraWhereClauseSemantics(
  value: unknown,
): JiraWhereSemanticClause[] | null {
  if (!isRecord(value)) return null;

  if (value.clauses !== undefined) {
    if (
      !Array.isArray(value.clauses) ||
      value.clauses.length === 0 ||
      typeof value.operator !== "string" ||
      value.operator.toLocaleLowerCase("en-US") !== "and"
    ) {
      return null;
    }

    const clauses: JiraWhereSemanticClause[] = [];
    for (const child of value.clauses) {
      const childClauses = jiraWhereClauseSemantics(child);
      if (!childClauses) return null;
      clauses.push(...childClauses);
    }
    return clauses;
  }

  const fieldIdentity = jiraFieldIdentity(value.field);
  if (!fieldIdentity || typeof value.operator !== "string") return null;
  const operator = value.operator.toLocaleLowerCase("en-US");

  if (JQL_COMPARISON_OPERATORS.has(operator)) {
    const operand = jiraSingleOperandValue(value.operand);
    return operand === null
      ? null
      : [{ fieldIdentity, operator, values: [operand] }];
  }

  if (JQL_LIST_OPERATORS.has(operator)) {
    const operands = jiraListOperandValues(value.operand);
    return operands === null
      ? null
      : [
          {
            fieldIdentity,
            operator: operator.toUpperCase(),
            values: operands,
          },
        ];
  }

  if (operator === "is" || operator === "is not") {
    const operand = isRecord(value.operand) ? value.operand : null;
    if (
      !operand ||
      typeof operand.keyword !== "string" ||
      operand.keyword.toLocaleLowerCase("en-US") !== "empty"
    ) {
      return null;
    }
    return [
      {
        fieldIdentity,
        operator: operator === "is" ? "IS EMPTY" : "IS NOT EMPTY",
        values: [],
      },
    ];
  }

  return null;
}

function sameStrings(
  expected: readonly string[],
  actual: readonly string[],
): boolean {
  return (
    expected.length === actual.length &&
    expected.every((value, index) => value === actual[index])
  );
}

function jiraWhereSemanticallyMatches(
  value: unknown,
  requestedJql: string,
  fields: readonly JiraField[],
): boolean {
  const expected = parseReleaseScopeJqlSemantics(requestedJql);
  const actual = jiraWhereClauseSemantics(value);
  if (!expected || !actual || expected.length !== actual.length) return false;

  return expected.every((expectedClause, index) => {
    const actualClause = actual[index];
    if (!actualClause) return false;
    return (
      jiraFieldMatchesExpected(
        actualClause.fieldIdentity,
        expectedClause.field,
        fields,
      ) &&
      actualClause.operator === expectedClause.operator &&
      sameStrings(expectedClause.values, actualClause.values)
    );
  });
}

export function parsedJqlIsValid(
  value: unknown,
  requestedJql: string,
  fields: readonly JiraField[] = [],
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

  void warnings;
  const structure = requireRecord(query.structure, "JQL validation structure");
  const where = requireRecord(
    structure.where,
    "JQL validation where structure",
  );
  if (!jiraWhereSemanticallyMatches(where, requestedJql, fields)) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "JQL validation returned an unexpected response.",
    );
  }

  return true;
}

export class ForgeJiraClient
  extends ForgeJiraGateway
  implements JiraJqlValidator
{
  async validateJql(
    jql: string,
    fields: readonly JiraField[],
  ): Promise<boolean> {
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
    return parsedJqlIsValid(data, jql, fields);
  }
}
