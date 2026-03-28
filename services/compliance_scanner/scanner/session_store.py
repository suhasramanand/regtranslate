"""Shim — implementation: ``services.github_oauth.session_store`` (shared DB with OAuth service)."""

from services.github_oauth.session_store import (
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE_SECONDS,
    delete_session,
    get_session_row,
    get_token_for_session,
    insert_session,
    prune_expired_sessions,
    reset_connection_for_tests,
)

__all__ = [
    "SESSION_COOKIE_NAME",
    "SESSION_MAX_AGE_SECONDS",
    "delete_session",
    "get_session_row",
    "get_token_for_session",
    "insert_session",
    "prune_expired_sessions",
    "reset_connection_for_tests",
]
