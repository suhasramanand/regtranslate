"""Tests for compliance scanner SQLite session store."""

from __future__ import annotations

from pathlib import Path

import pytest

from services.compliance_scanner.scanner import session_store as ss


@pytest.fixture
def auth_db_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    db = tmp_path / "auth.sqlite"
    monkeypatch.setenv("COMPLIANCE_SCANNER_AUTH_DB", str(db))
    ss.reset_connection_for_tests()
    return db


def test_insert_get_delete_roundtrip(auth_db_path: Path) -> None:
    sid = ss.insert_session(
        github_token="ghp_test_secret",
        github_login="octocat",
        avatar_url="https://example.com/a.png",
        source="pat",
    )
    assert sid

    tok = ss.get_token_for_session(sid)
    assert tok == "ghp_test_secret"

    row = ss.get_session_row(sid)
    assert row is not None
    assert row["github_login"] == "octocat"
    assert row["source"] == "pat"

    ss.delete_session(sid)
    assert ss.get_token_for_session(sid) is None
    assert ss.get_session_row(sid) is None


def test_unknown_session_returns_none(auth_db_path: Path) -> None:
    assert ss.get_token_for_session("not-a-real-id") is None
