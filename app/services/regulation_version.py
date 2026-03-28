"""Regulation version tracking and auto-update detection."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from app.request_user import get_rt_user
from app.user_paths import user_regulation_versions_dir

MAX_ENTRIES = 500


def _versions_file() -> Path:
    return user_regulation_versions_dir(get_rt_user()) / "versions.json"


@dataclass
class RegulationVersion:
    """Version record for a processed regulatory document."""

    doc_id: str
    regulation_name: str
    source_filename: str
    content_hash: str
    processed_at: str
    version_label: str = ""
    chunk_count: int = 0


def _load() -> list[dict]:
    vf = _versions_file()
    if not vf.exists():
        return []
    try:
        data = json.loads(vf.read_text())
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _save(entries: list[dict]) -> None:
    _versions_file().write_text(json.dumps(entries, indent=2))


def _content_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()[:32]


def record_version(
    doc_id: str,
    regulation_name: str,
    source_filename: str,
    content: bytes,
    chunk_count: int = 0,
    version_label: str = "",
) -> RegulationVersion:
    """Record a processed document version."""
    entries = _load()
    content_hash = _content_hash(content)
    rec = RegulationVersion(
        doc_id=doc_id,
        regulation_name=regulation_name,
        source_filename=source_filename,
        content_hash=content_hash,
        processed_at=datetime.now(timezone.utc).isoformat(),
        version_label=version_label or content_hash[:8],
        chunk_count=chunk_count,
    )
    entries.insert(0, asdict(rec))
    _save(entries[-MAX_ENTRIES:])
    return rec


def list_versions(regulation_name: str | None = None, limit: int = 100) -> list[RegulationVersion]:
    """List version records, optionally filtered by regulation."""
    entries = _load()
    out: list[RegulationVersion] = []
    for e in entries[:limit]:
        if regulation_name and e.get("regulation_name") != regulation_name:
            continue
        out.append(
            RegulationVersion(
                doc_id=e.get("doc_id", ""),
                regulation_name=e.get("regulation_name", ""),
                source_filename=e.get("source_filename", ""),
                content_hash=e.get("content_hash", ""),
                processed_at=e.get("processed_at", ""),
                version_label=e.get("version_label", ""),
                chunk_count=e.get("chunk_count", 0),
            )
        )
    return out


def get_version(doc_id: str) -> RegulationVersion | None:
    """Get version record for a doc_id."""
    entries = _load()
    for e in entries:
        if e.get("doc_id") == doc_id:
            return RegulationVersion(
                doc_id=e.get("doc_id", ""),
                regulation_name=e.get("regulation_name", ""),
                source_filename=e.get("source_filename", ""),
                content_hash=e.get("content_hash", ""),
                processed_at=e.get("processed_at", ""),
                version_label=e.get("version_label", ""),
                chunk_count=e.get("chunk_count", 0),
            )
    return None


def check_update_needed(doc_id: str, new_content: bytes) -> dict:
    """
    Check if re-processing is needed (content changed).
    Returns {needs_update: bool, current_hash: str, new_hash: str}.
    """
    rec = get_version(doc_id)
    new_hash = _content_hash(new_content)
    if rec is None:
        return {"needs_update": True, "current_hash": None, "new_hash": new_hash}
    return {
        "needs_update": rec.content_hash != new_hash,
        "current_hash": rec.content_hash,
        "new_hash": new_hash,
    }


def _base_filename(name: str) -> str:
    """Strip version suffixes (-v2, _v2, .v2, etc.) for comparison."""
    p = Path(name)
    stem = p.stem
    stem = re.sub(r"[-_]v\d+$", "", stem, flags=re.IGNORECASE)
    stem = re.sub(r"\.v\d+$", "", stem, flags=re.IGNORECASE)
    return f"{stem}{p.suffix}"


def check_content_changed(
    regulation_name: str,
    source_filename: str,
    content: bytes,
) -> dict:
    """
    Check if this file's content differs from the last processed version
    with the same regulation. Matches by exact filename first, then by base
    name (e.g. sample-v2.pdf matches sample.pdf).
    Returns {content_changed: bool, previous_processed_at: str | None}.
    """
    entries = _load()
    new_hash = _content_hash(content)
    new_base = _base_filename(source_filename)
    for e in entries:
        if e.get("regulation_name") != regulation_name:
            continue
        prev_name = e.get("source_filename", "")
        if prev_name == source_filename:
            prev_hash = e.get("content_hash", "")
            return {
                "content_changed": prev_hash != new_hash,
                "previous_processed_at": e.get("processed_at"),
            }
        if _base_filename(prev_name) == new_base:
            prev_hash = e.get("content_hash", "")
            return {
                "content_changed": prev_hash != new_hash,
                "previous_processed_at": e.get("processed_at"),
            }
    return {"content_changed": False, "previous_processed_at": None}
