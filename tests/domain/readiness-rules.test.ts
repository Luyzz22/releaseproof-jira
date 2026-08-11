import { describe, expect, it } from "vitest";
import {
  acceptanceCriteriaPresentRule,
  acceptedStatusRule,
  approvalMarkerPresentRule,
  correctFixVersionRule,
  noBlockerLabelRule,
  noBlockingLinksRule,
  noOpenSubtasksRule,
} from "../../src/domain/rules";
import { config, issue, projectConfig, release } from "../fixtures/release";

function context(overrides: Parameters<typeof issue>[0] = {}) {
  const candidate = release([issue(overrides)]);
  return {
    issue: candidate.issues[0]!,
    release: candidate,
    config: projectConfig,
  };
}

describe("acceptance-criteria-present", () => {
  it.each([
    [
      true,
      "READY",
      "Das konfigurierte Feld enthält Akzeptanzkriterien.",
      "Keine Maßnahme erforderlich.",
    ],
    [
      false,
      "INCOMPLETE",
      "Im konfigurierten Feld wurden keine verwertbaren Akzeptanzkriterien gefunden.",
      "Konkrete und prüfbare Akzeptanzkriterien im konfigurierten Jira-Feld ergänzen.",
    ],
  ] as const)(
    "bewertet hasAcceptanceCriteria=%s als %s mit unveränderter Evidence",
    (hasAcceptanceCriteria, status, explanation, remediation) => {
      expect(
        acceptanceCriteriaPresentRule.evaluate(
          context({ hasAcceptanceCriteria }),
        ),
      ).toMatchObject({
        ruleId: "acceptance-criteria-present",
        category: "DOCUMENTATION",
        status,
        title: "Akzeptanzkriterien vorhanden",
        explanation,
        remediation,
        sourceField: projectConfig.acceptanceCriteriaFieldId,
      });
    },
  );
});

describe("accepted-status", () => {
  it("behandelt fehlenden oder nicht akzeptierten Status defensiv", () => {
    expect(acceptedStatusRule.evaluate(context({ status: null })).status).toBe(
      "INCOMPLETE",
    );
    expect(
      acceptedStatusRule.evaluate(
        context({ status: { id: "3", name: "In Arbeit" } }),
      ).status,
    ).toBe("INCOMPLETE");
  });

  it("erkennt konfigurierte Abschlussstatus", () => {
    expect(acceptedStatusRule.evaluate(context()).status).toBe("READY");
  });
});

describe("no-open-subtasks", () => {
  it("blockiert bei offenen Unteraufgaben", () => {
    const result = noOpenSubtasksRule.evaluate(
      context({
        subtasks: [
          {
            id: "21001",
            key: "DEMO-43",
            status: { id: "3", name: "In Arbeit" },
            resolution: null,
          },
        ],
      }),
    );
    expect(result.status).toBe("BLOCKED");
    expect(result.explanation).toContain("DEMO-43");
  });

  it("ist bei deaktivierter Prüfung nicht anwendbar", () => {
    const candidate = context();
    expect(
      noOpenSubtasksRule.evaluate({
        ...candidate,
        config: { ...projectConfig, blockOnOpenSubtasks: false },
      }).status,
    ).toBe("NOT_APPLICABLE");
  });
});

describe("no-blocking-links", () => {
  it("blockiert bei ungelöster eingehender Blocker-Verknüpfung", () => {
    const result = noBlockingLinksRule.evaluate(
      context({
        linkedIssues: [
          {
            id: "22001",
            key: "DEMO-7",
            relationship: "is blocked by",
            direction: "inward",
            isBlocking: true,
            status: { id: "3", name: "In Arbeit" },
            resolution: null,
          },
        ],
      }),
    );
    expect(result.status).toBe("BLOCKED");
    expect(result.remediation).toContain("Blocker");
  });

  it("ignoriert gelöste Blocker-Verknüpfungen", () => {
    const result = noBlockingLinksRule.evaluate(
      context({
        linkedIssues: [
          {
            id: "22001",
            key: "DEMO-7",
            relationship: "is blocked by",
            direction: "inward",
            isBlocking: true,
            status: { id: "31", name: "Fertig" },
            resolution: { id: "1", name: "Erledigt" },
          },
        ],
      }),
    );
    expect(result.status).toBe("READY");
  });
});

describe("correct-fix-version", () => {
  it("weist die Versionsprüfung in VERSION_ONLY ehrlich als nicht anwendbar aus", () => {
    const candidate = context({ fixVersions: [] });
    const result = correctFixVersionRule.evaluate({
      ...candidate,
      config: config({ releaseScopeMode: "VERSION_ONLY" }),
    });
    expect(result.status).toBe("NOT_APPLICABLE");
    expect(result.explanation).toContain("vorgefiltert");
    expect(result.explanation).toContain("Nur Jira-Version");
    expect(result.explanation).not.toContain("VERSION_ONLY");
    expect(result.remediation).toContain("Expliziter JQL-Umfang");
    expect(result.remediation).not.toContain("JQL_SCOPE");
  });

  it("akzeptiert im JQL_SCOPE exakt die analysierte Versions-ID", () => {
    expect(correctFixVersionRule.evaluate(context()).status).toBe("READY");
  });

  it("unterscheidet im JQL_SCOPE fehlende und falsche Versionen", () => {
    const missing = correctFixVersionRule.evaluate(
      context({ fixVersions: [] }),
    );
    const wrong = correctFixVersionRule.evaluate(
      context({
        fixVersions: [{ id: "39999", name: "Anderes Release" }],
      }),
    );
    expect(missing.status).toBe("INCOMPLETE");
    expect(missing.explanation).toContain("keine Jira-Version");
    expect(wrong.status).toBe("INCOMPLETE");
    expect(wrong.explanation).toContain("Anderes Release");
  });
});

describe("no-blocker-label", () => {
  it("vergleicht Blocker-Labels ohne Beachtung der Großschreibung", () => {
    expect(
      noBlockerLabelRule.evaluate(context({ labels: ["Release-Blocker"] }))
        .status,
    ).toBe("BLOCKED");
  });

  it("akzeptiert nicht blockierende Labels", () => {
    expect(noBlockerLabelRule.evaluate(context()).status).toBe("READY");
  });
});

describe("approval-marker-present", () => {
  it("meldet das konfigurierte Freigabe-Label als fehlend", () => {
    expect(
      approvalMarkerPresentRule.evaluate(context({ labels: [] })).status,
    ).toBe("INCOMPLETE");
  });

  it("ist als optionale deaktivierte Regel nicht anwendbar", () => {
    const candidate = context({ labels: [] });
    expect(
      approvalMarkerPresentRule.evaluate({
        ...candidate,
        config: { ...projectConfig, requireApprovalMarker: false },
      }).status,
    ).toBe("NOT_APPLICABLE");
  });
});
