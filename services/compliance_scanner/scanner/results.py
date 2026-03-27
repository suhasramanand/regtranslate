from __future__ import annotations

import json
import os
from pathlib import Path

from pydantic import TypeAdapter

from .config import get_config
from .findings import Finding


def _run_dir(run_id: str) -> Path:
    base = Path(os.getenv("COMPLIANCE_SCANNER_DATA_DIR", "") or get_config().data_dir)
    d = base / run_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def findings_path(run_id: str) -> Path:
    return _run_dir(run_id) / "findings.json"


def save_findings(run_id: str, findings: list[Finding]) -> None:
    p = findings_path(run_id)
    p.write_text(json.dumps([f.model_dump(mode="json") for f in findings], indent=2))


def load_findings(run_id: str) -> list[Finding]:
    p = findings_path(run_id)
    if not p.exists():
        return []
    data = json.loads(p.read_text() or "[]")
    return TypeAdapter(list[Finding]).validate_python(data)

