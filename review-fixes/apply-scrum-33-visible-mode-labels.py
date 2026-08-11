from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    content = target.read_text(encoding="utf-8")
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one match, found {count}")
    target.write_text(content.replace(old, new, 1), encoding="utf-8")


replace_once(
    "src/domain/rules/correct-fix-version.ts",
    '"Die Versionszuordnung wurde bereits durch den Modus VERSION_ONLY vorgefiltert und kann deshalb nicht unabhängig geprüft werden."',
    '"Die Versionszuordnung wurde bereits durch den Modus „Nur Jira-Version“ vorgefiltert und kann deshalb nicht unabhängig geprüft werden."',
)
replace_once(
    "src/domain/rules/correct-fix-version.ts",
    '"JQL_SCOPE aktivieren, wenn fehlende oder falsche Versionszuordnungen sichtbar werden sollen."',
    '"Den Modus „Expliziter JQL-Umfang“ aktivieren, wenn fehlende oder falsche Versionszuordnungen sichtbar werden sollen."',
)
replace_once(
    "tests/domain/readiness-rules.test.ts",
    '''    expect(result.status).toBe("NOT_APPLICABLE");
    expect(result.explanation).toContain("vorgefiltert");''',
    '''    expect(result.status).toBe("NOT_APPLICABLE");
    expect(result.explanation).toContain("vorgefiltert");
    expect(result.explanation).toContain("Nur Jira-Version");
    expect(result.explanation).not.toContain("VERSION_ONLY");
    expect(result.remediation).toContain("Expliziter JQL-Umfang");
    expect(result.remediation).not.toContain("JQL_SCOPE");''',
)

Path(__file__).unlink()
print("SCRUM-33 visible mode labels applied successfully.")
