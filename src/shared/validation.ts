import { z } from "zod";
import {
  RELEASE_SCOPE_MODES,
  type ProjectConfig,
  type ReleaseScopeMode,
} from "../domain/models/readiness";

const jiraId = z.string().regex(/^\d+$/, "Jira-ID muss numerisch sein.");
const projectKey = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]{0,19}$/, "Ungültiger Projektschlüssel.");
const fieldId = z
  .string()
  .regex(/^(customfield_\d+|[a-z][a-zA-Z0-9_-]*)$/, "Ungültige Jira-Feld-ID.");
const label = z.string().trim().min(1).max(255);

export const RELEASE_SCOPE_JQL_MAX_LENGTH = 2_000;

type JqlTokenKind =
  "WORD" | "STRING" | "OPERATOR" | "LPAREN" | "RPAREN" | "COMMA";

interface JqlToken {
  kind: JqlTokenKind;
  value: string;
}

type TokenizeJqlResult =
  | { ok: true; tokens: JqlToken[] }
  | { ok: false; error: "UNCLOSED_STRING" | "INVALID_BARE_TOKEN" };

type ComparisonOperator = "=" | "!=" | "~" | "!~" | "<" | "<=" | ">" | ">=";

type ParsedJqlOperator =
  ComparisonOperator | "IN" | "NOT IN" | "IS EMPTY" | "IS NOT EMPTY";

interface ParsedJqlClause {
  field: JqlToken;
  operator: ParsedJqlOperator;
  values: JqlToken[];
}

type ParseJqlResult = { ok: true; clauses: ParsedJqlClause[] } | { ok: false };

export type ReleaseScopeJqlValidation =
  | { valid: true }
  | {
      valid: false;
      code:
        | "EMPTY"
        | "TOO_LONG"
        | "FIX_VERSION_FORBIDDEN"
        | "PROJECT_REQUIRED"
        | "PROJECT_MISMATCH"
        | "OR_FORBIDDEN"
        | "SYNTAX_INVALID";
      message: string;
    };

const COMPARISON_OPERATORS: ReadonlySet<string> = new Set([
  "=",
  "!=",
  "~",
  "!~",
  "<",
  "<=",
  ">",
  ">=",
]);

const RESERVED_WORDS = new Set(["AND", "OR", "IN", "NOT", "IS", "EMPTY"]);
const BARE_JQL_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

function isComparisonOperator(value: string): value is ComparisonOperator {
  return COMPARISON_OPERATORS.has(value);
}

function tokenizeJql(value: string): TokenizeJqlResult {
  const tokens: JqlToken[] = [];
  let index = 0;

  while (index < value.length) {
    const current = value[index]!;
    if (/\s/.test(current)) {
      index += 1;
      continue;
    }
    if (current === '"') {
      let token = "";
      let closed = false;
      index += 1;
      while (index < value.length) {
        const character = value[index]!;
        if (character === "\\" && index + 1 < value.length) {
          token += value[index + 1]!;
          index += 2;
          continue;
        }
        if (character === '"') {
          index += 1;
          closed = true;
          break;
        }
        token += character;
        index += 1;
      }
      if (!closed) return { ok: false, error: "UNCLOSED_STRING" };
      tokens.push({ kind: "STRING", value: token });
      continue;
    }
    if (current === "(") {
      tokens.push({ kind: "LPAREN", value: current });
      index += 1;
      continue;
    }
    if (current === ")") {
      tokens.push({ kind: "RPAREN", value: current });
      index += 1;
      continue;
    }
    if (current === ",") {
      tokens.push({ kind: "COMMA", value: current });
      index += 1;
      continue;
    }
    if ("=<>!~".includes(current)) {
      const next = value[index + 1];
      const pair = next === undefined ? current : `${current}${next}`;
      const operator = ["!=", "!~", "<=", ">="].includes(pair) ? pair : current;
      tokens.push({ kind: "OPERATOR", value: operator });
      index += operator.length;
      continue;
    }

    let token = "";
    while (
      index < value.length &&
      !/\s/.test(value[index]!) &&
      !'"(),=<>!~'.includes(value[index]!)
    ) {
      token += value[index]!;
      index += 1;
    }
    if (token.length > 0) {
      if (!BARE_JQL_TOKEN_PATTERN.test(token)) {
        return { ok: false, error: "INVALID_BARE_TOKEN" };
      }
      tokens.push({ kind: "WORD", value: token });
    }
  }

  return { ok: true, tokens };
}

