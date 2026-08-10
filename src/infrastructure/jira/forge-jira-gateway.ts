import api, { route } from "@forge/api";
import type {
  JiraField,
  JiraGateway,
  JiraIssueType,
  JiraProject,
  JiraStatus,
  JiraVersion,
  ProjectMetadata,
} from "../../application/ports";
import type {
  LinkedIssueRef,
  ReleaseIssue,
  StatusRef,
} from "../../domain/models/readiness";
import { AppError } from "../../shared/errors";
import { validateReleaseScopeJql } from "../../shared/validation";
import { jiraValueToText } from "./adf-to-text";

const PAGE_SIZE = 100;
const MAX_PAGES = 100;

function throwPaginationLimit(resource: string): never {
  throw new AppError(
    "RESULT_LIMIT_EXCEEDED",
    `${resource} exceeded the configured pagination limit.`,
  );
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

export function buildVersionJql(projectKey: string, versionId: string): string {
  if (!/^[A-Z][A-Z0-9_]{0,19}$/.test(projectKey) || !/^\d+$/.test(versionId)) {
    throw new AppError("INVALID_INPUT", "Unsafe JQL input rejected.");
  }
  return `project = "${projectKey}" AND fixVersion = ${versionId} ORDER BY key ASC`;
}

function validateFieldId(fieldId: string): void {
  if (!/^(customfield_\d+|[a-z][a-zA-Z0-9_-]*)$/.test(fieldId)) {
    throw new AppError("INVALID_INPUT", "Unsafe Jira field ID rejected.");
  }
}

interface JiraResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function requireArray(value: unknown, resource: string): unknown[] {
  if (Array.isArray(value)) return value;
  throw new AppError(
    "JIRA_UNAVAILABLE",
    `${resource} returned an unexpected response.`,
  );
}

function optionalPageToken(
  value: unknown,
  resource: string,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  const token = stringValue(value);
  if (token) return token;
  throw new AppError(
    "JIRA_UNAVAILABLE",
    `${resource} returned an unexpected response.`,
  );
}

export async function parseResponse(
  response: JiraResponse,
  notFoundCode?: "VERSION_NOT_FOUND",
) {
  if (response.ok) return response.json();
  if (response.status === 401 || response.status === 403) {
    throw new AppError("PERMISSION_DENIED", "Jira permission denied.");
  }
  if (response.status === 404 && notFoundCode) {
    throw new AppError(notFoundCode, "Jira entity not found.");
  }
  if (response.status === 429) {
    const raw = response.headers.get("retry-after");
    const retryAfter = raw === null ? undefined : Number.parseInt(raw, 10);
    throw new AppError(
      "RATE_LIMITED",
      "Jira rate limit reached.",
      Number.isFinite(retryAfter) ? retryAfter : undefined,
    );
  }
  throw new AppError(
    "JIRA_UNAVAILABLE",
    `Jira request failed with ${response.status}.`,
  );
}

function pageValues(value: unknown): unknown[] {
  return isRecord(value) ? arrayValue(value.values) : [];
}

function isLastPage(value: unknown, currentCount: number): boolean {
  if (!isRecord(value)) return true;
  if (typeof value.isLast === "boolean") return value.isLast;
  const total = typeof value.total === "number" ? value.total : currentCount;
  const startAt = typeof value.startAt === "number" ? value.startAt : 0;
  const maxResults =
    typeof value.maxResults === "number" ? value.maxResults : PAGE_SIZE;
  return startAt + maxResults >= total;
}

function mapProject(value: unknown): JiraProject | null {
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

function mapStatus(value: unknown): StatusRef | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const name = stringValue(value.name);
  return id && name ? { id, name } : null;
}

function mapResolution(value: unknown): { id: string; name: string } | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const name = stringValue(value.name);
  return id && name ? { id, name } : null;
}

