import { describe, expect, it } from "vitest";
import { collectIssueSearchPages } from "../../src/infrastructure/jira/forge-jira-gateway";

function issueWithAcceptanceCriteria(value: unknown) {
  return {
    id: "1",
    key: "DEMO-1",
    fields: {
      summary: "Vorgang 1",
      issuetype: { id: "10001", name: "Story" },
      status: { id: "31", name: "Fertig" },
      customfield_10042: value,
      labels: [],
      fixVersions: [],
      subtasks: [],
      issuelinks: [],
      resolution: null,
      updated: "2026-08-10T12:00:00.000Z",
    },
  };
}

async function mapAcceptanceCriteria(value: unknown) {
  const issues = await collectIssueSearchPages(
    {
      jql: "project = DEMO",
      acceptanceCriteriaFieldId: "customfield_10042",
    },
    () => Promise.resolve({ issues: [issueWithAcceptanceCriteria(value)] }),
  );
  return issues[0]?.hasAcceptanceCriteria;
}

async function mapDescriptionAcceptanceCriteria(value: unknown) {
  const baseIssue = issueWithAcceptanceCriteria(null);
  const issues = await collectIssueSearchPages(
    {
      jql: "project = DEMO",
      acceptanceCriteriaFieldId: "description",
    },
    () =>
      Promise.resolve({
        issues: [
          {
            ...baseIssue,
            fields: { ...baseIssue.fields, description: value },
          },
        ],
      }),
  );
  return issues[0]?.hasAcceptanceCriteria;
}

describe("Akzeptanzkriterien-Evidence", () => {
  it.each([
    ["direktem String", "Kriterium"],
    ["ADF ohne version", { type: "doc", content: [] }],
    [
      "ADF mit nicht-arrayförmigem content",
      { type: "doc", version: 1, content: {} },
    ],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "weist description mit %s fail-closed zurück",
    async (_case, value) => {
      await expect(
        mapDescriptionAcceptanceCriteria(value),
      ).rejects.toMatchObject({
        code: "JIRA_UNAVAILABLE",
      });
    },
  );

  it("akzeptiert sichtbaren Text in einer gültigen ADF-description", async () => {
    await expect(
      mapDescriptionAcceptanceCriteria({
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Kriterium" }],
          },
        ],
      }),
    ).resolves.toBe(true);
  });

  it.each([
    ["null", null],
    ["leerem ADF", { type: "doc", version: 1, content: [] }],
  ] satisfies ReadonlyArray<readonly [string, unknown]>)(
    "wertet description mit %s als nicht vorhandenen Nachweis",
    async (_case, value) => {
      await expect(mapDescriptionAcceptanceCriteria(value)).resolves.toBe(
        false,
      );
    },
  );

  it.each([
    ["direkter Zero-Width-String", "\u200B"],
    [
      "ADF mit nur Zero-Width-Text",
      {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "\u200B" }],
          },
        ],
      },
    ],
  ])("wertet %s nicht als vorhandenen Nachweis", async (_case, value) => {
    await expect(mapAcceptanceCriteria(value)).resolves.toBe(false);
  });

  it.each([
    ["sichtbarer String", "Kriterium\u200B"],
    [
      "ADF mit sichtbarem Text und Formatierungszeichen",
      {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Kriterium\u200B" }],
          },
        ],
      },
    ],
  ])("behält %s als vorhandenen Nachweis", async (_case, value) => {
    await expect(mapAcceptanceCriteria(value)).resolves.toBe(true);
  });
});
