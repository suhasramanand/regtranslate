"""SQLite-backed scanner auth sessions (GitHub token at rest, encrypted)."""

from __future__ import annotations

import os
import secrets
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

from itsdangerous import BadSignature, URLSafeSerializer

from .config import get_oauth_config

SESSION_COOKIE_NAME = "scanner_sid"
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30  # 30 days

_LOCK = threading.Lock()
_conn: sqlite3.Connection | None = None


def _encryption_key() -> str:
    return (
        os.getenv("COMPLIANCE_SCANNER_SESSION_SECRET", "").strip()
        or os.getenv("GITHUB_OAUTH_CLIENT_SECRET", "").strip()
        or "dev-only-change-COMPLIANCE_SCANNER_SESSION_SECRET"
    )


def _enc_serializer() -> URLSafeSerializer:
    return URLSafeSerializer(_encryption_key(), salt="compliance-scanner-auth-db")


def _db_path() -> Path:
    override = os.getenv("COMPLIANCE_SCANNER_AUTH_DB", "").strip()
    if override:
        p = Path(override)
        p.parent.mkdir(parents=True, exist_ok=True)
        return p
    cfg = get_oauth_config()
    return cfg.data_dir / "auth.sqlite"


def _connect() -> sqlite3.Connection:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS auth_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          token_cipher TEXT NOT NULL,
          github_login TEXT NOT NULL,
          avatar_url TEXT,
          source TEXT NOT NULL,
          created_at TEXT NOT NULL,
          expires_at REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);
        """
    )
    conn.commit()


def _get_conn() -> sqlite3.Connection:
    global _conn
    with _LOCK:
        if _conn is None:
            _conn = _connect()
            _init_schema(_conn)
        return _conn


def reset_connection_for_tests() -> None:
    """Close DB handle so the next call uses a new path (tests only)."""
    global _conn
    with _LOCK:
        if _conn is not None:
            try:
                _conn.close()
            except Exception:
                pass
            _conn = None


def _encrypt_token(token: str) -> str:
    return _enc_serializer().dumps({"t": token})


def _decrypt_token(blob: str) -> str:
    data: dict[str, Any] = _enc_serializer().loads(blob)
    t = data.get("t")
    return str(t).strip() if t else ""


def _now() -> float:
    return time.time()


def insert_session(
    *,
    github_token: str,
    github_login: str,
    avatar_url: str | None,
    source: str,
) -> str:
    sid = secrets.token_urlsafe(32)
    expires = _now() + SESSION_MAX_AGE_SECONDS
    cipher = _encrypt_token(github_token.strip())
    created = str(int(_now()))
    conn = _get_conn()
    with _LOCK:
        conn.execute(
            "INSERT INTO auth_sessions (id, token_cipher, github_login, avatar_url, source, created_at, expires_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (sid, cipher, github_login, avatar_url or "", source, created, expires),
        )
        conn.commit()
    return sid


def delete_session(session_id: str | None) -> None:
    if not session_id or not session_id.strip():
        return
    conn = _get_conn()
    with _LOCK:
        conn.execute("DELETE FROM auth_sessions WHERE id = ?", (session_id.strip(),))
        conn.commit()


def get_token_for_session(session_id: str | None) -> str | None:
    if not session_id or not session_id.strip():
        return None
    conn = _get_conn()
    with _LOCK:
        row = conn.execute(
            "SELECT token_cipher, expires_at FROM auth_sessions WHERE id = ?",
            (session_id.strip(),),
        ).fetchone()
        if not row:
            return None
        if float(row["expires_at"]) < _now():
            conn.execute("DELETE FROM auth_sessions WHERE id = ?", (session_id.strip(),))
            conn.commit()
            return None
        try:
            return _decrypt_token(str(row["token_cipher"]))
        except (BadSignature, TypeError, KeyError):
            conn.execute("DELETE FROM auth_sessions WHERE id = ?", (session_id.strip(),))
            conn.commit()
            return None


def get_session_row(session_id: str | None) -> dict[str, Any] | None:
    if not session_id or not session_id.strip():
        return None
    conn = _get_conn()
    with _LOCK:
        row = conn.execute(
            "SELECT github_login, avatar_url, expires_at, source FROM auth_sessions WHERE id = ?",
            (session_id.strip(),),
        ).fetchone()
        if not row:
            return None
        if float(row["expires_at"]) < _now():
            conn.execute("DELETE FROM auth_sessions WHERE id = ?", (session_id.strip(),))
            conn.commit()
            return None
        avatar = (row["avatar_url"] or "").strip()
        return {
            "github_login": row["github_login"],
            "avatar_url": avatar or None,
            "source": row["source"],
        }


def prune_expired_sessions() -> int:
    conn = _get_conn()
    with _LOCK:
        cur = conn.execute("DELETE FROM auth_sessions WHERE expires_at < ?", (_now(),))
        conn.commit()
        return cur.rowcount or 0
