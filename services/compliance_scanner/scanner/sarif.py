from __future__ import annotations

from pathlib import Path
from typing import Any

from .findings import Finding, FindingStatus


def findings_to_sarif(findings: list[Finding], *, repo_root: str | Path = ".") -> dict[str, Any]:
    """
    Minimal SARIF 2.1.0 generator suitable for GitHub code scanning upload.
    """
    root = str(Path(repo_root).resolve())

    rules = []
    rule_index: dict[str, int] = {}
    for f in findings:
        if f.control_id in rule_index:
            continue
        rule_index[f.control_id] = len(rules)
        rules.append(
            {
                "id": f.control_id,
                "name": f.control_title or f.control_id,
                "shortDescription": {"text": f.control_title or f.control_id},
                "fullDescription": {"text": f.summary or f.gap_description or f.control_title or f.control_id},
            }
        )

    results = []
    for f in findings:
        level = "note"
        if f.status == FindingStatus.non_compliant:
            level = "error"
        elif f.status == FindingStatus.unknown:
            level = "warning"

        locations = []
        if f.evidence_snippets:
            e = f.evidence_snippets[0]
            path = e.get("path") or ""
            sl = e.get("start_line")
            el = e.get("end_line") or sl
            if path:
                loc = {
                    "physicalLocation": {
                        "artifactLocation": {"uri": path},
                        "region": {"startLine": int(sl or 1), "endLine": int(el or sl or 1)},
                    }
                }
                locations.append(loc)

        results.append(
            {
                "ruleId": f.control_id,
                "level": level,
                "message": {"text": f.gap_description or f.summary or f.control_title or f.control_id},
                "locations": locations,
            }
        )

    return {
        "version": "2.1.0",
        "$schema": "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "compliance-scanner",
                        "informationUri": "https://example.invalid/compliance-scanner",
                        "rules": rules,
                    }
                },
                "originalUriBaseIds": {"REPO_ROOT": {"uri": root}},
                "results": results,
            }
        ],
    }

