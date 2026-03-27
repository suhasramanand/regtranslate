from __future__ import annotations

import json
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

from pydantic import TypeAdapter

from .config import get_config
from .models import ScanRun, ScanStatus

_LOCK = threading.Lock()


def _runs_path() -> Path:
    cfg = get_config()
    override = os.getenv("COMPLIANCE_SCANNER_RUNS_PATH", "").strip()
    if override:
        p = Path(override)
        p.parent.mkdir(parents=True, exist_ok=True)
        return p
    return cfg.data_dir / "runs.json"


def _load_all() -> list[ScanRun]:
    path = _runs_path()
    if not path.exists():
        return []
    data = json.loads(path.read_text() or "[]")
    return TypeAdapter(list[ScanRun]).validate_python(data)


def _save_all(runs: list[ScanRun]) -> None:
    path = _runs_path()
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps([r.model_dump(mode="json") for r in runs], indent=2, sort_keys=False))
    tmp.replace(path)


def list_runs(limit: int = 100) -> list[ScanRun]:
    with _LOCK:
        runs = _load_all()
        runs.sort(key=lambda r: r.created_at, reverse=True)
        return runs[: max(1, limit)]


def get_run(run_id: str) -> ScanRun | None:
    with _LOCK:
        for r in _load_all():
            if r.id == run_id:
                return r
    return None


def upsert_run(run: ScanRun) -> None:
    with _LOCK:
        runs = _load_all()
        for i, r in enumerate(runs):
            if r.id == run.id:
                runs[i] = run
                break
        else:
            runs.append(run)
        _save_all(runs)


def update_run(run_id: str, patch: dict[str, Any]) -> ScanRun:
    with _LOCK:
        runs = _load_all()
        for i, r in enumerate(runs):
            if r.id == run_id:
                updated = r.model_copy(update=patch)
                runs[i] = updated
                _save_all(runs)
                return updated
    raise KeyError(f"Unknown run_id: {run_id}")


def mark_started(run_id: str) -> ScanRun:
    return update_run(run_id, {"status": ScanStatus.running, "started_at": datetime.utcnow()})


def mark_finished(run_id: str, status: ScanStatus) -> ScanRun:
    if status not in (ScanStatus.completed, ScanStatus.failed, ScanStatus.cancelled):
        raise ValueError("finish status must be completed|failed|cancelled")
    return update_run(run_id, {"status": status, "finished_at": datetime.utcnow()})

