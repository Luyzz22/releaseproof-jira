import api, { route } from "@forge/api";
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

  void warnings;
  const structure = requireRecord(query.structure, "JQL validation structure");
  requireRecord(structure.where, "JQL validation where structure");

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
