import { describe, expect, it } from "vitest";
import { toReleaseReadinessDto } from "../../src/application/analyze-release/to-release-readiness-dto";
import { analyzeRelease } from "../../src/domain/services/analyze-release";
import { config, issue, projectConfig, release } from "../fixtures/release";

const forbiddenDtoKeys = new Set([
  "id",
  "projectId",
  "versionId",
  "analyzedAt",
  "description",
  "acceptanceCriteria",
  "hasAcceptanceCriteria",
  "labels",
  "fixVersions",
  "subtasks",
  "linkedIssues",
  "resolution",
  "issueType",
]);

function expectNoInternalKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(expectNoInternalKeys);
    return;
  }
  if (typeof value !== "object" || value === null) return;

  for (const [key, child] of Object.entries(value)) {
    expect(forbiddenDtoKeys.has(key), `unerlaubter DTO-Schlüssel: ${key}`).toBe(
      false,
    );
    expectNoInternalKeys(child);
  }
}

function internalResult() {
  return analyzeRelease(
    release([
      issue({
        summary: "PUBLIC_SUMMARY_SENTINEL",
        labels: ["internal-label"],
        fixVersions: [{ id: "30001", name: "Kundenrelease 2.4" }],
        subtasks: [
          {
            id: "21001",
            key: "DEMO-43",
            status: { id: "31", name: "Fertig" },
            resolution: { id: "1", name: "Erledigt" },
          },
        ],
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
        resolution: { id: "1", name: "Erledigt" },
        hasAcceptanceCriteria: true,
      }),
    ]),
    projectConfig,
    "2026-08-06T09:00:00.000Z",
  );
}

describe("Release-Readiness-DTO-Mapper", () => {
  it("gibt ausschließlich explizite Release-, Issue- und Evidence-Felder frei", () => {
    const dto = toReleaseReadinessDto(internalResult());

    expect(Object.keys(dto.release).sort()).toEqual(
      [
        "issues",
        "projectKey",
        "releaseScopeJql",
        "releaseScopeMode",
        "versionName",
      ].sort(),
    );
    expect(Object.keys(dto.release.issues[0] ?? {}).sort()).toEqual(
      ["issueTypeName", "key", "statusName", "summary", "updatedAt"].sort(),
    );
    expect(dto.release.issues[0]?.summary).toBe("PUBLIC_SUMMARY_SENTINEL");
    expect(Object.keys(dto.results[0]?.evidence[0] ?? {}).sort()).toEqual(
      [
        "category",
        "explanation",
        "issueKey",
        "remediation",
        "ruleId",
        "sourceField",
        "status",
        "title",
      ].sort(),
    );
    expectNoInternalKeys(dto);
  });

  it("lässt releaseScopeJql bei VERSION_ONLY vollständig weg", () => {
    const candidate = release();
    const versionOnlyCandidate = {
      ...candidate,
      releaseScopeMode: "VERSION_ONLY" as const,
    };
    delete versionOnlyCandidate.releaseScopeJql;

    const dto = toReleaseReadinessDto(
      analyzeRelease(
        versionOnlyCandidate,
        config({ releaseScopeMode: "VERSION_ONLY" }),
        "2026-08-06T09:00:00.000Z",
      ),
    );

    expect("releaseScopeJql" in dto.release).toBe(false);
  });

  it("gibt keine internen Objekt- oder Array-Referenzen weiter", () => {
    const internal = internalResult();
    const dto = toReleaseReadinessDto(internal);
    const snapshot = structuredClone(dto);
    const internalIssue = internal.release.issues[0]!;
    const internalEvidence = internal.results[0]!.evidence[0]!;

    internalIssue.summary = "INTERNAL_MUTATION";
    internalIssue.issueType.name = "Geänderter Typ";
    if (internalIssue.status) internalIssue.status.name = "Geänderter Status";
    internalIssue.labels.push("later-label");
    internalEvidence.title = "INTERNAL_EVIDENCE_MUTATION";
    internal.results[0]!.evidence.push(structuredClone(internalEvidence));
    internal.release.issues.push(issue({ key: "DEMO-99" }));

    expect(dto).toEqual(snapshot);
  });
});