function normalized(value: string): string {
  return value
    .toLocaleLowerCase("de-DE")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function blockingRelationship(
  direction: LinkedIssueRef["direction"],
  relationship: string,
  typeName: string,
): boolean {
  const description = normalized(relationship);
  if (
    description.includes("blocked by") ||
    description.includes("is blocked by") ||
    description.includes("wird blockiert von") ||
    description.includes("depends on") ||
    description.includes("abhängig von")
  ) {
    return true;
  }
  return direction === "inward" && normalized(typeName).includes("block");
}

function mapLinkedIssue(value: unknown): LinkedIssueRef | null {
  if (!isRecord(value) || !isRecord(value.type)) return null;
  const inward = isRecord(value.inwardIssue) ? value.inwardIssue : null;
  const outward = isRecord(value.outwardIssue) ? value.outwardIssue : null;
  const target = inward ?? outward;
  if (!target) return null;
  const direction = inward ? "inward" : "outward";
  const relationship =
    stringValue(value.type[direction]) ??
    stringValue(value.type.name) ??
    "verknüpft mit";
  const typeName = stringValue(value.type.name) ?? relationship;
  const fields = isRecord(target.fields) ? target.fields : {};
  const id = stringValue(target.id);
  const key = stringValue(target.key);
  return id && key
    ? {
        id,
        key,
        relationship,
        direction,
        isBlocking: blockingRelationship(direction, relationship, typeName),
        status: mapStatus(fields.status),
        resolution: mapResolution(fields.resolution),
      }
    : null;
}

function mapIssue(
  value: unknown,
  acceptanceCriteriaFieldId: string,
): ReleaseIssue | null {
  if (!isRecord(value) || !isRecord(value.fields)) return null;
  const fields = value.fields;
  const id = stringValue(value.id);
  const key = stringValue(value.key);
  const issueType = isRecord(fields.issuetype) ? fields.issuetype : {};
  const issueTypeId = stringValue(issueType.id);
  const issueTypeName = stringValue(issueType.name);
  if (!id || !key || !issueTypeId || !issueTypeName) return null;

  return {
    id,
    key,
    summary: stringValue(fields.summary) ?? "(Ohne Zusammenfassung)",
    issueType: { id: issueTypeId, name: issueTypeName },
    status: mapStatus(fields.status),
    hasAcceptanceCriteria:
      jiraValueToText(fields[acceptanceCriteriaFieldId]) !== null,
    labels: arrayValue(fields.labels).flatMap((label) =>
      typeof label === "string" ? [label] : [],
    ),
    fixVersions: arrayValue(fields.fixVersions).flatMap((version) => {
      if (!isRecord(version)) return [];
      const versionId = stringValue(version.id);
      const name = stringValue(version.name);
      return versionId && name ? [{ id: versionId, name }] : [];
    }),
    subtasks: arrayValue(fields.subtasks).flatMap((subtask) => {
      if (!isRecord(subtask)) return [];
      const subtaskFields = isRecord(subtask.fields) ? subtask.fields : {};
      const subtaskId = stringValue(subtask.id);
      const subtaskKey = stringValue(subtask.key);
      return subtaskId && subtaskKey
        ? [
            {
              id: subtaskId,
              key: subtaskKey,
              status: mapStatus(subtaskFields.status),
              resolution: mapResolution(subtaskFields.resolution),
            },
          ]
        : [];
    }),
    linkedIssues: arrayValue(fields.issuelinks).flatMap((link) => {
      const mapped = mapLinkedIssue(link);
      return mapped ? [mapped] : [];
    }),
    resolution: mapResolution(fields.resolution),
    updatedAt: stringValue(fields.updated) ?? new Date(0).toISOString(),
  };
}

function requireMappedIssue(
  value: unknown,
  acceptanceCriteriaFieldId: string,
): ReleaseIssue {
  const issue = mapIssue(value, acceptanceCriteriaFieldId);
  if (issue) return issue;
  throw new AppError(
    "JIRA_UNAVAILABLE",
    "Issue search returned an unexpected issue.",
  );
}

interface IssueSearchRequest {
  jql: string;
  fields: string[];
  maxResults: number;
  nextPageToken?: string;
}

type IssueSearchPageLoader = (request: IssueSearchRequest) => Promise<unknown>;

export async function collectIssueSearchPages(
  input: {
    jql: string;
    acceptanceCriteriaFieldId: string;
  },
  loadPage: IssueSearchPageLoader,
): Promise<ReleaseIssue[]> {
  validateFieldId(input.acceptanceCriteriaFieldId);
  const issues: ReleaseIssue[] = [];
  let nextPageToken: string | undefined;
  const fields = Array.from(
    new Set([
      "summary",
      "issuetype",
      "status",
      input.acceptanceCriteriaFieldId,
      "labels",
      "fixVersions",
      "subtasks",
      "issuelinks",
      "resolution",
      "updated",
    ]),
  );

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = await loadPage({
      jql: input.jql,
      fields,
      maxResults: PAGE_SIZE,
      ...(nextPageToken ? { nextPageToken } : {}),
    });
    const pageData = requireRecord(data, "Issue search");
    const pageIssues = requireArray(pageData.issues, "Issue search").map(
      (item) => requireMappedIssue(item, input.acceptanceCriteriaFieldId),
    );
    const pageToken = optionalPageToken(pageData.nextPageToken, "Issue search");
    issues.push(...pageIssues);
    nextPageToken = pageToken;
    if (!nextPageToken) return issues;
  }

  throwPaginationLimit("Issue pagination");
}

