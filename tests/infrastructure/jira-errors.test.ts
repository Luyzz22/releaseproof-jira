import { describe, expect, it } from "vitest";
import {
  buildVersionJql,
  collectIssueSearchPages,
  parseResponse,
} from "../../src/infrastructure/jira/forge-jira-gateway";

function response(status: number, retryAfter: string | null = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => retryAfter },
    json: async () => ({ values: [] }),
  };
}

describe("Jira-Fehlerabbildung", () => {
  it("baut JQL ausschließlich aus validierten technischen IDs", () => {
    expect(buildVersionJql("DEMO", "30001")).toBe(
      'project = "DEMO" AND fixVersion = 30001 ORDER BY key ASC',
    );
    expect(() =>
      buildVersionJql('DEMO" OR project = SECRET', "30001"),
    ).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("übersetzt fehlende Berechtigungen ohne Upstream-Details", async () => {
    await expect(parseResponse(response(403))).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
  });

  it("übernimmt bei Rate Limits nur die technische Wartezeit", async () => {
    await expect(parseResponse(response(429, "45"))).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryAfterSeconds: 45,
    });
  });

  it("erkennt gelöschte oder unzugängliche Versionen", async () => {
    await expect(
      parseResponse(response(404), "VERSION_NOT_FOUND"),
    ).rejects.toMatchObject({
      code: "VERSION_NOT_FOUND",
    });
  });
});

function jiraIssue(id: number) {
  return {
    id: String(id),
    key: `DEMO-${id}`,
    fields: {
      summary: `Vorgang ${id}`,
      issuetype: { id: "10001", name: "Story" },
      status: { id: "31", name: "Fertig" },
      description: null,
      customfield_10042: null,
      labels: [],
      fixVersions: [],
      subtasks: [],
      issuelinks: [],
      resolution: null,
      updated: "2026-07-27T12:00:00.000Z",
    },
  };
}

describe("Jira-Issue-Pagination", () => {
  it("führt Token-Seiten vollständig und mit unverändertem JQL zusammen", async () => {
    const requests: Array<{ jql: string; nextPageToken?: string }> = [];
    const issues = await collectIssueSearchPages(
      {
        jql: "project = DEMO AND key in (DEMO-1, DEMO-2)",
        acceptanceCriteriaFieldId: "customfield_10042",
      },
      (request) => {
        requests.push({
          jql: request.jql,
          ...(request.nextPageToken
            ? { nextPageToken: request.nextPageToken }
            : {}),
        });
        return Promise.resolve(
          request.nextPageToken
            ? { issues: [jiraIssue(2)] }
            : { issues: [jiraIssue(1)], nextPageToken: "page-2" },
        );
      },
    );

    expect(issues.map((item) => item.key)).toEqual(["DEMO-1", "DEMO-2"]);
    expect(requests).toEqual([
      { jql: "project = DEMO AND key in (DEMO-1, DEMO-2)" },
      {
        jql: "project = DEMO AND key in (DEMO-1, DEMO-2)",
        nextPageToken: "page-2",
      },
    ]);
  });

  it("bricht nach 100 REST-Seiten ab statt Teilresultate zu liefern", async () => {
    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO AND key is not EMPTY",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () => Promise.resolve({ issues: [], nextPageToken: "more" }),
      ),
    ).rejects.toMatchObject({ code: "RESULT_LIMIT_EXCEEDED" });
  });
});
