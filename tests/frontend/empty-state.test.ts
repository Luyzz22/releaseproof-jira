import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyState } from "../../src/frontend/pages/empty-state";
import type { BootstrapData } from "../../src/shared/resolver-contract";

const recoveryData = {
  siteUrl: "https://demo.atlassian.net",
  project: { id: "10000", key: "DEMO", name: "Demoagentur" },
  statuses: [{ id: "31", name: "Fertig" }],
  issueTypes: [{ id: "10001", name: "Story", subtask: false }],
  fields: [
    {
      id: "customfield_10042",
      name: "Akzeptanzkriterien",
      custom: true,
      schemaType: "string",
    },
  ],
  versions: [
    {
      id: "30001",
      name: "Kundenrelease 2.4",
      projectId: "10000",
      released: false,
      archived: false,
    },
  ],
  config: null,
  configRecoveryRequired: true,
} satisfies BootstrapData & { configRecoveryRequired: boolean };

describe("Recovery Empty State", () => {
  it("erklärt die beschädigte Konfiguration und bietet die Neukonfiguration an", () => {
    const markup = renderToStaticMarkup(
      createElement(EmptyState, {
        data: recoveryData,
        onConfigure: () => undefined,
      }),
    );

    expect(markup).toContain(
      "Die gespeicherte Projektkonfiguration ist beschädigt oder nicht mehr kompatibel.",
    );
    expect(markup).toContain("Projektkonfiguration öffnen");
  });
});
