import { describe, expect, it } from "vitest";
import { collectIssueSearchPages } from "../../src/infrastructure/jira/forge-jira-gateway";

const input = {
  jql: "project = DEMO",
  acceptanceCriteriaFieldId: "customfield_10042",
};

function baseIssue() {
  return {
    id: "1",
    key: "DEMO-1",
    fields: {
      summary: "Vorgang 1",
      issuetype: { id: "10001", name: "Story" },
      status: { id: "31", name: "Fertig" },
      customfield_10042: null,
      labels: [],
      fixVersions: [],
      subtasks: [],
      issuelinks: [],
      resolution: null,
      updated: "2026-08-10T12:00:00.000Z",
    },
  };
}

function openSubtask() {
  return {
    id: "30001",
    key: "DEMO-2",
    fields: {
      status: { id: "11", name: "Offen" },
      resolution: null,
    },
  };
}

function doneSubtask() {
  return {
    id: "30002",
    key: "DEMO-3",
    fields: {
      status: { id: "31", name: "Fertig" },
      resolution: { id: "1", name: "Erledigt" },
    },
  };
}

function inwardBlockingLink() {
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

function outwardNonBlockingLink() {
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

async function mapFields(fields: Record<string, unknown>) {
  return collectIssueSearchPages(input, () =>
    Promise.resolve({
      issues: [{ ...baseIssue(), fields }],
    }),
  );
}

describe("fail-closed Jira-Evidence", () => {
  it.each([
    ["fehlenden Labels", undefined],
    ["Labels als null", null],
    ["Labels als String", "release-blocker"],
    ["Labels als Objekt", {}],
  ])("bricht bei %s ab", async (_case, labels) => {
    const fields: Record<string, unknown> = { ...baseIssue().fields };
    if (labels === undefined) delete fields.labels;
    else fields.labels = labels;

    await expect(mapFields(fields)).rejects.toMatchObject({
      code: "JIRA_UNAVAILABLE",
    });
  });

  it.each([
    ["null", null],
    ["Zahl", 42],
    ["Objekt", { value: "release-blocker" }],
    ["leerer String", ""],
    ["Whitespace-only String", "   "],
  ])("bricht bei ungültigem Label-Element %s ab", async (_case, label) => {
    await expect(
      mapFields({ ...baseIssue().fields, labels: ["client-approved", label] }),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("behält gültige Labels vollständig bei", async () => {
    const issues = await mapFields({
      ...baseIssue().fields,
      labels: ["release-blocker", "client-approved"],
    });

    expect(issues[0]?.labels).toEqual(["release-blocker", "client-approved"]);
  });

  it.each([
    ["fehlenden Subtasks", undefined],
    ["Subtasks als null", null],
    ["Subtasks als String", "invalid"],
    ["Subtasks als Objekt", {}],
  ])("bricht bei %s ab", async (_case, subtasks) => {
    const fields: Record<string, unknown> = { ...baseIssue().fields };
    if (subtasks === undefined) delete fields.subtasks;
    else fields.subtasks = subtasks;

    await expect(mapFields(fields)).rejects.toMatchObject({
      code: "JIRA_UNAVAILABLE",
    });
  });

  it.each([
    ["null-Element", null],
    ["Subtask ohne fields", { id: "30001", key: "DEMO-2" }],
    [
      "Subtask ohne id",
      {
        key: "DEMO-2",
        fields: openSubtask().fields,
      },
    ],
    [
      "Subtask ohne key",
      {
        id: "30001",
        fields: openSubtask().fields,
      },
    ],
    [
      "Subtask ohne gültigen Status",
      {
        id: "30001",
        key: "DEMO-2",
        fields: { status: null, resolution: null },
      },
    ],
    [
      "Subtask mit malformed Resolution",
      {
        id: "30001",
        key: "DEMO-2",
        fields: {
          status: { id: "31", name: "Fertig" },
          resolution: { id: "1" },
        },
      },
    ],
    [
      "Subtask mit Whitespace-only Resolution-ID",
      {
        id: "30001",
        key: "DEMO-2",
        fields: {
          status: { id: "31", name: "Fertig" },
          resolution: { id: "   ", name: "Erledigt" },
        },
      },
    ],
    [
      "Subtask mit nichtnumerischer Resolution-ID",
      {
        id: "30001",
        key: "DEMO-2",
        fields: {
          status: { id: "31", name: "Fertig" },
          resolution: { id: "keine-jira-id", name: "Erledigt" },
        },
      },
    ],
    [
      "Subtask mit Whitespace-only Resolution-Name",
      {
        id: "30001",
        key: "DEMO-2",
        fields: {
          status: { id: "31", name: "Fertig" },
          resolution: { id: "1", name: "   " },
        },
      },
    ],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "bricht bei malformed %s ab",
    async (_case, subtask) => {
      await expect(
        mapFields({ ...baseIssue().fields, subtasks: [subtask] }),
      ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
    },
  );

  it("verwirft bei gemischten gültigen und malformed Subtasks das gesamte Ergebnis", async () => {
    await expect(
      mapFields({
        ...baseIssue().fields,
        subtasks: [openSubtask(), null],
      }),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("behält gültige offene und erledigte Subtasks vollständig bei", async () => {
    const issues = await mapFields({
      ...baseIssue().fields,
      subtasks: [openSubtask(), doneSubtask()],
    });

    expect(issues[0]?.subtasks).toEqual([
      {
        id: "30001",
        key: "DEMO-2",
        status: { id: "11", name: "Offen" },
        resolution: null,
      },
      {
        id: "30002",
        key: "DEMO-3",
        status: { id: "31", name: "Fertig" },
        resolution: { id: "1", name: "Erledigt" },
      },
    ]);
  });

  it.each([
    [
      "vollständig fehlenden Relationship-Metadaten",
      {
        type: {},
        inwardIssue: inwardBlockingLink().inwardIssue,
      },
    ],
    [
      "nur einem Type-Namen ohne inward-Beschreibung",
      {
        type: { name: "Blocks" },
        inwardIssue: inwardBlockingLink().inwardIssue,
      },
    ],
    [
      "nur einem Type-Namen ohne outward-Beschreibung",
      {
        type: { name: "Relates" },
        outwardIssue: outwardNonBlockingLink().outwardIssue,
      },
    ],
    [
      "Whitespace-only Relationship-Beschreibung",
      {
        type: { name: "Blocks", inward: "   ", outward: "blocks" },
        inwardIssue: inwardBlockingLink().inwardIssue,
      },
    ],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "bricht bei Link mit %s ab",
    async (_case, link) => {
      await expect(
        mapFields({ ...baseIssue().fields, issuelinks: [link] }),
      ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
    },
  );

  it.each([
    ["Whitespace-only Resolution-ID", "   ", "Erledigt"],
    ["nichtnumerischer Resolution-ID", "keine-jira-id", "Erledigt"],
    ["Whitespace-only Resolution-Name", "1", "   "],
  ])("bricht bei Link mit %s ab", async (_case, id, name) => {
    const link = inwardBlockingLink();
    await expect(
      mapFields({
        ...baseIssue().fields,
        issuelinks: [
          {
            ...link,
            inwardIssue: {
              ...link.inwardIssue,
              fields: {
                ...link.inwardIssue.fields,
                resolution: { id, name },
              },
            },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("bricht bei gleichzeitigem inward- und outward-Ziel ab", async () => {
    const inward = inwardBlockingLink();
    const outward = outwardNonBlockingLink();
    await expect(
      mapFields({
        ...baseIssue().fields,
        issuelinks: [
          {
            type: inward.type,
            inwardIssue: inward.inwardIssue,
            outwardIssue: outward.outwardIssue,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "JIRA_UNAVAILABLE" });
  });

  it("behält gültige inward- und outward-Beziehungssemantik unverändert", async () => {
    const issues = await mapFields({
      ...baseIssue().fields,
      issuelinks: [inwardBlockingLink(), outwardNonBlockingLink()],
    });

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
});
