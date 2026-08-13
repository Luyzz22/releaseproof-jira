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
import { isStructurallyValidAdfDocument, jiraValueToText } from "./adf-to-text";

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
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function requireArray(value: unknown, resource: string): unknown[] {
  if (Array.isArray(value)) return value;
  throw new AppError(
    "JIRA_UNAVAILABLE",
    `${resource} returned an unexpected response.`,
  );
}

function requireStringArray(value: unknown, resource: string): string[] {
  return requireArray(value, resource).map((item) => {
    const text = stringValue(item);
    if (text) return text;
    throw new AppError(
      "JIRA_UNAVAILABLE",
      `${resource} returned an unexpected response.`,
    );
  });
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

function pageValues(value: unknown, resource: string): unknown[] {
  const page = requireRecord(value, resource);
  return requireArray(page.values, `${resource} values`);
}

function requirePageInteger(
  value: unknown,
  resource: string,
  field: string,
  positive = false,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    (positive && value === 0)
  ) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      `${resource} returned invalid ${field} pagination metadata.`,
    );
  }
  return value;
}

export function isLastPage(
  value: unknown,
  resource: string,
  expectedStartAt?: number,
): boolean {
  const page = requireRecord(value, resource);
  const values = requireArray(page.values, `${resource} values`);

  if (page.isLast !== undefined && typeof page.isLast !== "boolean") {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      `${resource} returned invalid isLast pagination metadata.`,
    );
  }

  const startAt =
    page.startAt === undefined
      ? null
      : requirePageInteger(page.startAt, resource, "startAt");
  if (expectedStartAt !== undefined) {
    if (!Number.isInteger(expectedStartAt) || expectedStartAt < 0) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        `${resource} received an invalid expected pagination offset.`,
      );
    }
    if (startAt !== null && startAt !== expectedStartAt) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        `${resource} returned pagination metadata for an unexpected offset.`,
      );
    }
    if (expectedStartAt > 0 && startAt === null) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        `${resource} returned pagination metadata without the requested offset.`,
      );
    }
  }

  const maxResults =
    page.maxResults === undefined
      ? null
      : requirePageInteger(page.maxResults, resource, "maxResults", true);
  const total =
    page.total === undefined
      ? null
      : requirePageInteger(page.total, resource, "total");

  const hasCompleteNumericPagination =
    startAt !== null && maxResults !== null && total !== null;
  let numericIsLast: boolean | null = null;

  if (hasCompleteNumericPagination) {
    if (
      values.length > maxResults ||
      startAt + values.length > total ||
      (startAt + values.length < total && values.length < maxResults)
    ) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        `${resource} returned contradictory pagination metadata.`,
      );
    }
    numericIsLast = startAt + values.length >= total;
  }

  if (typeof page.isLast === "boolean") {
    if (numericIsLast !== null && page.isLast !== numericIsLast) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        `${resource} returned contradictory pagination metadata.`,
      );
    }
    return page.isLast;
  }

  if (numericIsLast !== null) {
    return numericIsLast;
  }

  throw new AppError(
    "JIRA_UNAVAILABLE",
    `${resource} returned incomplete pagination metadata.`,
  );
}

export function nextPageStartAt(
  currentStartAt: number,
  pageLength: number,
  resource: string,
): number {
  if (
    !Number.isInteger(currentStartAt) ||
    currentStartAt < 0 ||
    !Number.isInteger(pageLength) ||
    pageLength <= 0
  ) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      `${resource} returned a non-advancing pagination page.`,
    );
  }

  const nextStartAt = currentStartAt + pageLength;
  if (!Number.isSafeInteger(nextStartAt)) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      `${resource} returned an invalid pagination range.`,
    );
  }
  return nextStartAt;
}

function mapProject(value: unknown): JiraProject | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const key = stringValue(value.key);
  const name = stringValue(value.name);
  return id && /^\d+$/.test(id) && key && name ? { id, key, name } : null;
}

function requireMappedProject(value: unknown, resource: string): JiraProject {
  const project = mapProject(value);
  if (project) return project;
  throw new AppError(
    "JIRA_UNAVAILABLE",
    `${resource} returned an unexpected response.`,
  );
}

