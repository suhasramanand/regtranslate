"""Export history for created Jira tickets and GitHub issues (per RegTranslate user)."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from app.request_user import get_rt_user
from app.user_paths import user_export_history_dir

MAX_ENTRIES = 500


def _history_file():
    return user_export_history_dir(get_rt_user()) / "exports.json"


def _load() -> list[dict]:
    path = _history_file()
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text())
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _save(entries: list[dict]) -> None:
    _history_file().write_text(json.dumps(entries, indent=2))


def append_jira(project_key: str, keys: list[str], task_count: int, url: str | None = None) -> None:
    """Record a Jira export."""
    entries = _load()
    base = (url or "").rstrip("/") or "https://your-domain.atlassian.net"
    entries.insert(
        0,
        {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "target": "jira",
            "project_key": project_key,
            "keys": keys,
            "task_count": task_count,
            "jira_url": base,
        },
    )
    _save(entries[-MAX_ENTRIES:])


def append_github(repo: str, urls: list[str], task_count: int) -> None:
    """Record a GitHub export."""
    entries = _load()
    entries.insert(
        0,
        {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "target": "github",
            "repo": repo,
            "urls": urls,
            "task_count": task_count,
        },
    )
    _save(entries[-MAX_ENTRIES:])


def list_entries(limit: int = 100) -> list[dict]:
    """List export history, most recent first."""
    entries = _load()
    return entries[:limit]
