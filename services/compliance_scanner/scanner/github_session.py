"""GitHub OAuth callback session: signed HttpOnly cookie for access token."""

from __future__ import annotations

import os
import secrets
from typing import Any
from urllib.parse import urlencode

from fastapi import Request, Response
from github.GithubException import GithubException
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from pydantic import BaseModel

COOKIE_NAME = "scanner_github_token"
PENDING_COOKIE = "gh_oauth_pending"
STATE_MAX_AGE = 600
TOKEN_MAX_AGE = 60 * 60 * 24 * 30  # 30 days


def _ssl_ca_bundle() -> str | None:
    """CA file for TLS to GitHub. macOS python.org builds often lack system certs; certifi fixes SSL verify."""
    try:
        import certifi
    except ImportError:
        return None
    return certifi.where()


def _github_client(token: str):
    from github import Github

    ca = _ssl_ca_bundle()
    if ca:
        return Github(token, verify=ca)
    return Github(token)


def _secret() -> str:
    return (
        os.getenv("COMPLIANCE_SCANNER_SESSION_SECRET", "").strip()
        or os.getenv("GITHUB_OAUTH_CLIENT_SECRET", "").strip()
        or "dev-only-change-COMPLIANCE_SCANNER_SESSION_SECRET"
    )


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(_secret(), salt="compliance-scanner-github")


def oauth_client_config() -> tuple[str | None, str | None, str]:
    client_id = os.getenv("GITHUB_OAUTH_CLIENT_ID", "").strip() or None
    client_secret = os.getenv("GITHUB_OAUTH_CLIENT_SECRET", "").strip() or None
    redirect = (
        os.getenv("GITHUB_OAUTH_REDIRECT_URI", "").strip()
        or "http://127.0.0.1:9010/auth/github/callback"
    )
    return client_id, client_secret, redirect


def is_oauth_configured() -> bool:
    cid, csec, _ = oauth_client_config()
    return bool(cid and csec)


def build_authorize_url(*, state: str, redirect_uri: str) -> str:
    client_id, _, _ = oauth_client_config()
    if not client_id:
        raise ValueError("GitHub OAuth is not configured")
    q = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": "repo read:org",
        }
    )
    return f"https://github.com/login/oauth/authorize?{q}"


def set_pending_oauth(response: Response, *, state: str, next_url: str) -> None:
    payload = _serializer().dumps({"state": state, "next": next_url})
    response.set_cookie(
        PENDING_COOKIE,
        payload,
        httponly=True,
        samesite="lax",
        max_age=STATE_MAX_AGE,
        path="/",
    )


def read_pending_oauth(request: Request) -> dict[str, Any] | None:
    raw = request.cookies.get(PENDING_COOKIE)
    if not raw:
        return None
    try:
        return _serializer().loads(raw, max_age=STATE_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None


def clear_pending_oauth(response: Response) -> None:
    response.delete_cookie(PENDING_COOKIE, path="/")


def new_oauth_state() -> str:
    return secrets.token_urlsafe(24)


def set_github_token_cookie(response: Response, access_token: str) -> None:
    val = _serializer().dumps({"t": access_token})
    response.set_cookie(
        COOKIE_NAME,
        val,
        httponly=True,
        samesite="lax",
        max_age=TOKEN_MAX_AGE,
        path="/",
    )


def get_github_token_from_cookie(request: Request) -> str | None:
    raw = request.cookies.get(COOKIE_NAME)
    if not raw:
        return None
    try:
        data = _serializer().loads(raw, max_age=TOKEN_MAX_AGE)
        t = data.get("t")
        return str(t).strip() if t else None
    except (BadSignature, SignatureExpired):
        return None


def clear_github_token_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def exchange_code_for_token(code: str) -> str:
    import json
    import ssl
    import urllib.error
    import urllib.parse
    import urllib.request

    client_id, client_secret, redirect_uri = oauth_client_config()
    if not client_id or not client_secret:
        raise ValueError("GitHub OAuth client not configured")

    body = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
        }
    ).encode()

    req = urllib.request.Request(
        "https://github.com/login/oauth/access_token",
        data=body,
        headers={"Accept": "application/json"},
        method="POST",
    )
    ca = _ssl_ca_bundle()
    context = ssl.create_default_context(cafile=ca) if ca else None
    try:
        open_kw = {"timeout": 30}
        if context is not None:
            open_kw["context"] = context
        with urllib.request.urlopen(req, **open_kw) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise ValueError(f"GitHub OAuth token exchange failed: {e}") from e
    except urllib.error.URLError as e:
        raise ValueError(
            "GitHub OAuth could not reach GitHub over HTTPS. "
            "If you are on macOS with python.org Python, install certificates "
            "(Install Certificates.command) or ensure `certifi` is installed."
        ) from e

    token = data.get("access_token")
    if not token:
        err = data.get("error_description") or data.get("error") or data
        raise ValueError(f"GitHub OAuth: no access_token: {err}")
    return str(token)


class GitHubUserBrief(BaseModel):
    login: str
    avatar_url: str | None = None


def github_user_login(token: str) -> GitHubUserBrief:
    g = _github_client(token)
    u = g.get_user()
    return GitHubUserBrief(login=u.login, avatar_url=getattr(u, "avatar_url", None))


def list_user_orgs(token: str) -> list[str]:
    g = _github_client(token)
    return sorted({o.login for o in g.get_user().get_orgs()})


def list_authenticated_user_repos_brief(token: str, *, limit: int = 200) -> tuple[str, list[dict[str, Any]]]:
    """Repos owned by the authenticated user (includes private). Returns (login, brief rows)."""
    g = _github_client(token)
    me = g.get_user()
    login = me.login
    out: list[dict[str, Any]] = []
    for r in me.get_repos():
        out.append(
            {
                "full_name": r.full_name,
                "default_branch": r.default_branch or "main",
                "private": r.private,
                "description": (r.description or "")[:200],
            }
        )
        if len(out) >= limit:
            break
    out.sort(key=lambda x: x["full_name"].lower())
    return login, out


def list_org_repos_brief(token: str, org: str, *, limit: int = 200) -> list[dict[str, Any]]:
    """List repos for a GitHub org, or for a user login (public repos), or all repos for the authenticated user when org matches their login."""
    g = _github_client(token)
    org = org.strip()
    me = g.get_user()
    if me.login.lower() == org.lower():
        repo_iter = me.get_repos()
    else:
        try:
            repo_iter = g.get_organization(org).get_repos()
        except GithubException:
            repo_iter = g.get_user(org).get_repos()
    out: list[dict[str, Any]] = []
    for r in repo_iter:
        out.append(
            {
                "full_name": r.full_name,
                "default_branch": r.default_branch or "main",
                "private": r.private,
                "description": (r.description or "")[:200],
            }
        )
        if len(out) >= limit:
            break
    out.sort(key=lambda x: x["full_name"].lower())
    return out
