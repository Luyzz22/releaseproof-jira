import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { JiraField } from "../../src/application/ports";
import type { ProjectConfig } from "../../src/domain/models/readiness";
import {
  filterAvailableMetadataIds,
  ProjectConfiguration,
} from "../../src/frontend/pages/project-configuration";
import type { BootstrapData } from "../../src/shared/resolver-contract";
import { config } from "../fixtures/release";

const supportedDescriptionField: JiraField = {
  id: "description",
  name: "Beschreibung",
  custom: false,
  schemaType: null,
};

const supportedCustomStringField: JiraField = {
  id: "customfield_10042",
  name: "Akzeptanzkriterien",
  custom: true,
  schemaType: "string",
};

const unsupportedFieldCases: ReadonlyArray<readonly [string, JiraField]> = [
  [
    "number",
    {
      id: "customfield_20000",
      name: "Technischer Zahlenwert",
      custom: true,
      schemaType: "number",
    },
  ],
  [
    "date",
    {
      id: "customfield_20003",
      name: "Abnahmedatum",
      custom: true,
      schemaType: "date",
    },
  ],
  [
    "option",
    {
      id: "customfield_20001",
      name: "Freigabeauswahl",
      custom: true,
      schemaType: "option",
    },
  ],
  [
    "user",
    {
      id: "customfield_20002",
      name: "Fachverantwortlicher",
      custom: true,
      schemaType: "user",
    },
  ],
  [
    "array",
    {
      id: "customfield_20004",
      name: "Technische Liste",
      custom: true,
      schemaType: "array",
    },
  ],
];

function renderConfiguration(
  fields: JiraField[],
  existingConfig: ProjectConfig | null = null,
  canConfigure = true,
): string {
  const data: BootstrapData = {
    siteUrl: "https://demo.atlassian.net",
    project: { id: "10000", key: "DEMO", name: "Demoagentur" },
    statuses: [{ id: "31", name: "Fertig" }],
    issueTypes: [{ id: "10001", name: "Story", subtask: false }],
    fields,
    versions: [],
    canConfigure,
    config: existingConfig,
    configRecoveryRequired: false,
  };

  return renderToStaticMarkup(
    createElement(ProjectConfiguration, {
      data,
      saving: false,
      onSave: () => Promise.resolve(),
    }),
  );
}

describe("Projektkonfiguration – Metadaten-Recovery", () => {
  it("entfernt gelöschte Status-IDs und behält verfügbare Status bei", () => {
    expect(
      filterAvailableMetadataIds(["31", "999"], [{ id: "31" }, { id: "41" }]),
    ).toEqual(["31"]);
  });

  it("entfernt gelöschte Vorgangstyp-IDs und behält verfügbare Typen bei", () => {
    expect(
      filterAvailableMetadataIds(
        ["10001", "19999", "10003"],
        [{ id: "10001" }, { id: "10003" }],
      ),
    ).toEqual(["10001", "10003"]);
  });
});

describe("Projektkonfiguration – Berechtigungsgrenze", () => {
  it("rendert Nicht-Administratoren read-only und ohne Save-Pfad", () => {
    const markup = renderConfiguration(
      [supportedDescriptionField],
      config({ acceptanceCriteriaFieldId: "description" }),
      false,
    );

    expect(markup).toContain(
      "Nur Jira-Projektadministratoren können diese Konfiguration ändern.",
    );
    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain("Konfiguration speichern");
  });
});

describe("Projektkonfiguration – Akzeptanzkriterien-Felder", () => {
  it.each([
    ["description mit schemaType null", supportedDescriptionField],
    ["ein Custom Field mit schemaType string", supportedCustomStringField],
  ])("bietet %s an", (_case, field) => {
    const markup = renderConfiguration([field]);

    expect(markup).toContain(`value="${field.id}"`);
    expect(markup).toContain(`>${field.name}</option>`);
  });

  it.each(unsupportedFieldCases)(
    'bietet ein Custom Field mit schemaType "%s" nicht an',
    (_schemaType, field) => {
      const markup = renderConfiguration([supportedDescriptionField, field]);

      expect(markup).toContain(">Beschreibung</option>");
      expect(markup).not.toContain(`>${field.name}</option>`);
    },
  );

  it("setzt ein nicht unterstütztes gespeichertes Feld sicher zurück", () => {
    const numberField = unsupportedFieldCases[0]?.[1];
    if (!numberField) throw new Error("Test fixture is missing.");
    const markup = renderConfiguration(
      [supportedDescriptionField, numberField],
      config({ acceptanceCriteriaFieldId: numberField.id }),
    );

    expect(markup).toContain(
      'class="scope-notice scope-notice--warning" role="alert"',
    );
    expect(markup).toContain(
      "Das bisher konfigurierte Feld für Akzeptanzkriterien wird nicht unterstützt.",
    );
    expect(markup).toContain(
      "Bitte wählen Sie ein unterstütztes Textfeld aus und speichern Sie die Projektkonfiguration erneut.",
    );
    expect(markup).not.toContain(`value="${numberField.id}"`);
    expect(markup).toContain(
      '<select><option value="" selected="">Feld auswählen</option>',
    );
  });

  it("verwendet für die Konfiguration deutsche Benutzersprache", () => {
    const markup = renderConfiguration(
      [supportedDescriptionField],
      config({ acceptanceCriteriaFieldId: "description" }),
    );

    expect(markup).toContain("Bereitschaftskriterien");
    expect(markup).toContain("Arbeitsablauf und Umfang");
    expect(markup).toContain("Release-Umfang");
    expect(markup).toContain("Expliziter JQL-Umfang");
    expect(markup).toContain("Relevante Vorgangstypen");
    expect(markup).toContain("Ungelöste Unteraufgaben");
    expect(markup).not.toContain("Readiness-Kriterien");
    expect(markup).not.toContain("Workflow und Scope");
    expect(markup).not.toContain("Subtasks");
  });
});
