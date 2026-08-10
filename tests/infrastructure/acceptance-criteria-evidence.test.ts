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

describe("Akzeptanzkriterien-Evidence", () => {
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
