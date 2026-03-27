"""Smoke tests for compliance scanner CLI and CI lexical scan."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / "services" / "compliance_scanner" / "cli.py"
CATALOG = ROOT / "controls" / "catalog.yaml"


def test_scan_ci_exits_zero_lexical():
    out_json = ROOT / "tests" / "_tmp_compliance_findings.json"
    out_sarif = ROOT / "tests" / "_tmp_compliance.sarif.json"
    try:
        proc = subprocess.run(
            [
                sys.executable,
                str(CLI),
                "scan-ci",
                "--repo",
                str(ROOT),
                "--controls",
                str(CATALOG),
                "--out",
                str(out_json),
                "--sarif",
                str(out_sarif),
                "--fail-on",
                "none",
            ],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=120,
        )
        assert proc.returncode == 0, proc.stderr or proc.stdout
        data = json.loads(out_json.read_text())
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "control_id" in data[0]
        assert "status" in data[0]
        sarif = json.loads(out_sarif.read_text())
        assert sarif.get("version") == "2.1.0"
        assert "runs" in sarif and len(sarif["runs"]) == 1
        assert "results" in sarif["runs"][0]
    finally:
        for p in (out_json, out_sarif):
            if p.exists():
                p.unlink()


def test_scan_ci_module_imports():
    from services.compliance_scanner.scanner.ci_scanner import scan_repo_lexical
    from services.compliance_scanner.scanner.sarif import findings_to_sarif

    findings = scan_repo_lexical(repo_root=ROOT, controls_path=CATALOG, max_files=50)
    sarif = findings_to_sarif(findings, repo_root=ROOT)
    assert sarif["version"] == "2.1.0"