function normalizedFieldName(value: string): string {
  return value.toLocaleLowerCase("en-US").replace(/[\s/_-]+/g, "");
}

function isKeyword(token: JqlToken | undefined, keyword: string): boolean {
  return (
    token?.kind === "WORD" &&
    token.value.toUpperCase() === keyword.toUpperCase()
  );
}

function isFieldToken(token: JqlToken | undefined): token is JqlToken {
  if (!token || (token.kind !== "WORD" && token.kind !== "STRING")) {
    return false;
  }
  return (
    token.value.length > 0 && !RESERVED_WORDS.has(token.value.toUpperCase())
  );
}

function isValueToken(token: JqlToken | undefined): token is JqlToken {
  if (!token || (token.kind !== "WORD" && token.kind !== "STRING")) {
    return false;
  }
  return (
    token.kind === "STRING" || !RESERVED_WORDS.has(token.value.toUpperCase())
  );
}

function parseValueList(
  tokens: readonly JqlToken[],
  startIndex: number,
): { values: JqlToken[]; nextIndex: number } | null {
  if (tokens[startIndex]?.kind !== "LPAREN") return null;

  const values: JqlToken[] = [];
  let index = startIndex + 1;
  while (index < tokens.length) {
    const value = tokens[index];
    if (!isValueToken(value)) return null;
    values.push(value);
    index += 1;

    const separator = tokens[index];
    if (separator?.kind === "RPAREN") {
      return { values, nextIndex: index + 1 };
    }
    if (separator?.kind !== "COMMA") return null;
    index += 1;
  }

  return null;
}

function parseClause(
  tokens: readonly JqlToken[],
  startIndex: number,
): { clause: ParsedJqlClause; nextIndex: number } | null {
  const field = tokens[startIndex];
  if (!isFieldToken(field)) return null;

  const operatorToken = tokens[startIndex + 1];
  if (
    operatorToken?.kind === "OPERATOR" &&
    isComparisonOperator(operatorToken.value)
  ) {
    const value = tokens[startIndex + 2];
    if (!isValueToken(value)) return null;
    return {
      clause: {
        field,
        operator: operatorToken.value,
        values: [value],
      },
      nextIndex: startIndex + 3,
    };
  }

  let listOperator: "IN" | "NOT IN" | null = null;
  let listStartIndex = startIndex + 2;
  if (isKeyword(operatorToken, "IN")) {
    listOperator = "IN";
  } else if (
    isKeyword(operatorToken, "NOT") &&
    isKeyword(tokens[startIndex + 2], "IN")
  ) {
    listOperator = "NOT IN";
    listStartIndex += 1;
  }
  if (listOperator) {
    const list = parseValueList(tokens, listStartIndex);
    if (!list) return null;
    return {
      clause: { field, operator: listOperator, values: list.values },
      nextIndex: list.nextIndex,
    };
  }

  if (isKeyword(operatorToken, "IS")) {
    const negated = isKeyword(tokens[startIndex + 2], "NOT");
    const emptyIndex = startIndex + (negated ? 3 : 2);
    if (!isKeyword(tokens[emptyIndex], "EMPTY")) return null;
    return {
      clause: {
        field,
        operator: negated ? "IS NOT EMPTY" : "IS EMPTY",
        values: [],
      },
      nextIndex: emptyIndex + 1,
    };
  }

  return null;
}

function parseConjunctiveJql(tokens: readonly JqlToken[]): ParseJqlResult {
  const clauses: ParsedJqlClause[] = [];
  let index = 0;

  while (index < tokens.length) {
    const parsed = parseClause(tokens, index);
    if (!parsed) return { ok: false };
    clauses.push(parsed.clause);
    index = parsed.nextIndex;
    if (index === tokens.length) break;
    if (!isKeyword(tokens[index], "AND")) return { ok: false };
    index += 1;
    if (index === tokens.length) return { ok: false };
  }

  return clauses.length > 0 ? { ok: true, clauses } : { ok: false };
}

interface JiraFieldReference {
  id: string;
  name: string;
}