export function mapProjectDetail(
  value: unknown,
  requestedProjectIdOrKey: string,
  expectedProjectId: string,
): JiraProject {
  const project = requireMappedProject(value, "Project");
  const requestMatches = /^\d+$/.test(requestedProjectIdOrKey)
    ? project.id === requestedProjectIdOrKey
    : project.key === requestedProjectIdOrKey;

  if (!requestMatches || project.id !== expectedProjectId) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "Project returned an unexpected response.",
    );
  }

  return project;
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
    !/^\d+$/.test(id) ||
    !name ||
    !projectId ||
    !/^\d+$/.test(projectId) ||
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

export function mapVersionDetail(
  value: unknown,
  requestedVersionId: string,
): JiraVersion {
  const version = requireMappedVersion(value, "Version");
  if (version.id !== requestedVersionId) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "Version returned an unexpected response.",
    );
  }
  return version;
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
    if (!id || !name) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        "Field search field returned an unexpected response.",
      );
    }

    const schema = requireRecord(field.schema, "Field search field schema");
    const schemaType = stringValue(schema.type);
    if (!schemaType) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        "Field search field schema returned an unexpected response.",
      );
    }

    return {
      id,
      name,
      custom: /^customfield_\d+$/.test(id),
      schemaType,
    };
  });
}

export function mapVersionSearchPage(
  value: unknown,
  expectedProjectId: string,
): JiraVersion[] {
  if (!/^\d+$/.test(expectedProjectId)) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "Version search received an invalid expected project context.",
    );
  }

  return pageValues(value, "Version search").map((item) => {
    const version = requireMappedVersion(item, "Version search version");
    if (version.projectId !== expectedProjectId) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        "Version search version returned an unexpected project context.",
      );
    }
    return version;
  });
}

function mapStatus(value: unknown): StatusRef | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const name = stringValue(value.name);
  return id && /^\d+$/.test(id) && name ? { id, name } : null;
}

function requireMappedStatus(value: unknown, resource: string): StatusRef {
  const status = mapStatus(value);
  if (status) return status;
  throw new AppError(
    "JIRA_UNAVAILABLE",
    `${resource} returned an unexpected response.`,
  );
}

function mapResolution(value: unknown): { id: string; name: string } | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const name = stringValue(value.name);
  return id && /^\d+$/.test(id) && name ? { id, name } : null;
}

function requireNullableResolution(
  value: unknown,
  resource: string,
): { id: string; name: string } | null {
  if (value === undefined || value === null) return null;
  const resolution = mapResolution(value);
  if (resolution) return resolution;
  throw new AppError(
    "JIRA_UNAVAILABLE",
    `${resource} returned an unexpected response.`,
  );
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
  if ((inward ? 1 : 0) + (outward ? 1 : 0) !== 1) return null;
  const target = inward ?? outward;
  if (!target) return null;
  const direction = inward ? "inward" : "outward";
  const relationship = stringValue(value.type[direction]);
  if (!relationship) return null;
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
        status: requireMappedStatus(
          fields.status,
          "Issue search linked issue status",
        ),
        resolution: requireNullableResolution(
          fields.resolution,
          "Issue search linked issue resolution",
        ),
      }
    : null;
}

function requireMappedLinkedIssue(value: unknown): LinkedIssueRef {
  const link = mapLinkedIssue(value);
  if (link) return link;
  throw new AppError(
    "JIRA_UNAVAILABLE",
    "Issue search returned an unexpected issue link.",
  );
}

function requireMappedSubtask(
  value: unknown,
): ReleaseIssue["subtasks"][number] {
  const subtask = requireRecord(value, "Issue search subtask");
  const fields = requireRecord(subtask.fields, "Issue search subtask");
  const id = stringValue(subtask.id);
  const key = stringValue(subtask.key);
  const status = mapStatus(fields.status);
  if (!id || !key || !status) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "Issue search subtask returned an unexpected response.",
    );
  }
  return {
    id,
    key,
    status,
    resolution: requireNullableResolution(
      fields.resolution,
      "Issue search subtask resolution",
    ),
  };
}

function requireMappedFixVersion(
  value: unknown,
): ReleaseIssue["fixVersions"][number] {
  const version = requireRecord(value, "Issue search fixVersion");
  const id = stringValue(version.id);
  const name = stringValue(version.name);
  if (!id || !/^\d+$/.test(id) || !name) {
    throw new AppError(
      "JIRA_UNAVAILABLE",
      "Issue search fixVersion returned an unexpected response.",
    );
  }
  return { id, name };
}

