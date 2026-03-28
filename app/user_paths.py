"""Per-user directories for isolated PDF workflow data."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1].parent


def _user_slug(login: str) -> str:
    return hashlib.sha256(login.encode("utf-8")).hexdigest()[:32]


def user_data_root(login: str) -> Path:
    """
    Root directory for a user's RegTranslate data (Chroma, exports, versions, audit, calibration).

    __local__ → repo root (backward compatible with single-tenant tests / REGTRANSLATE_REQUIRE_AUTH=0).
    __demo__  → repo_root/demo_user_data (shared demo bucket).
    Others    → REGTRANSLATE_USER_DATA_ROOT/<hash>/
    """
    login = login.strip()
    if login == "__local__":
        return _REPO_ROOT
    if login == "__demo__":
        p = _REPO_ROOT / "demo_user_data"
        p.mkdir(parents=True, exist_ok=True)
        return p
    base = Path(os.getenv("REGTRANSLATE_USER_DATA_ROOT", "./user_data")).expanduser()
    if not base.is_absolute():
        base = _REPO_ROOT / base
    p = base / _user_slug(login)
    p.mkdir(parents=True, exist_ok=True)
    return p


def user_chroma_dir(login: str) -> Path:
    d = user_data_root(login) / "chroma_db"
    d.mkdir(parents=True, exist_ok=True)
    return d


def user_export_history_dir(login: str) -> Path:
    d = user_data_root(login) / "export_history"
    d.mkdir(parents=True, exist_ok=True)
    return d


def user_regulation_versions_dir(login: str) -> Path:
    d = user_data_root(login) / "regulation_versions"
    d.mkdir(parents=True, exist_ok=True)
    return d


def user_calibration_dir(login: str) -> Path:
    d = user_data_root(login) / "calibration"
    d.mkdir(parents=True, exist_ok=True)
    return d


def user_audit_log_dir(login: str) -> Path:
    d = user_data_root(login) / "audit_logs"
    d.mkdir(parents=True, exist_ok=True)
    return d
