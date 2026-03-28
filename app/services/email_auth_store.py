"""Email + password accounts and cookie sessions for RegTranslate (SQLite)."""

from __future__ import annotations

import os
import secrets
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import bcrypt

RT_SESSION_COOKIE = "rt_sid"
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

_LOCK = threading.Lock()
_conn: sqlite3.Connection | None = None


def _db_path() -> Path:
    override = os.getenv("REGTRANSLATE_ACCOUNTS_DB", "").strip()
    if override:
        p = Path(override)
        p.parent.mkdir(parents=True, exist_ok=True)
        return p
    root = Path(__file__).resolve().parents[2] / "user_accounts"
    root.mkdir(parents=True, exist_ok=True)
    return root / "accounts.sqlite"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(_db_path()), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _get_conn() -> sqlite3.Connection:
    global _conn
    with _LOCK:
        if _conn is None:
            _conn = _connect()
            _init_schema(_conn)
        return _conn


def _init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash BLOB NOT NULL,
          failed_attempts INTEGER NOT NULL DEFAULT 0,
          last_failure_at TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
        """
    )
    conn.commit()


def reset_connection_for_tests() -> None:
    global _conn
    with _LOCK:
        if _conn is not None:
            try:
                _conn.close()
            except Exception:
                pass
            _conn = None


def _now() -> float:
    return time.time()


def _hash_password(plain: str) -> bytes:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12))


def _verify_password(plain: str, pw_hash: bytes) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), pw_hash)
    except Exception:
        return False


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def tenant_id_for_user(user_id: str) -> str:
    """Stable id for user_paths / Chroma isolation (distinct from GitHub login strings)."""
    return f"email:{user_id}"


def create_user(email: str, password: str) -> dict[str, Any]:
    """Insert user; raises ValueError if email exists."""
    from app.services.password_policy import validate_password

    ok, errs = validate_password(password)
    if not ok:
        raise ValueError("; ".join(errs))
    em = normalize_email(email)
    if not em or "@" not in em:
        raise ValueError("Valid email is required")
    uid = str(uuid.uuid4())
    pw_h = _hash_password(password)
    created = datetime.now(timezone.utc).isoformat()
    conn = _get_conn()
    with _LOCK:
        try:
            conn.execute(
                "INSERT INTO users (id, email, password_hash, failed_attempts, last_failure_at, created_at) "
                "VALUES (?, ?, ?, 0, NULL, ?)",
                (uid, em, pw_h, created),
            )
            conn.commit()
        except sqlite3.IntegrityError as e:
            raise ValueError("An account with this email already exists") from e
    return {"id": uid, "email": em}


def get_user_by_email(email: str) -> dict[str, Any] | None:
    em = normalize_email(email)
    conn = _get_conn()
    row = conn.execute("SELECT id, email, password_hash, failed_attempts, last_failure_at FROM users WHERE email = ?", (em,)).fetchone()
    if not row:
        return None
    return dict(row)


def _clear_failed(user_id: str) -> None:
    conn = _get_conn()
    with _LOCK:
        conn.execute(
            "UPDATE users SET failed_attempts = 0, last_failure_at = NULL WHERE id = ?",
            (user_id,),
        )
        conn.commit()


def _record_failure(user_id: str) -> None:
    conn = _get_conn()
    now_iso = datetime.now(timezone.utc).isoformat()
    with _LOCK:
        conn.execute(
            "UPDATE users SET failed_attempts = failed_attempts + 1, last_failure_at = ? WHERE id = ?",
            (now_iso, user_id),
        )
        conn.commit()


def verify_login(email: str, password: str) -> dict[str, Any]:
    """Verify credentials; returns user id and email. Raises ValueError on failure."""
    row = get_user_by_email(email)
    if not row:
        raise ValueError("Invalid email or password")
    from app.services.password_policy import PasswordPolicyConfig, is_locked_out

    fa = int(row.get("failed_attempts") or 0)
    last_raw = row.get("last_failure_at")
    last_dt = datetime.fromisoformat(last_raw.replace("Z", "+00:00")) if last_raw else None
    if is_locked_out(fa, last_dt, PasswordPolicyConfig()):
        raise ValueError("Account temporarily locked after failed sign-in attempts. Try again later.")

    if not _verify_password(password, row["password_hash"]):
        _record_failure(row["id"])
        raise ValueError("Invalid email or password")

    _clear_failed(row["id"])
    return {"id": row["id"], "email": row["email"]}


def create_session(user_id: str) -> str:
    sid = secrets.token_urlsafe(32)
    exp = _now() + SESSION_MAX_AGE_SECONDS
    conn = _get_conn()
    with _LOCK:
        conn.execute(
            "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
            (sid, user_id, exp),
        )
        conn.commit()
    return sid


def delete_session(session_id: str | None) -> None:
    sid = (session_id or "").strip()
    if not sid:
        return
    conn = _get_conn()
    with _LOCK:
        conn.execute("DELETE FROM sessions WHERE id = ?", (sid,))
        conn.commit()


def get_session_user(session_id: str | None) -> dict[str, Any] | None:
    sid = (session_id or "").strip()
    if not sid:
        return None
    now = _now()
    conn = _get_conn()
    with _LOCK:
        row = conn.execute(
            "SELECT s.user_id, s.expires_at, u.email FROM sessions s "
            "JOIN users u ON u.id = s.user_id WHERE s.id = ?",
            (sid,),
        ).fetchone()
        if not row:
            return None
        if float(row["expires_at"]) < now:
            conn.execute("DELETE FROM sessions WHERE id = ?", (sid,))
            conn.commit()
            return None
    return {"user_id": row["user_id"], "email": row["email"]}


def prune_expired_sessions() -> None:
    now = _now()
    conn = _get_conn()
    with _LOCK:
        conn.execute("DELETE FROM sessions WHERE expires_at < ?", (now,))
        conn.commit()
