"""Email/password auth routes and cookie session for protected API (REGTRANSLATE_REQUIRE_AUTH=1)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

_STRONG_PW = "MyStr0ng!Password"


@pytest.fixture
def strict_auth_client(tmp_path, monkeypatch):
    monkeypatch.setenv("REGTRANSLATE_REQUIRE_AUTH", "1")
    monkeypatch.setenv("REGTRANSLATE_ACCOUNTS_DB", str(tmp_path / "accounts.sqlite"))
    from app.services import email_auth_store

    email_auth_store.reset_connection_for_tests()

    from app.main import app

    with TestClient(app) as client:
        yield client

    email_auth_store.reset_connection_for_tests()


def test_register_login_cookie_access_protected(strict_auth_client: TestClient) -> None:
    r0 = strict_auth_client.get("/api/config/jira")
    assert r0.status_code == 401

    r_bad = strict_auth_client.post(
        "/api/auth/register",
        json={"email": "u@example.com", "password": "short"},
    )
    assert r_bad.status_code == 400

    r = strict_auth_client.post(
        "/api/auth/register",
        json={"email": "User@Example.com", "password": _STRONG_PW},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "user@example.com"
    assert data["user_id"].startswith("email:")

    dup = strict_auth_client.post(
        "/api/auth/register",
        json={"email": "user@example.com", "password": _STRONG_PW},
    )
    assert dup.status_code == 400

    r1 = strict_auth_client.get("/api/config/jira")
    assert r1.status_code == 200

    strict_auth_client.post("/api/auth/logout", json={})
    r2 = strict_auth_client.get("/api/config/jira")
    assert r2.status_code == 401

    bad_login = strict_auth_client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "WrongPass!12345"},
    )
    assert bad_login.status_code == 401

    ok_login = strict_auth_client.post(
        "/api/auth/login",
        json={"email": "User@Example.com", "password": _STRONG_PW},
    )
    assert ok_login.status_code == 200
    r3 = strict_auth_client.get("/api/config/jira")
    assert r3.status_code == 200


def test_auth_me_email_session(strict_auth_client: TestClient) -> None:
    strict_auth_client.post(
        "/api/auth/register",
        json={"email": "a@b.co", "password": _STRONG_PW},
    )
    me = strict_auth_client.get("/api/auth/me")
    assert me.status_code == 200
    body = me.json()
    assert body["authenticated"] is True
    assert body["method"] == "email"
    assert body["email"] == "a@b.co"
