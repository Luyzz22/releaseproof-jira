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

interface JqlToken {
  value: string;
  quoted: boolean;
}

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
        | "OR_FORBIDDEN";
      message: string;
    };

function tokenizeJql(value: string): JqlToken[] {
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
          break;
        }
        token += character;
        index += 1;
      }
      tokens.push({ value: token, quoted: true });
      continue;
    }
    if ("(),=<>!".includes(current)) {
      const next = value[index + 1];
      const combined =
        next !== undefined && "=<>".includes(next)
          ? `${current}${next}`
          : current;
      tokens.push({ value: combined, quoted: false });
      index += combined.length;
      continue;
    }

    let token = "";
    while (
      index < value.length &&
      !/\s/.test(value[index]!) &&
      !'"(),=<>!'.includes(value[index]!)
    ) {
      token += value[index]!;
      index += 1;
    }
    if (token.length > 0) tokens.push({ value: token, quoted: false });
  }

  return tokens;
}

function normalizedFieldName(value: string): string {
  return value.toLocaleLowerCase("en-US").replace(/[\s/_-]+/g, "");
}

export function validateReleaseScopeJql(
  value: string,
  expectedProjectKey: string,
): ReleaseScopeJqlValidation {
  if (value.trim().length === 0) {
    return {
      valid: false,
      code: "EMPTY",
      message: "Der explizite Release-Scope darf nicht leer sein.",
    };
  }
  if (value.length > RELEASE_SCOPE_JQL_MAX_LENGTH) {
    return {
      valid: false,
      code: "TOO_LONG",
      message: `Der Release-Scope darf höchstens ${RELEASE_SCOPE_JQL_MAX_LENGTH} Zeichen enthalten.`,
    };
  }

  const tokens = tokenizeJql(value);
  if (
    tokens.some((token) => {
      const field = normalizedFieldName(token.value);
      return field === "fixversion" || field === "fixversions";
    })
  ) {
    return {
      valid: false,
      code: "FIX_VERSION_FORBIDDEN",
      message: "Der Release-Scope darf keine fixVersion-Bedingung enthalten.",
    };
  }

  if (
    tokens.some((token) => !token.quoted && token.value.toUpperCase() === "OR")
  ) {
    return {
      valid: false,
      code: "OR_FORBIDDEN",
      message:
        "OR ist im Release-Scope nicht zulässig, weil die Projektbegrenzung für jeden Treffer gelten muss.",
    };
  }

  const [field, operator, project] = tokens;
  if (
    !field ||
    field.quoted ||
    field.value.toLocaleLowerCase("en-US") !== "project" ||
    operator?.value !== "=" ||
    !project
  ) {
    return {
      valid: false,
      code: "PROJECT_REQUIRED",
      message: "Der Release-Scope muss mit „project = PROJEKTKEY“ beginnen.",
    };
  }
  if (project.value.toUpperCase() !== expectedProjectKey) {
    return {
      valid: false,
      code: "PROJECT_MISMATCH",
      message: `Der Release-Scope muss auf das aktuelle Projekt ${expectedProjectKey} begrenzt sein.`,
    };
  }

  const additionalProjectReference = tokens
    .slice(3)
    .some(
      (token) =>
        normalizedFieldName(token.value) === "project" &&
        token.value.toLocaleLowerCase("en-US") === "project",
    );
  if (additionalProjectReference) {
    return {
      valid: false,
      code: "PROJECT_REQUIRED",
      message:
        "Der Release-Scope darf die Projektbegrenzung nicht erneut verändern.",
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
        message: "Ein Release-Scope-JQL ist nur im Modus JQL_SCOPE zulässig.",
      });
    }
    return issues;
  }

  if (value.releaseScopeJql === undefined) {
    issues.push({
      path: ["releaseScopeJql"],
      message: "Bitte geben Sie einen expliziten Release-Scope an.",
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
