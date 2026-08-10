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

const malformedIssueCases: ReadonlyArray<readonly [string, unknown]> = [
  ["Issue-Element null", null],
  ["Vorgang ohne fields", { id: "2", key: "DEMO-2" }],
  [
    "Vorgang ohne id",
    (() => {
      const issueWithoutId: Partial<ReturnType<typeof jiraIssue>> =
        jiraIssue(2);
      delete issueWithoutId.id;
      return issueWithoutId;
    })(),
  ],
  [
    "Vorgang ohne key",
    (() => {
      const issueWithoutKey: Partial<ReturnType<typeof jiraIssue>> =
        jiraIssue(2);
      delete issueWithoutKey.key;
      return issueWithoutKey;
    })(),
  ],
  [
    "Vorgang ohne gültigen Issue-Typ",
    {
      ...jiraIssue(2),
      fields: {
        ...jiraIssue(2).fields,
        issuetype: null,
      },
    },
  ],
];

describe("Jira-Issue-Pagination", () => {
  it("fordert description bei einem Custom Field nicht zusätzlich an", async () => {
    let requestedFields: string[] = [];

    await collectIssueSearchPages(
      {
        jql: "project = DEMO",
        acceptanceCriteriaFieldId: "customfield_10042",
      },
      (request) => {
        requestedFields = request.fields;
        return Promise.resolve({ issues: [] });
      },
    );

    expect(requestedFields).not.toContain("description");
    expect(
      requestedFields.filter((field) => field === "customfield_10042"),
    ).toHaveLength(1);
    expect(new Set(requestedFields).size).toBe(requestedFields.length);
    expect(requestedFields).toEqual([
      "summary",
      "issuetype",
      "status",
      "customfield_10042",
      "labels",
      "fixVersions",
      "subtasks",
      "issuelinks",
      "resolution",
      "updated",
    ]);
  });

  it("fordert description als konfigurierte Quelle genau einmal an", async () => {
    let requestedFields: string[] = [];

    await collectIssueSearchPages(
      {
        jql: "project = DEMO",
        acceptanceCriteriaFieldId: "description",
      },
      (request) => {
        requestedFields = request.fields;
        return Promise.resolve({ issues: [] });
      },
    );

    expect(
      requestedFields.filter((field) => field === "description"),
    ).toHaveLength(1);
    expect(new Set(requestedFields).size).toBe(requestedFields.length);
  });

  it.each([
    ["direktem String", "Akzeptanzkriterium", true],
    [
      "gültigem ADF",
      {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Akzeptanzkriterium" }],
          },
        ],
      },
      true,
    ],
    ["null", null, false],
    ["leerem String", "", false],
    ["reinem Whitespace", "   \n\t", false],
    ["einer Zahl", 42, false],
    ["einem Boolean", true, false],
    ["einem Optionsobjekt", { id: "1", value: "Option A" }, false],
  ] satisfies ReadonlyArray<readonly [string, unknown, boolean]>)(
    "bildet bei %s ausschließlich das erwartete Presence-Signal",
    async (_case, value, expected) => {
      const sourceIssue = {
        ...jiraIssue(1),
        fields: {
          ...jiraIssue(1).fields,
          description: "SENSITIVE_DESCRIPTION_DO_NOT_EXPOSE",
          customfield_10042: value,
        },
      };

      const issues = await collectIssueSearchPages(
        {
          jql: "project = DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () => Promise.resolve({ issues: [sourceIssue] }),
      );
      const mappedIssue = issues[0];

      expect(mappedIssue).toHaveProperty("hasAcceptanceCriteria", expected);
      expect(mappedIssue).not.toHaveProperty("description");
      expect(mappedIssue).not.toHaveProperty("acceptanceCriteria");
    },
  );

  it("liefert im internen ReleaseIssue nur das Presence-Signal statt Quelltexten", async () => {
    const sourceIssue = {
      ...jiraIssue(1),
      fields: {
        ...jiraIssue(1).fields,
        customfield_10042: "Akzeptanzkriterium",
      },
    };
    const issues = await collectIssueSearchPages(
      {
        jql: "project = DEMO",
        acceptanceCriteriaFieldId: "customfield_10042",
      },
      () => Promise.resolve({ issues: [sourceIssue] }),
    );

    expect(Object.keys(issues[0] ?? {}).sort()).toEqual(
      [
        "fixVersions",
        "hasAcceptanceCriteria",
        "id",
        "issueType",
        "key",
        "labels",
        "linkedIssues",
        "resolution",
        "status",
        "subtasks",
        "summary",
        "updatedAt",
      ].sort(),
    );
  });

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

  it.each([
    ["fehlendem issues-Feld", {}],
    ["issues als null", { issues: null }],
    ["issues als String", { issues: "invalid" }],
    ["nicht-arrayförmigem issues-Feld", { issues: {} }],
    [
      "falsch typisiertem nextPageToken",
      { issues: [jiraIssue(1)], nextPageToken: 42 },
    ],
  ])("bricht bei %s vollständig ab", async (_case, pageData) => {
    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () => Promise.resolve(pageData),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it.each(malformedIssueCases)(
    "bricht bei %s vollständig ab",
    async (_case, malformedIssue) => {
      await expect(
        collectIssueSearchPages(
          {
            jql: "project = DEMO",
            acceptanceCriteriaFieldId: "customfield_10042",
          },
          () => Promise.resolve({ issues: [jiraIssue(1), malformedIssue] }),
        ),
      ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
    },
  );

  it("verwirft bei einem Fehler auf einer Folgeseite auch vorherige gültige Seiten", async () => {
    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        (request) =>
          Promise.resolve(
            request.nextPageToken
              ? { issues: [{ id: "2", key: "DEMO-2", fields: {} }] }
              : { issues: [jiraIssue(1)], nextPageToken: "page-2" },
          ),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("akzeptiert eine strukturell gültige leere Ergebnisseite", async () => {
    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () => Promise.resolve({ issues: [] }),
      ),
    ).resolves.toEqual([]);
  });
});
