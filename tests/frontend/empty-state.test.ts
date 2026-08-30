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
  canConfigure: true,
  configRecoveryRequired: true,
} satisfies BootstrapData & { configRecoveryRequired: boolean };

describe("Recovery Empty State", () => {
  it("zeigt Nicht-Administratoren keinen Konfigurations-Save-Pfad", () => {
    const markup = renderToStaticMarkup(
      createElement(EmptyState, {
        data: {
          ...recoveryData,
          canConfigure: false,
          configRecoveryRequired: false,
        },
        onConfigure: () => undefined,
      }),
    );

    expect(markup).toContain("Projektadministration erforderlich");
    expect(markup).toContain("Jira-Projektadministrator");
    expect(markup).not.toContain("Projekt jetzt konfigurieren");
  });

  it("verwendet im Erstzustand ausschließlich deutsche Bereitschaftsterminologie", () => {
    const markup = renderToStaticMarkup(
      createElement(EmptyState, {
        data: { ...recoveryData, configRecoveryRequired: false },
        onConfigure: () => undefined,
      }),
    );

    expect(markup).toContain("Bereitschaftskonfiguration");
    expect(markup).not.toContain("Readiness-Konfiguration");
  });

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
