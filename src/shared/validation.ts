import { z } from "zod";
import {
  RELEASE_SCOPE_MODES,
  type ProjectConfig,
  type ReleaseScopeMode,
} from "../domain/models/readiness";

export const RELEASE_SCOPE_JQL_MAX_LENGTH = 2_000;

const ACCEPTED_STATUSES_MAX_ITEMS = 100;
const INCLUDED_ISSUE_TYPES_MAX_ITEMS = 100;
const BLOCKER_LABELS_MAX_ITEMS = 50;
const LABEL_MAX_LENGTH = 255;
const FIELD_ID_PATTERN = /^(customfield_\d+|[a-z][a-zA-Z0-9_-]*)$/;

const jiraId = z.string().regex(/^\d+$/);
const projectKey = z.string().regex(/^[A-Z][A-Z0-9_]{0,19}$/);
const fieldId = z.string().regex(FIELD_ID_PATTERN);
const label = z.string().trim().min(1).max(LABEL_MAX_LENGTH);

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

export type ReleaseScopeJqlSyntaxReason =
  "UNCLOSED_STRING" | "INVALID_BARE_TOKEN" | "UNSUPPORTED_SYNTAX";

export type ReleaseScopeJqlProjectRequiredReason =
  "PROJECT_PREFIX_REQUIRED" | "ADDITIONAL_PROJECT_REFERENCE";

export type ReleaseScopeJqlValidationFailure =
  | { valid: false; code: "EMPTY" }
  | {
      valid: false;
      code: "TOO_LONG";
      maxLength: number;
    }
  | {
      valid: false;
      code: "FIX_VERSION_FORBIDDEN" | "OR_FORBIDDEN";
    }
  | {
      valid: false;
      code: "PROJECT_REQUIRED";
      reason: ReleaseScopeJqlProjectRequiredReason;
    }
  | {
      valid: false;
      code: "PROJECT_MISMATCH";
      expectedProjectKey: string;
    }
  | {
      valid: false;
      code: "SYNTAX_INVALID";
      reason: ReleaseScopeJqlSyntaxReason;
    };

export type ReleaseScopeJqlValidationCode =
  ReleaseScopeJqlValidationFailure["code"];

export type ReleaseScopeJqlValidation =
  { valid: true } | ReleaseScopeJqlValidationFailure;

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
  schemaType?: string | null;
  schemaItemsType?: string | null;
}

const USER_IDENTITY_JQL_SYSTEM_FIELDS = new Set([
  "assignee",
  "reporter",
  "creator",
  "watcher",
  "voter",
]);

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

function hasEstablishedNonUserSchema(field: JiraFieldReference): boolean {
  const fieldId = normalizedJqlFieldReference(field.id);
  if (USER_IDENTITY_JQL_SYSTEM_FIELDS.has(fieldId)) return false;

  const schemaType =
    field.schemaType === undefined || field.schemaType === null
      ? null
      : normalizedJqlFieldReference(field.schemaType);
  if (schemaType === null || schemaType === "user") return false;

  if (schemaType !== "array") return true;

  const schemaItemsType =
    field.schemaItemsType === undefined || field.schemaItemsType === null
      ? null
      : normalizedJqlFieldReference(field.schemaItemsType);
  return schemaItemsType !== null && schemaItemsType !== "user";
}

