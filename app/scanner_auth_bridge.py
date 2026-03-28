"""Read Compliance Scanner session cookie (auth.sqlite) to identify the signed-in GitHub user."""

from __future__ import annotations

import os
import sqlite3
import time
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from starlette.requests import Request

SESSION_COOKIE_NAME = "scanner_sid"


def _auth_db_path() -> Path:
    override = os.getenv("COMPLIANCE_SCANNER_AUTH_DB", "").strip()
    if override:
        p = Path(override)
        p.parent.mkdir(parents=True, exist_ok=True)
        return p
    scan_history = Path(__file__).resolve().parents[1].parent / "scan_history"
    return scan_history / "auth.sqlite"


def github_login_from_session_id(session_id: str | None) -> str | None:
    sid = (session_id or "").strip()
    if not sid:
        return None
    db = _auth_db_path()
    if not db.exists():
        return None
    now = time.time()
    conn = sqlite3.connect(str(db))
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            "SELECT github_login, expires_at FROM auth_sessions WHERE id = ?",
            (sid,),
        ).fetchone()
        if not row:
            return None
        if float(row["expires_at"]) < now:
            conn.execute("DELETE FROM auth_sessions WHERE id = ?", (sid,))
            conn.commit()
            return None
        login = (row["github_login"] or "").strip()
        return login or None
    finally:
        conn.close()


def github_login_from_request(request: Request) -> str | None:
    sid = request.cookies.get(SESSION_COOKIE_NAME)
    return github_login_from_session_id(sid)


def github_login_from_cookie_dict(cookies: dict[str, str]) -> str | None:
    return github_login_from_session_id(cookies.get(SESSION_COOKIE_NAME))