function hasAcceptanceCriteriaEvidence(
  value: unknown,
  fieldId: string,
): boolean {
  if (value === null) return false;

  if (typeof value === "string") {
    if (fieldId === "description") {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        "Issue search description returned an unexpected response.",
      );
    }
    return jiraValueToText(value) !== null;
  }

  if (isRecord(value) && value.type === "doc") {
    if (!isStructurallyValidAdfDocument(value)) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        fieldId === "description"
          ? "Issue search description returned an unexpected response."
          : "Issue search acceptance criteria returned an unexpected response.",
      );
    }
    return jiraValueToText(value) !== null;
  }

  throw new AppError(
    "JIRA_UNAVAILABLE",
    fieldId === "description"
      ? "Issue search description returned an unexpected response."
      : "Issue search acceptance criteria returned an unexpected response.",
  );
}

function issueKeyBelongsToProject(key: string, projectKey: string): boolean {
  const prefix = `${projectKey}-`;
  return key.startsWith(prefix) && /^\d+$/.test(key.slice(prefix.length));
}

function mapIssue(
  value: unknown,
  acceptanceCriteriaFieldId: string,
  expectedProjectKey: string,
): ReleaseIssue | null {
  if (!isRecord(value) || !isRecord(value.fields)) return null;
  const fields = value.fields;
  const id = stringValue(value.id);
  const key = stringValue(value.key);
  const issueType = isRecord(fields.issuetype) ? fields.issuetype : {};
  const issueTypeId = stringValue(issueType.id);
  const issueTypeName = stringValue(issueType.name);
  const status = mapStatus(fields.status);
  if (
    !id ||
    !key ||
    !issueKeyBelongsToProject(key, expectedProjectKey) ||
    !issueTypeId ||
    !/^\d+$/.test(issueTypeId) ||
    !issueTypeName ||
    !status
  ) {
    return null;
  }

  return {
    id,
    key,
    summary: stringValue(fields.summary) ?? "(Ohne Zusammenfassung)",
    issueType: { id: issueTypeId, name: issueTypeName },
    status,
    hasAcceptanceCriteria: hasAcceptanceCriteriaEvidence(
      fields[acceptanceCriteriaFieldId],
      acceptanceCriteriaFieldId,
    ),
    labels: requireStringArray(fields.labels, "Issue search labels"),
    fixVersions: requireArray(
      fields.fixVersions,
      "Issue search fixVersions",
    ).map(requireMappedFixVersion),
    subtasks: requireArray(fields.subtasks, "Issue search subtasks").map(
      requireMappedSubtask,
    ),
    linkedIssues: requireArray(fields.issuelinks, "Issue search").map(
      requireMappedLinkedIssue,
    ),
    resolution: mapResolution(fields.resolution),
    updatedAt: stringValue(fields.updated) ?? new Date(0).toISOString(),
  };
}

function requireMappedIssue(
  value: unknown,
  acceptanceCriteriaFieldId: string,
  expectedProjectKey: string,
): ReleaseIssue {
  const issue = mapIssue(value, acceptanceCriteriaFieldId, expectedProjectKey);
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
    projectKey: string;
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
      (item) =>
        requireMappedIssue(
          item,
          input.acceptanceCriteriaFieldId,
          input.projectKey,
        ),
    );
    if (typeof pageData.isLast !== "boolean") {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        "Issue search returned an unexpected response.",
      );
    }

    const pageToken = optionalPageToken(pageData.nextPageToken, "Issue search");

    if (pageData.isLast) {
      if (pageToken !== undefined) {
        throw new AppError(
          "JIRA_UNAVAILABLE",
          "Issue search returned an unexpected response.",
        );
      }
      issues.push(...pageIssues);
      return issues;
    }

    if (pageToken === undefined) {
      throw new AppError(
        "JIRA_UNAVAILABLE",
        "Issue search returned an unexpected response.",
      );
    }

    issues.push(...pageIssues);
    nextPageToken = pageToken;
  }

  throwPaginationLimit("Issue pagination");
}