export class ForgeJiraGateway implements JiraGateway {
  async listProjects(): Promise<JiraProject[]> {
    const projects: JiraProject[] = [];
    let complete = false;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const startAt = page * PAGE_SIZE;
      const data = await parseResponse(
        await api
          .asUser()
          .requestJira(
            route`/rest/api/3/project/search?startAt=${startAt}&maxResults=${PAGE_SIZE}`,
          ),
      );
      requireRecord(data, "Project search");
      projects.push(
        ...pageValues(data).flatMap((item) => mapProject(item) ?? []),
      );
      if (isLastPage(data, projects.length)) {
        complete = true;
        break;
      }
    }
    if (!complete) throwPaginationLimit("Project pagination");
    return projects;
  }

  async getProject(projectIdOrKey: string): Promise<JiraProject> {
    const data = await parseResponse(
      await api
        .asUser()
        .requestJira(route`/rest/api/3/project/${projectIdOrKey}`),
    );
    const project = mapProject(data);
    if (!project)
      throw new AppError("JIRA_UNAVAILABLE", "Unexpected project response.");
    return project;
  }

  async getProjectMetadata(projectIdOrKey: string): Promise<ProjectMetadata> {
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

  async listFields(projectId: string): Promise<JiraField[]> {
    const fields: JiraField[] = [];
    let complete = false;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const startAt = page * PAGE_SIZE;
      const data = await parseResponse(
        await api
          .asUser()
          .requestJira(
            route`/rest/api/3/field/search?startAt=${startAt}&maxResults=${PAGE_SIZE}&projectIds=${projectId}`,
          ),
      );
      requireRecord(data, "Field search");
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
      if (isLastPage(data, fields.length)) {
        complete = true;
        break;
      }
    }
    if (!complete) throwPaginationLimit("Field pagination");
    return fields;
  }

  async listVersions(projectIdOrKey: string): Promise<JiraVersion[]> {
    const versions: JiraVersion[] = [];
    let complete = false;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const startAt = page * PAGE_SIZE;
      const data = await parseResponse(
        await api
          .asUser()
          .requestJira(
            route`/rest/api/3/project/${projectIdOrKey}/version?startAt=${startAt}&maxResults=${PAGE_SIZE}&orderBy=-releaseDate`,
          ),
      );
      requireRecord(data, "Version search");
      versions.push(
        ...pageValues(data).flatMap((item) => mapVersion(item) ?? []),
      );
      if (isLastPage(data, versions.length)) {
        complete = true;
        break;
      }
    }
    if (!complete) throwPaginationLimit("Version pagination");
    return versions;
  }

  async getVersion(versionId: string): Promise<JiraVersion> {
    const data = await parseResponse(
      await api.asUser().requestJira(route`/rest/api/3/version/${versionId}`),
      "VERSION_NOT_FOUND",
    );
    const version = mapVersion(data);
    if (!version)
      throw new AppError("VERSION_NOT_FOUND", "Unexpected version response.");
    return version;
  }

  async listIssuesForVersion(input: {
    projectKey: string;
    versionId: string;
    acceptanceCriteriaFieldId: string;
  }): Promise<ReleaseIssue[]> {
    return this.listIssuesByJql(
      buildVersionJql(input.projectKey, input.versionId),
      input.acceptanceCriteriaFieldId,
    );
  }

  async listIssuesForJqlScope(input: {
    projectKey: string;
    releaseScopeJql: string;
    acceptanceCriteriaFieldId: string;
  }): Promise<ReleaseIssue[]> {
    const validation = validateReleaseScopeJql(
      input.releaseScopeJql,
      input.projectKey,
    );
    if (!validation.valid) {
      throw new AppError("INVALID_INPUT", validation.message);
    }
    return this.listIssuesByJql(
      input.releaseScopeJql,
      input.acceptanceCriteriaFieldId,
    );
  }

  private async listIssuesByJql(
    jql: string,
    acceptanceCriteriaFieldId: string,
  ): Promise<ReleaseIssue[]> {
    return collectIssueSearchPages(
      { jql, acceptanceCriteriaFieldId },
      async (request) => {
        const response = await api
          .asUser()
          .requestJira(route`/rest/api/3/search/jql`, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...request,
            }),
          });
        return parseResponse(response);
      },
    );
  }
}
