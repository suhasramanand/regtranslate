"""Per-request GitHub identity for multi-tenant data (PDF workflow, history, audit, etc.)."""

from __future__ import annotations

import os
from contextvars import ContextVar, Token
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from starlette.requests import Request

_rt_user: ContextVar[str | None] = ContextVar("rt_user", default=None)


def get_rt_user() -> str:
    u = _rt_user.get()
    if u:
        return u
    # Unit tests and scripts call services without HTTP middleware; align with open install.
    if not require_auth_enabled():
        return os.getenv("REGTRANSLATE_DEV_USER", "__local__").strip() or "__local__"
    raise RuntimeError("RegTranslate user context not set")


def set_rt_user(user: str) -> Token[str | None]:
    return _rt_user.set(user)


def reset_rt_user(token: Token[str | None]) -> None:
    _rt_user.reset(token)


def require_auth_enabled() -> bool:
    return os.getenv("REGTRANSLATE_REQUIRE_AUTH", "1").strip().lower() not in ("0", "false", "no")


def audit_subject_for_request(request: Request) -> str:
    """
    Human-readable actor for § 2.2.1 audit entries (reviewers).
    Prefer GitHub login or email profile; falls back to tenant id.
    """
    from app.scanner_auth_bridge import github_login_from_request
    from app.services import email_auth_store

    gh = github_login_from_request(request)
    if gh:
        return f"github:{gh}"
    sid = request.cookies.get(email_auth_store.RT_SESSION_COOKIE)
    row = email_auth_store.get_session_user(sid)
    if row:
        internal = str(row.get("user_id") or "")
        return email_auth_store.format_audit_subject({**row, "user_id": internal})
    try:
        return get_rt_user()
    except Exception:
        return "unknown"


def resolve_user_for_request(request: Request) -> str | None:
    """
    Returns GitHub login bucket id, or __local__ / __demo__ for open / demo installs.
    None = should return 401 (strict auth, no session).
    """
    if not require_auth_enabled():
        return os.getenv("REGTRANSLATE_DEV_USER", "__local__").strip() or "__local__"

    if (request.headers.get("x-regtranslate-demo") or "").strip() == "1":
        return "__demo__"

    from app.scanner_auth_bridge import github_login_from_request
    from app.services import email_auth_store

    login = github_login_from_request(request)
    if login:
        return login

    sid = request.cookies.get(email_auth_store.RT_SESSION_COOKIE)
    sess = email_auth_store.get_session_user(sid)
    if sess:
        return email_auth_store.tenant_id_for_user(sess["user_id"])
    return None