export function hasNoUserIdentityReleaseScopeJqlFields(
  value: string,
  fields: readonly JiraFieldReference[],
): boolean {
  const tokenized = tokenizeJql(value);
  if (!tokenized.ok) return false;

  const parsed = parseConjunctiveJql(tokenized.tokens);
  if (!parsed.ok) return false;

  const safeBuiltInFields = new Set(["project", "key", "issuekey"]);
  const fieldsByReference = new Map<string, JiraFieldReference[]>();

  for (const field of fields) {
    for (const reference of [field.id, field.name]) {
      const normalizedReference = normalizedJqlFieldReference(reference);
      const matchingFields = fieldsByReference.get(normalizedReference) ?? [];
      matchingFields.push(field);
      fieldsByReference.set(normalizedReference, matchingFields);
    }
  }

  return parsed.clauses.every((clause) => {
    const reference = normalizedJqlFieldReference(clause.field.value);
    if (safeBuiltInFields.has(reference)) return true;

    const matchingFields = fieldsByReference.get(reference);
    return (
      matchingFields !== undefined &&
      matchingFields.length > 0 &&
      matchingFields.every(hasEstablishedNonUserSchema)
    );
  });
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
    };
  }
  if (value.length > RELEASE_SCOPE_JQL_MAX_LENGTH) {
    return {
      valid: false,
      code: "TOO_LONG",
      maxLength: RELEASE_SCOPE_JQL_MAX_LENGTH,
    };
  }

  const tokenized = tokenizeJql(value);
  if (!tokenized.ok) {
    return {
      valid: false,
      code: "SYNTAX_INVALID",
      reason: tokenized.error,
    };
  }
  const { tokens } = tokenized;

  if (tokens.some((token) => isKeyword(token, "OR"))) {
    return {
      valid: false,
      code: "OR_FORBIDDEN",
    };
  }

  const parsed = parseConjunctiveJql(tokens);
  if (!parsed.ok) {
    return {
      valid: false,
      code: "SYNTAX_INVALID",
      reason: "UNSUPPORTED_SYNTAX",
    };
  }

  if (
    parsed.clauses.some((clause) => {
      const field = normalizedFieldName(clause.field.value);
      return field === "fixversion" || field === "fixversions";
    })
  ) {
    return {
      valid: false,
      code: "FIX_VERSION_FORBIDDEN",
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
      reason: "PROJECT_PREFIX_REQUIRED",
    };
  }
  if (projectClause.values[0]!.value.toUpperCase() !== expectedProjectKey) {
    return {
      valid: false,
      code: "PROJECT_MISMATCH",
      expectedProjectKey,
    };
  }

  const additionalProjectReference = parsed.clauses
    .slice(1)
    .some((clause) => normalizedFieldName(clause.field.value) === "project");
  if (additionalProjectReference) {
    return {
      valid: false,
      code: "PROJECT_REQUIRED",
      reason: "ADDITIONAL_PROJECT_REFERENCE",
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
  acceptedStatusIds: z.array(jiraId).min(1).max(ACCEPTED_STATUSES_MAX_ITEMS),
  acceptanceCriteriaFieldId: fieldId,
  blockerLabels: z.array(label).max(BLOCKER_LABELS_MAX_ITEMS),
  includedIssueTypes: z
    .array(jiraId)
    .min(1)
    .max(INCLUDED_ISSUE_TYPES_MAX_ITEMS),
  requireApprovalMarker: z.boolean(),
  approvalMarker: z.string().trim().max(LABEL_MAX_LENGTH),
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

export type ProjectConfigValidationFailure =
  | {
      code:
        | "INVALID_CONFIGURATION"
        | "ACCEPTED_STATUSES_REQUIRED"
        | "INCLUDED_ISSUE_TYPES_REQUIRED"
        | "ACCEPTANCE_CRITERIA_FIELD_INVALID"
        | "BLOCKER_LABEL_INVALID"
        | "APPROVAL_MARKER_REQUIRED"
        | "RELEASE_SCOPE_JQL_FORBIDDEN"
        | "RELEASE_SCOPE_JQL_REQUIRED";
    }
  | {
      code:
        | "ACCEPTED_STATUSES_LIMIT_EXCEEDED"
        | "INCLUDED_ISSUE_TYPES_LIMIT_EXCEEDED"
        | "BLOCKER_LABELS_LIMIT_EXCEEDED";
      maxItems: number;
    }
  | {
      code: "BLOCKER_LABEL_TOO_LONG" | "APPROVAL_MARKER_TOO_LONG";
      maxLength: number;
    }
  | {
      code: "RELEASE_SCOPE_JQL_INVALID";
      validation: ReleaseScopeJqlValidationFailure;
    };

export type ProjectConfigValidationCode =
  ProjectConfigValidationFailure["code"];

interface ConfigValidationIssue {
  path: string[];
  failure: ProjectConfigValidationFailure;
}

function configValidationIssues(
  value: ScopeConfigValue,
): ConfigValidationIssue[] {
  const issues: ConfigValidationIssue[] = [];
  if (value.requireApprovalMarker && value.approvalMarker.length === 0) {
    issues.push({
      path: ["approvalMarker"],
      failure: { code: "APPROVAL_MARKER_REQUIRED" },
    });
  }

  if (value.releaseScopeMode === "VERSION_ONLY") {
    if (value.releaseScopeJql !== undefined) {
      issues.push({
        path: ["releaseScopeJql"],
        failure: { code: "RELEASE_SCOPE_JQL_FORBIDDEN" },
      });
    }
    return issues;
  }

  if (value.releaseScopeJql === undefined) {
    issues.push({
      path: ["releaseScopeJql"],
      failure: { code: "RELEASE_SCOPE_JQL_REQUIRED" },
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
      failure: {
        code: "RELEASE_SCOPE_JQL_INVALID",
        validation,
      },
    });
  }
  return issues;
}

const projectConfigInputObject = z.object({
  ...legacyProjectConfigInputShape,
  ...releaseScopeShape,
});

interface StructuralValidationIssue {
  code: string;
  path: PropertyKey[];
}

function projectConfigStructuralFailure(
  issue: StructuralValidationIssue | undefined,
): ProjectConfigValidationFailure {
  if (!issue) {
    return { code: "INVALID_CONFIGURATION" };
  }

  const field = issue.path[0];

  if (field === "acceptedStatusIds") {
    if (issue.code === "too_small") {
      return { code: "ACCEPTED_STATUSES_REQUIRED" };
    }
    if (issue.code === "too_big") {
      return {
        code: "ACCEPTED_STATUSES_LIMIT_EXCEEDED",
        maxItems: ACCEPTED_STATUSES_MAX_ITEMS,
      };
    }
  }

  if (field === "includedIssueTypes") {
    if (issue.code === "too_small") {
      return { code: "INCLUDED_ISSUE_TYPES_REQUIRED" };
    }
    if (issue.code === "too_big") {
      return {
        code: "INCLUDED_ISSUE_TYPES_LIMIT_EXCEEDED",
        maxItems: INCLUDED_ISSUE_TYPES_MAX_ITEMS,
      };
    }
  }

  if (field === "acceptanceCriteriaFieldId") {
    return { code: "ACCEPTANCE_CRITERIA_FIELD_INVALID" };
  }

  if (field === "blockerLabels") {
    if (issue.path.length === 1 && issue.code === "too_big") {
      return {
        code: "BLOCKER_LABELS_LIMIT_EXCEEDED",
        maxItems: BLOCKER_LABELS_MAX_ITEMS,
      };
    }
    if (issue.code === "too_small") {
      return { code: "BLOCKER_LABEL_INVALID" };
    }
    if (issue.code === "too_big") {
      return { code: "BLOCKER_LABEL_TOO_LONG", maxLength: LABEL_MAX_LENGTH };
    }
  }

  if (field === "approvalMarker" && issue.code === "too_big") {
    return { code: "APPROVAL_MARKER_TOO_LONG", maxLength: LABEL_MAX_LENGTH };
  }

  return { code: "INVALID_CONFIGURATION" };
}

export const projectConfigInputSchema = projectConfigInputObject.superRefine(
  (value, context) => {
    for (const issue of configValidationIssues(value)) {
      context.addIssue({
        code: "custom",
        path: issue.path,
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

export type ProjectConfigInputValidation =
  | { valid: true; data: ProjectConfigInput }
  | { valid: false; failure: ProjectConfigValidationFailure };

export function validateProjectConfigInput(
  value: unknown,
): ProjectConfigInputValidation {
  const parsed = projectConfigInputSchema.safeParse(value);
  if (parsed.success) {
    return { valid: true, data: parsed.data };
  }

  const structural = projectConfigInputObject.safeParse(value);
  if (!structural.success) {
    return {
      valid: false,
      failure: projectConfigStructuralFailure(structural.error.issues[0]),
    };
  }

  return {
    valid: false,
    failure:
      configValidationIssues(structural.data)[0]?.failure ??
      projectConfigStructuralFailure(parsed.error.issues[0]),
  };
}
