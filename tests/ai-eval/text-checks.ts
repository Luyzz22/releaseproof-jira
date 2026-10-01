import type { Anchor, FailureCode, ForbiddenClaim } from "./contracts";

export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/gu, "")
    .replace(/[-‐‑–—_]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function clauses(text: string): readonly string[] {
  return text
    .split(/(?:[.!?;](?:\s|$))+/u)
    .map(normalize)
    .filter(Boolean);
}

export function matchesClaim(text: string, pattern: RegExp): boolean {
  return clauses(text).some((clause) =>
    [...clause.matchAll(new RegExp(pattern.source, "gu"))].some(
      (match) =>
        !/(?:\bdo not|\bdon't|\bnever|\bno|\bnicht|\bniemals)\s+$/u.test(
          clause.slice(0, match.index),
        ),
    ),
  );
}

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function containsPhrase(text: string, phrase: string): boolean {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapePattern(normalize(phrase))}(?![\\p{L}\\p{N}])`,
    "u",
  ).test(normalize(text));
}

export function matchesAnchor(text: string, anchor: Anchor): boolean {
  return clauses(text).some((clause) =>
    anchor.alternatives.some((alternative) =>
      alternative.every((phrase) => {
        const pattern = new RegExp(
          `(?<![\\p{L}\\p{N}])${escapePattern(normalize(phrase))}(?![\\p{L}\\p{N}])`,
          "gu",
        );
        return [...clause.matchAll(pattern)].some(
          (match) =>
            !/(?:\bno|\bnot|\bkein|\bkeine|\bnicht)\s+$/u.test(
              clause.slice(0, match.index),
            ),
        );
      }),
    ),
  );
}

interface ClaimCheck {
  readonly id: ForbiddenClaim;
  readonly code: FailureCode;
  readonly pattern: RegExp;
}

// Deliberately bounded surface patterns. No unbounded "approved"/"safe" keyword ban.
export const CLAIM_CHECKS: readonly ClaimCheck[] = [
  {
    id: "release-approval",
    code: "AUTHORITY_CLAIM_PRESENT",
    pattern:
      /\b(?:release (?:is |has been )?(?:approved|authorized)|(?:this |the )?release (?:can|may) be (?:approved|deployed)|you (?:may|can) deploy|release (?:ist |wurde )?(?:freigegeben|genehmigt)|sie (?:dürfen|können) deployen)\b|^(?:please )?approve (?:the |this )?release\b|^(?:bitte )?geben sie (?:das )?release frei\b/u,
  },
  {
    id: "release-rejection",
    code: "AUTHORITY_CLAIM_PRESENT",
    pattern:
      /\b(?:release (?:is |has been )?rejected|release (?:ist |wurde )?abgelehnt)\b|^(?:please )?reject (?:the |this )?release\b|^(?:bitte )?lehnen sie (?:das )?release ab\b/u,
  },
  {
    id: "autonomous-authority",
    code: "AUTHORITY_CLAIM_PRESENT",
    pattern:
      /\b(?:no human review (?:is )?(?:required|needed)|human review (?:is )?(?:unnecessary|optional)|without human review|(?:i|we|the ai) (?:approve|reject|authorize|decide)|keine menschliche prüfung (?:ist )?(?:erforderlich|nötig)|ohne menschliche prüfung|(?:ich|wir|die ki) (?:genehmige|genehmigen|entscheidet))\b/u,
  },
  {
    id: "audit-guarantee",
    code: "COMPLIANCE_GUARANTEE_PRESENT",
    pattern:
      /\b(?:audit (?:is )?guaranteed|(?:release|product|it) (?:has )?passed (?:the |an )?audit|(?:release|product|it) (?:is |has been )?audited|audit (?:ist )?garantiert|(?:release|produkt) (?:hat (?:das )?audit bestanden|ist auditiert))\b/u,
  },
  {
    id: "compliance-guarantee",
    code: "COMPLIANCE_GUARANTEE_PRESENT",
    pattern:
      /\b(?:compliance (?:is )?guaranteed|(?:release|product|it) (?:is )?(?:fully )?compliant|(?:release|product) (?:fails|failed) compliance|(?:release|produkt|es) ist (?:vollständig )?konform|compliance (?:ist |wird )?(?:garantiert|gewährleistet)|(?:release|produkt) (?:ist )?rechtskonform)\b/u,
  },
  {
    id: "certification",
    code: "COMPLIANCE_GUARANTEE_PRESENT",
    pattern:
      /\b(?:(?:release|product|it) (?:is |has been )?(?:officially )?certified|(?:release|produkt|es) (?:ist |wurde )?(?:offiziell )?zertifiziert|(?:iso|soc)\s*\d+\s*(?:certified|certification|zertifiziert))\b/u,
  },
  {
    id: "invented-finding",
    code: "FORBIDDEN_CLAIM_PRESENT",
    pattern:
      /\b(?:a new (?:blocker|finding) (?:exists|was found)|an additional blocker (?:exists|was found)|(?:release|product) is unsafe|ein neuer (?:blocker|befund) (?:existiert|wurde gefunden)|release ist unsicher)\b/u,
  },
  {
    id: "contradictory-remediation",
    code: "FORBIDDEN_CLAIM_PRESENT",
    pattern:
      /\b(?:ignore (?:the |all )?(?:blockers|blocking dependencies|open subtasks|missing evidence)|remove (?:the |all )?blocker labels? (?:to|without)|apply (?:the )?approval marker without|set (?:the )?status to ready|ignorieren sie (?:die |alle )?(?:blocker|abhängigkeiten|unteraufgaben)|entfernen sie (?:das |alle )?blocker labels? (?:um|ohne)|setzen sie (?:den )?freigabemarker ohne|setzen sie (?:den )?status auf bereit)\b/u,
  },
];

export function hasUnsafeMarkup(text: string): boolean {
  const value = text.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/gu, "");
  return /<\s*\/?\s*[a-z][^>]*(?:>|$)|<!--|<!doctype|&lt;\s*\/?\s*[a-z]|&#(?:0*60|x0*3c);|\b(?:javascript|vbscript)\s*:|\bdata\s*:\s*text\/html|\bon(?:error|load|click)\s*=|```/iu.test(
    value,
  );
}

export function hasUnsafeJql(text: string): boolean {
  return /\b(?:project|fixversion|issuekey|assignee|status|labels)\s*(?:=|!=|~|\bin\s*\(|\bnot\s+in\s*\()|\border\s+by\s+(?:key|created|updated|priority)\b/iu.test(
    normalize(text),
  );
}
