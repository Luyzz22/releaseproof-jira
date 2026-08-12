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

function blockingIssueLink() {
  return {
    type: {
      name: "Blocks",
      inward: "is blocked by",
      outward: "blocks",
    },
    inwardIssue: {
      id: "20001",
      key: "DEMO-99",
      fields: {
        status: { id: "11", name: "Offen" },
        resolution: null,
      },
    },
  };
}

function nonBlockingIssueLink() {
  return {
    type: {
      name: "Relates",
      inward: "relates to",
      outward: "relates to",
    },
    outwardIssue: {
      id: "20002",
      key: "DEMO-100",
      fields: {
        status: { id: "31", name: "Fertig" },
        resolution: { id: "1", name: "Erledigt" },
      },
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
  [
    "Vorgang mit nichtnumerischer Issue-Typ-ID",
    {
      ...jiraIssue(2),
      fields: {
        ...jiraIssue(2).fields,
        issuetype: { id: "Story", name: "Story" },
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
        projectKey: "DEMO",
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
        projectKey: "DEMO",
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
          projectKey: "DEMO",
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

  it.each([
    ["einer Zahl", 42],
    ["einem Boolean", true],
    ["einem Optionsobjekt", { id: "1", value: "Option A" }],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "weist Acceptance-Criteria-Evidence mit %s fail-closed zurück",
    async (_case, value) => {
      const sourceIssue = {
        ...jiraIssue(1),
        fields: {
          ...jiraIssue(1).fields,
          description: "SENSITIVE_DESCRIPTION_DO_NOT_EXPOSE",
          customfield_10042: value,
        },
      };

      await expect(
        collectIssueSearchPages(
          {
            jql: "project = DEMO",
            projectKey: "DEMO",
            acceptanceCriteriaFieldId: "customfield_10042",
          },
          () => Promise.resolve({ issues: [sourceIssue] }),
        ),
      ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
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
        projectKey: "DEMO",
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

  it.each([
    ["fehlendem fixVersions-Feld", undefined],
    ["fixVersions als null", null],
    ["fixVersions als String", "invalid"],
    ["nicht-arrayförmigem fixVersions-Feld", {}],
  ])("bricht bei %s fail-closed ab", async (_case, fixVersions) => {
    const fields: Record<string, unknown> = { ...jiraIssue(1).fields };
    if (fixVersions === undefined) {
      delete fields.fixVersions;
    } else {
      fields.fixVersions = fixVersions;
    }

    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () =>
          Promise.resolve({
            issues: [{ ...jiraIssue(1), fields }],
          }),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it.each([
    ["null-Version", null],
    ["Version ohne id", { name: "1.0.0" }],
    ["Version ohne name", { id: "30001" }],
    ["Version mit leerer id", { id: " ", name: "1.0.0" }],
    ["Version mit nichtnumerischer id", { id: "30001x", name: "1.0.0" }],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "bricht bei malformed %s vollständig ab",
    async (_case, malformedVersion) => {
      const sourceIssue = {
        ...jiraIssue(1),
        fields: {
          ...jiraIssue(1).fields,
          fixVersions: [malformedVersion],
        },
      };

      await expect(
        collectIssueSearchPages(
          {
            jql: "project = DEMO",
            projectKey: "DEMO",
            acceptanceCriteriaFieldId: "customfield_10042",
          },
          () => Promise.resolve({ issues: [sourceIssue] }),
        ),
      ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
    },
  );

  it("verwirft bei gemischten gültigen und malformed fixVersions das gesamte Ergebnis", async () => {
    const sourceIssue = {
      ...jiraIssue(1),
      fields: {
        ...jiraIssue(1).fields,
        fixVersions: [{ id: "30001", name: "1.0.0" }, { id: "30002" }],
      },
    };

    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () => Promise.resolve({ issues: [sourceIssue] }),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("verwirft bei gemischten numerischen und nichtnumerischen fixVersions das gesamte Ergebnis", async () => {
    const sourceIssue = {
      ...jiraIssue(1),
      fields: {
        ...jiraIssue(1).fields,
        fixVersions: [
          { id: "30001", name: "1.0.0" },
          { id: "30002x", name: "2.0.0" },
        ],
      },
    };

    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () => Promise.resolve({ issues: [sourceIssue] }),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("behält vollständige fixVersions-Evidence unverändert", async () => {
    const sourceIssue = {
      ...jiraIssue(1),
      fields: {
        ...jiraIssue(1).fields,
        fixVersions: [
          { id: "30001", name: "1.0.0" },
          { id: "30002", name: "2.0.0" },
        ],
      },
    };

    const issues = await collectIssueSearchPages(
      {
        jql: "project = DEMO",
        projectKey: "DEMO",
        acceptanceCriteriaFieldId: "customfield_10042",
      },
      () => Promise.resolve({ issues: [sourceIssue] }),
    );

    expect(issues[0]?.fixVersions).toEqual([
      { id: "30001", name: "1.0.0" },
      { id: "30002", name: "2.0.0" },
    ]);
  });

  it.each([
    ["fehlendem issuelinks-Feld", undefined],
    ["issuelinks als null", null],
    ["issuelinks als String", "invalid"],
    ["nicht-arrayförmigem issuelinks-Feld", {}],
  ])("bricht bei %s fail-closed ab", async (_case, issueLinks) => {
    const fields: Record<string, unknown> = { ...jiraIssue(1).fields };
    if (issueLinks === undefined) {
      delete fields.issuelinks;
    } else {
      fields.issuelinks = issueLinks;
    }

    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () =>
          Promise.resolve({
            issues: [{ ...jiraIssue(1), fields }],
          }),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it.each([
    ["null-Link", null],
    ["Link ohne type", { inwardIssue: blockingIssueLink().inwardIssue }],
    ["Link ohne Zielvorgang", { type: blockingIssueLink().type }],
    [
      "Link mit Zielvorgang ohne id",
      {
        type: blockingIssueLink().type,
        inwardIssue: {
          key: "DEMO-99",
          fields: blockingIssueLink().inwardIssue.fields,
        },
      },
    ],
    [
      "Link mit Zielvorgang ohne key",
      {
        type: blockingIssueLink().type,
        inwardIssue: {
          id: "20001",
          fields: blockingIssueLink().inwardIssue.fields,
        },
      },
    ],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "bricht bei malformed %s vollständig ab",
    async (_case, malformedLink) => {
      const sourceIssue = {
        ...jiraIssue(1),
        fields: {
          ...jiraIssue(1).fields,
          issuelinks: [malformedLink],
        },
      };

      await expect(
        collectIssueSearchPages(
          {
            jql: "project = DEMO",
            projectKey: "DEMO",
            acceptanceCriteriaFieldId: "customfield_10042",
          },
          () => Promise.resolve({ issues: [sourceIssue] }),
        ),
      ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
    },
  );

  it("verwirft bei gemischten gültigen und malformed Links das gesamte Ergebnis", async () => {
    const sourceIssue = {
      ...jiraIssue(1),
      fields: {
        ...jiraIssue(1).fields,
        issuelinks: [blockingIssueLink(), null],
      },
    };

    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () => Promise.resolve({ issues: [sourceIssue] }),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("behält gültige Blocking- und Non-Blocking-Link-Semantik unverändert", async () => {
    const sourceIssue = {
      ...jiraIssue(1),
      fields: {
        ...jiraIssue(1).fields,
        issuelinks: [blockingIssueLink(), nonBlockingIssueLink()],
      },
    };

    const issues = await collectIssueSearchPages(
      {
        jql: "project = DEMO",
        projectKey: "DEMO",
        acceptanceCriteriaFieldId: "customfield_10042",
      },
      () => Promise.resolve({ issues: [sourceIssue] }),
    );

    expect(issues[0]?.linkedIssues).toEqual([
      {
        id: "20001",
        key: "DEMO-99",
        relationship: "is blocked by",
        direction: "inward",
        isBlocking: true,
        status: { id: "11", name: "Offen" },
        resolution: null,
      },
      {
        id: "20002",
        key: "DEMO-100",
        relationship: "relates to",
        direction: "outward",
        isBlocking: false,
        status: { id: "31", name: "Fertig" },
        resolution: { id: "1", name: "Erledigt" },
      },
    ]);
  });

  it("führt Token-Seiten vollständig und mit unverändertem JQL zusammen", async () => {
    const requests: Array<{ jql: string; nextPageToken?: string }> = [];
    const issues = await collectIssueSearchPages(
      {
        jql: "project = DEMO AND key in (DEMO-1, DEMO-2)",
        projectKey: "DEMO",
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
          projectKey: "DEMO",
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
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () => Promise.resolve(pageData),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("behält eine numerische Issue-Typ-ID unverändert", async () => {
    const issues = await collectIssueSearchPages(
      {
        jql: "project = DEMO",
        projectKey: "DEMO",
        acceptanceCriteriaFieldId: "customfield_10042",
      },
      () => Promise.resolve({ issues: [jiraIssue(1)] }),
    );

    expect(issues[0]?.issueType).toEqual({ id: "10001", name: "Story" });
  });

  it.each(malformedIssueCases)(
    "bricht bei %s vollständig ab",
    async (_case, malformedIssue) => {
      await expect(
        collectIssueSearchPages(
          {
            jql: "project = DEMO",
            projectKey: "DEMO",
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
          projectKey: "DEMO",
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
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () => Promise.resolve({ issues: [] }),
      ),
    ).resolves.toEqual([]);
  });

  it("bindet jeden Suchtreffer an den erwarteten Projektschlüssel", async () => {
    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () =>
          Promise.resolve({ issues: [{ ...jiraIssue(1), key: "OTHER-1" }] }),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("verwirft eine gemischte Seite vollständig bei projektfremdem Treffer", async () => {
    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () =>
          Promise.resolve({
            issues: [jiraIssue(1), { ...jiraIssue(2), key: "OTHER-2" }],
          }),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("weist eine nichtnumerische Hauptstatus-ID fail-closed zurück", async () => {
    const source = jiraIssue(1);
    source.fields.status = { id: "done", name: "Fertig" };
    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () => Promise.resolve({ issues: [source] }),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("weist nichtnumerische Status-IDs in Subtasks und Links fail-closed zurück", async () => {
    const subtaskIssue = {
      ...jiraIssue(1),
      fields: {
        ...jiraIssue(1).fields,
        subtasks: [
          {
            id: "2",
            key: "DEMO-2",
            fields: {
              status: { id: "done", name: "Fertig" },
              resolution: null,
            },
          },
        ],
      },
    };
    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () => Promise.resolve({ issues: [subtaskIssue] }),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });

    const link = blockingIssueLink();
    link.inwardIssue.fields.status = { id: "done", name: "Offen" };
    const linkedIssue = {
      ...jiraIssue(1),
      fields: {
        ...jiraIssue(1).fields,
        issuelinks: [link],
      },
    };
    await expect(
      collectIssueSearchPages(
        {
          jql: "project = DEMO",
          projectKey: "DEMO",
          acceptanceCriteriaFieldId: "customfield_10042",
        },
        () => Promise.resolve({ issues: [linkedIssue] }),
      ),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });
});
