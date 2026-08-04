import { describe, expect, it } from "vitest";
import { jiraValueToText } from "../../src/infrastructure/jira/adf-to-text";

describe("Jira ADF und unbekannte Feldwerte", () => {
  it("extrahiert Text aus verschachteltem Atlassian Document Format", () => {
    expect(
      jiraValueToText({
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Erstes Kriterium" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Zweites Kriterium" }],
          },
        ],
      }),
    ).toBe("Erstes Kriterium Zweites Kriterium");
  });

  it("behandelt unbekannte, fehlende und unerwartete Jira-Werte sicher", () => {
    expect(jiraValueToText(undefined)).toBeNull();
    expect(jiraValueToText({ unknown: { nested: true } })).toBeNull();
    expect(jiraValueToText({ value: "Freigegeben" })).toBe("Freigegeben");
  });

  it("begrenzt ungewöhnlich große Rich-Text-Felder deterministisch", () => {
    const text = jiraValueToText({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x".repeat(60_000) }],
        },
      ],
    });
    expect(text).toHaveLength(50_000);
  });
});
