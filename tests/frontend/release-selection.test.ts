import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReleaseSelection } from "../../src/frontend/pages/release-selection";
import type { BootstrapData } from "../../src/shared/resolver-contract";
import { config } from "../fixtures/release";

const data: BootstrapData = {
  siteUrl: "https://demo.atlassian.net",
  project: { id: "10000", key: "DEMO", name: "Demoagentur" },
  statuses: [{ id: "31", name: "Fertig" }],
  issueTypes: [{ id: "10001", name: "Story", subtask: false }],
  fields: [],
  canConfigure: true,
  versions: [
    {
      id: "30001",
      name: "Kundenrelease 2.4",
      projectId: "10000",
      released: false,
      archived: false,
    },
  ],
  config: config(),
  configRecoveryRequired: false,
};

describe("Release-Auswahl", () => {
  it("kennzeichnet Konfiguration für Nicht-Administratoren als Ansicht", () => {
    const markup = renderToStaticMarkup(
      createElement(ReleaseSelection, {
        data: { ...data, canConfigure: false },
        analyzing: false,
        onAnalyze: () => Promise.resolve(),
        onConfigure: () => undefined,
      }),
    );

    expect(markup).toContain("Projektkonfiguration ansehen");
    expect(markup).not.toContain("Projektkonfiguration bearbeiten");
  });

  it("verwendet vollständig deutsche Analyseterminologie", () => {
    const markup = renderToStaticMarkup(
      createElement(ReleaseSelection, {
        data,
        analyzing: false,
        onAnalyze: () => Promise.resolve(),
        onConfigure: () => undefined,
      }),
    );

    expect(markup).toContain("Unteraufgaben");
    expect(markup).toContain("Umfang: Expliziter JQL-Umfang");
    expect(markup).toContain("Bereitschaft analysieren");
    expect(markup).not.toContain("Subtasks");
    expect(markup).not.toContain("Scope:");
    expect(markup).not.toContain("Readiness analysieren");
  });
});