export function mapProjectMetadata(value: unknown): ProjectMetadata {
  const items = requireArray(value, "Project metadata");
  const statusMap = new Map<string, JiraStatus>();
  const issueTypes: JiraIssueType[] = items.map((item) => {
    const issueType = requireRecord(item, "Project metadata issue type");
    const id = stringValue(issueType.id);
    const name = stringValue(issueType.name);
    if (
      !id ||
      !/^\d+$/.test(id) ||
      !name ||
      typeof issueType.subtask !== "boolean"
    ) {
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

export class ForgeJiraGateway implements JiraGateway {
  async listProjects(): Promise<JiraProject[]> {
    const projects: JiraProject[] = [];
    let complete = false;
    let startAt = 0;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const data = await parseResponse(
        await api
          .asUser()
          .requestJira(
            route`/rest/api/3/project/search?startAt=${startAt}&maxResults=${PAGE_SIZE}`,
          ),
      );
      const pageProjects = mapProjectSearchPage(data);
      projects.push(...pageProjects);
      if (isLastPage(data, "Project search", startAt)) {
        complete = true;
        break;
      }
      startAt = nextPageStartAt(startAt, pageProjects.length, "Project search");
    }
    if (!complete) throwPaginationLimit("Project pagination");
    return projects;
  }

  async getProject(
    projectIdOrKey: string,
    expectedProjectId: string,
  ): Promise<JiraProject> {
    const data = await parseResponse(
      await api
        .asUser()
        .requestJira(route`/rest/api/3/project/${projectIdOrKey}`),
    );
    return mapProjectDetail(data, projectIdOrKey, expectedProjectId);
  }

  async getProjectMetadata(projectIdOrKey: string): Promise<ProjectMetadata> {
    const data = await parseResponse(
      await api
        .asUser()
        .requestJira(route`/rest/api/3/project/${projectIdOrKey}/statuses`),
    );
    return mapProjectMetadata(data);
  }

  async listFields(projectId: string): Promise<JiraField[]> {
    const fields: JiraField[] = [];
    let complete = false;
    let startAt = 0;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const data = await parseResponse(
        await api
          .asUser()
          .requestJira(
            route`/rest/api/3/field/search?startAt=${startAt}&maxResults=${PAGE_SIZE}&projectIds=${projectId}`,
          ),
      );
      const pageFields = mapFieldSearchPage(data);
      fields.push(...pageFields);
      if (isLastPage(data, "Field search", startAt)) {
        complete = true;
        break;
      }
      startAt = nextPageStartAt(startAt, pageFields.length, "Field search");
    }
    if (!complete) throwPaginationLimit("Field pagination");
    return fields;
  }

  async listVersions(
    projectIdOrKey: string,
    expectedProjectId: string,
  ): Promise<JiraVersion[]> {
    const versions: JiraVersion[] = [];
    let complete = false;
    let startAt = 0;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const data = await parseResponse(
        await api
          .asUser()
          .requestJira(
            route`/rest/api/3/project/${projectIdOrKey}/version?startAt=${startAt}&maxResults=${PAGE_SIZE}&orderBy=-releaseDate`,
          ),
      );
      const pageVersions = mapVersionSearchPage(data, expectedProjectId);
      versions.push(...pageVersions);
      if (isLastPage(data, "Version search", startAt)) {
        complete = true;
        break;
      }
      startAt = nextPageStartAt(startAt, pageVersions.length, "Version search");
    }
    if (!complete) throwPaginationLimit("Version pagination");
    return versions;
  }

  async getVersion(versionId: string): Promise<JiraVersion> {
    const data = await parseResponse(
      await api.asUser().requestJira(route`/rest/api/3/version/${versionId}`),
      "VERSION_NOT_FOUND",
    );
    return mapVersionDetail(data, versionId);
  }

  async listIssuesForVersion(input: {
    projectKey: string;
    versionId: string;
    acceptanceCriteriaFieldId: string;
  }): Promise<ReleaseIssue[]> {
    return this.listIssuesByJql(
      buildVersionJql(input.projectKey, input.versionId),
      input.acceptanceCriteriaFieldId,
      input.projectKey,
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
      input.projectKey,
    );
  }

  private async listIssuesByJql(
    jql: string,
    acceptanceCriteriaFieldId: string,
    projectKey: string,
  ): Promise<ReleaseIssue[]> {
    return collectIssueSearchPages(
      { jql, projectKey, acceptanceCriteriaFieldId },
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