function normalizedJqlFieldReference(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function hasOnlyKnownReleaseScopeJqlFields(
  value: string,
  fields: readonly JiraFieldReference[],
): boolean {
  const tokenized = tokenizeJql(value);
  if (!tokenized.ok) return false;

  const parsed = parseConjunctiveJql(tokenized.tokens);
  if (!parsed.ok) return false;

  const knownFields = new Set(["project", "key", "issuekey"]);
  for (const field of fields) {
    knownFields.add(normalizedJqlFieldReference(field.id));
    knownFields.add(normalizedJqlFieldReference(field.name));
  }

  return parsed.clauses.every((clause) =>
    knownFields.has(normalizedJqlFieldReference(clause.field.value)),
  );
}

export interface ReleaseScopeJqlSemanticClause {
  field: string;
  operator: string;
  values: string[];
}

export function parseReleaseScopeJqlSemantics(
  value: string,
): ReleaseScopeJqlSemanticClause[] | null {
  const tokenized = tokenizeJql(value);
  if (!tokenized.ok) return null;

  const parsed = parseConjunctiveJql(tokenized.tokens);
  if (!parsed.ok) return null;

  return parsed.clauses.map((clause) => ({
    field: normalizedJqlFieldReference(clause.field.value),
    operator: clause.operator,
    values: clause.values.map((valueToken) => valueToken.value),
  }));
}

function normalizedReleaseScopeJqlSemantics(value: string): string | null {
  const semantics = parseReleaseScopeJqlSemantics(value);
  return semantics === null ? null : JSON.stringify(semantics);
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
): ReleaseScopeJqlValidation {
  if (value.trim().length === 0) {
    return {
      valid: false,
      code: "EMPTY",
      message: "Der explizite Release-Umfang darf nicht leer sein.",
    };
  }
  if (value.length > RELEASE_SCOPE_JQL_MAX_LENGTH) {
    return {
      valid: false,
      code: "TOO_LONG",
      message: `Der Release-Umfang darf höchstens ${RELEASE_SCOPE_JQL_MAX_LENGTH} Zeichen enthalten.`,
    };
  }

  const tokenized = tokenizeJql(value);
  if (!tokenized.ok) {
    return {
      valid: false,
      code: "SYNTAX_INVALID",
      message:
        tokenized.error === "UNCLOSED_STRING"
          ? "Der Release-Umfang enthält eine nicht geschlossene Zeichenfolge."
          : "Der Release-Umfang enthält einen nicht unterstützten ungequoteten JQL-Wert. Werte mit Sonderzeichen müssen in Anführungszeichen stehen.",
    };
  }
  const { tokens } = tokenized;
  if (
    tokens.some((token) => {
      const field = normalizedFieldName(token.value);
      return field === "fixversion" || field === "fixversions";
    })
  ) {
    return {
      valid: false,
      code: "FIX_VERSION_FORBIDDEN",
      message: "Der Release-Umfang darf keine fixVersion-Bedingung enthalten.",
    };
  }

  if (tokens.some((token) => isKeyword(token, "OR"))) {
    return {
      valid: false,
      code: "OR_FORBIDDEN",
      message:
        "OR ist im Release-Umfang nicht zulässig, weil die Projektbegrenzung für jeden Treffer gelten muss.",
    };
  }

  const parsed = parseConjunctiveJql(tokens);
  if (!parsed.ok) {
    return {
      valid: false,
      code: "SYNTAX_INVALID",
      message:
        "Der Release-Umfang ist syntaktisch unvollständig oder verwendet eine nicht unterstützte JQL-Form.",
    };
  }

  const [projectClause] = parsed.clauses;
  if (
    !projectClause ||
    projectClause.field.kind !== "WORD" ||
    projectClause.field.value.toLocaleLowerCase("en-US") !== "project" ||
    projectClause.operator !== "=" ||
    projectClause.values.length !== 1
  ) {
    return {
      valid: false,
      code: "PROJECT_REQUIRED",
      message: "Der Release-Umfang muss mit „project = PROJEKTKEY“ beginnen.",
    };
  }
  if (projectClause.values[0]!.value.toUpperCase() !== expectedProjectKey) {
    return {
      valid: false,
      code: "PROJECT_MISMATCH",
      message: `Der Release-Umfang muss auf das aktuelle Projekt ${expectedProjectKey} begrenzt sein.`,
    };
  }

  const additionalProjectReference = parsed.clauses
    .slice(1)
    .some((clause) => normalizedFieldName(clause.field.value) === "project");
  if (additionalProjectReference) {
    return {
      valid: false,
      code: "PROJECT_REQUIRED",
      message:
        "Der Release-Umfang darf die Projektbegrenzung nicht erneut verändern.",
    };
  }

  return { valid: true };
}

export const projectContextSchema = z.object({
  projectId: jiraId,
  projectKey,
  siteUrl: z.string().url().startsWith("https://"),
});

const legacyProjectConfigInputShape = {
  projectId: jiraId,
  projectKey,
  acceptedStatusIds: z.array(jiraId).min(1).max(100),
  acceptanceCriteriaFieldId: fieldId,
  blockerLabels: z.array(label).max(50),
  includedIssueTypes: z.array(jiraId).min(1).max(100),
  requireApprovalMarker: z.boolean(),
  approvalMarker: z.string().trim().max(255),
  blockOnOpenSubtasks: z.boolean(),
} as const;

const releaseScopeShape = {
  releaseScopeMode: z.enum(RELEASE_SCOPE_MODES),
  releaseScopeJql: z.string().optional(),
} as const;

interface ScopeConfigValue {
  projectKey: string;
  releaseScopeMode: ReleaseScopeMode;
  releaseScopeJql?: string | undefined;
  requireApprovalMarker: boolean;
  approvalMarker: string;
}

interface ConfigValidationIssue {
  path: string[];
  message: string;
}

function configValidationIssues(
  value: ScopeConfigValue,
): ConfigValidationIssue[] {
  const issues: ConfigValidationIssue[] = [];
  if (value.requireApprovalMarker && value.approvalMarker.length === 0) {
    issues.push({
      path: ["approvalMarker"],
      message: "Bei aktivierter Freigabeprüfung ist ein Label erforderlich.",
    });
  }

  if (value.releaseScopeMode === "VERSION_ONLY") {
    if (value.releaseScopeJql !== undefined) {
      issues.push({
        path: ["releaseScopeJql"],
        message:
          "Eine JQL für den Release-Umfang ist nur im Modus „Expliziter JQL-Umfang“ zulässig.",
      });
    }
    return issues;
  }

  if (value.releaseScopeJql === undefined) {
    issues.push({
      path: ["releaseScopeJql"],
      message: "Bitte geben Sie einen expliziten Release-Umfang an.",
    });
    return issues;
  }

  const validation = validateReleaseScopeJql(
    value.releaseScopeJql,
    value.projectKey,
  );
  if (!validation.valid) {
    issues.push({
      path: ["releaseScopeJql"],
      message: validation.message,
    });
  }
  return issues;
}

const projectConfigInputObject = z.object({
  ...legacyProjectConfigInputShape,
  ...releaseScopeShape,
});

export const projectConfigInputSchema = projectConfigInputObject.superRefine(
  (value, context) => {
    for (const issue of configValidationIssues(value)) {
      context.addIssue({
        code: "custom",
        path: issue.path,
        message: issue.message,
      });
    }
  },
);

const timestamps = {
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
} as const;

export const projectConfigSchema = projectConfigInputObject
  .extend(timestamps)
  .superRefine((value, context) => {
    for (const issue of configValidationIssues(value)) {
      context.addIssue({
        code: "custom",
        path: issue.path,
        message: issue.message,
      });
    }
  });

const legacyProjectConfigSchema = z.object({
  ...legacyProjectConfigInputShape,
  ...timestamps,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeStoredProjectConfig(
  value: unknown,
): ProjectConfig | null {
  const current = projectConfigSchema.safeParse(value);
  if (current.success) {
    const { releaseScopeJql, ...config } = current.data;
    return releaseScopeJql === undefined
      ? config
      : { ...config, releaseScopeJql };
  }

  if (
    !isRecord(value) ||
    "releaseScopeMode" in value ||
    "releaseScopeJql" in value
  ) {
    return null;
  }
  const legacy = legacyProjectConfigSchema.safeParse(value);
  return legacy.success
    ? { ...legacy.data, releaseScopeMode: "VERSION_ONLY" }
    : null;
}

export const versionInputSchema = z.object({
  versionId: jiraId,
});

export type ProjectConfigInput = z.infer<typeof projectConfigInputSchema>;
