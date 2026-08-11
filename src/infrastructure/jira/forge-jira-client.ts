import api, { route } from "@forge/api";
import type { JiraJqlValidator } from "../../application/ports";
import { AppError } from "../../shared/errors";
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

export function parsedJqlIsValid(value: unknown): boolean {
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
    return parsedJqlIsValid(data);
  }
}
