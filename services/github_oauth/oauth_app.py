"""FastAPI app: GitHub OAuth + PAT login + scanner_sid session (no scan APIs)."""

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from pydantic import BaseModel, Field

from services.github_oauth.github_session import (
    build_authorize_url,
    clear_github_token_cookie,
    clear_pending_oauth,
    exchange_code_for_token,
    get_github_token_from_cookie,
    github_user_login,
    is_oauth_configured,
    new_oauth_state,
    oauth_client_config,
    read_pending_oauth,
    set_pending_oauth,
)
from services.github_oauth.session_store import (
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE_SECONDS,
    delete_session,
    get_session_row,
    get_token_for_session,
    insert_session,
    prune_expired_sessions,
)


class GitHubPatLoginRequest(BaseModel):
    token: str = Field(..., min_length=1, description="GitHub personal access token")


def _session_id_from_request(request: Request) -> str | None:
    s = request.cookies.get(SESSION_COOKIE_NAME)
    return s.strip() if s and str(s).strip() else None


def _set_scanner_session_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(
        SESSION_COOKIE_NAME,
        session_id,
        httponly=True,
        samesite="lax",
        max_age=SESSION_MAX_AGE_SECONDS,
        path="/",
    )


def _clear_scanner_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")


def _allowed_oauth_next_origins() -> list[str]:
    out = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ]
    for env_key in ("GITHUB_OAUTH_CORS_ORIGINS", "COMPLIANCE_SCANNER_CORS_ORIGINS"):
        raw = os.getenv(env_key, "").strip()
        if raw:
            for o in raw.split(","):
                o = o.strip().rstrip("/")
                if o and o not in out:
                    out.append(o)
    return out


def sanitize_oauth_next_url(url: str) -> str:
    u = (url or "").split("#")[0].strip()
    if not u.startswith("http://") and not u.startswith("https://"):
        u = "http://127.0.0.1:5173/scanner"
    for origin in _allowed_oauth_next_origins():
        if u == origin or u.startswith(origin + "/"):
            return u
    return "http://127.0.0.1:5173/scanner"


def create_oauth_app() -> FastAPI:
    app = FastAPI(title="RegTranslate GitHub OAuth", version="0.1.0")

    raw_cors = os.getenv("GITHUB_OAUTH_CORS_ORIGINS", "").strip() or os.getenv("COMPLIANCE_SCANNER_CORS_ORIGINS", "").strip()
    if raw_cors:
        origins = [o.strip() for o in raw_cors.split(",") if o.strip()]
    else:
        origins = [
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:4173",
            "http://localhost:4173",
        ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/", response_class=HTMLResponse)
    def home():
        return """<!doctype html>
<html>
  <head><meta charset="utf-8"/><title>GitHub OAuth</title></head>
  <body style="font-family: ui-sans-serif, system-ui; max-width: 720px; margin: 32px auto; padding: 0 16px;">
    <h2>RegTranslate — GitHub OAuth service</h2>
    <p>Used by the web UI for browser GitHub sign-in and <code>scanner_sid</code> sessions.</p>
    <ul>
      <li><a href="/docs">OpenAPI</a></li>
      <li><a href="/auth/github/status">OAuth status</a></li>
    </ul>
  </body>
</html>"""

    @app.get("/health")
    def health():
        prune_expired_sessions()
        return {"ok": True, "service": "github-oauth"}

    @app.get("/auth/github/status")
    def auth_github_status():
        client_id, _, redirect_uri = oauth_client_config()
        return {
            "oauth_configured": is_oauth_configured(),
            "client_id": client_id,
            "redirect_uri": redirect_uri,
        }

    @app.get("/auth/github/login")
    def auth_github_login(request: Request, next: str | None = None):
        if not is_oauth_configured():
            raise HTTPException(
                503,
                "GitHub OAuth is not configured. Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET.",
            )
        _, _, redirect_uri = oauth_client_config()
        state = new_oauth_state()
        referer = request.headers.get("referer") or ""
        default_next = "http://127.0.0.1:5173/scanner"
        raw = (next or referer or default_next).strip()
        target = sanitize_oauth_next_url(raw)
        url = build_authorize_url(state=state, redirect_uri=redirect_uri)
        resp = RedirectResponse(url=url)
        set_pending_oauth(resp, state=state, next_url=target)
        return resp

    @app.get("/auth/github/callback")
    def auth_github_callback(request: Request, code: str | None = None, state: str | None = None):
        if not code or not state:
            raise HTTPException(400, "Missing OAuth code or state")
        pending = read_pending_oauth(request)
        if not pending or pending.get("state") != state:
            raise HTTPException(400, "Invalid or expired OAuth state. Start again from the app.")
        next_url = sanitize_oauth_next_url(pending.get("next") or "http://127.0.0.1:5173/scanner")
        try:
            access = exchange_code_for_token(code)
        except ValueError as e:
            raise HTTPException(400, str(e)) from e
        try:
            u = github_user_login(access)
        except Exception as e:
            raise HTTPException(400, f"GitHub token valid but user lookup failed: {e}") from e
        old_sid = _session_id_from_request(request)
        delete_session(old_sid)
        sid = insert_session(
            github_token=access,
            github_login=u.login,
            avatar_url=u.avatar_url,
            source="oauth",
        )
        resp = RedirectResponse(url=next_url)
        _set_scanner_session_cookie(resp, sid)
        clear_github_token_cookie(resp)
        clear_pending_oauth(resp)
        return resp

    @app.post("/auth/github/pat")
    def auth_github_pat(request: Request, body: GitHubPatLoginRequest):
        t = body.token.strip()
        if not t:
            raise HTTPException(400, "Token is required")
        try:
            u = github_user_login(t)
        except Exception as e:
            raise HTTPException(401, f"Invalid GitHub token: {e}") from e
        old_sid = _session_id_from_request(request)
        delete_session(old_sid)
        sid = insert_session(
            github_token=t,
            github_login=u.login,
            avatar_url=u.avatar_url,
            source="pat",
        )
        r = JSONResponse({"ok": True, "login": u.login})
        _set_scanner_session_cookie(r, sid)
        clear_github_token_cookie(r)
        return r

    @app.post("/auth/github/disconnect")
    def github_disconnect(request: Request):
        sid = _session_id_from_request(request)
        delete_session(sid)
        r = JSONResponse({"ok": True})
        _clear_scanner_session_cookie(r)
        clear_github_token_cookie(r)
        return r

    @app.get("/github/session")
    def github_session(request: Request):
        prune_expired_sessions()
        sid = _session_id_from_request(request)
        row = get_session_row(sid)
        if row:
            return {
                "connected": True,
                "login": row["github_login"],
                "avatar_url": row.get("avatar_url"),
                "oauth_configured": is_oauth_configured(),
                "session_source": row.get("source"),
            }
        t = get_github_token_from_cookie(request)
        if not t:
            return {"connected": False, "oauth_configured": is_oauth_configured()}
        try:
            u = github_user_login(t)
            return {
                "connected": True,
                "login": u.login,
                "avatar_url": u.avatar_url,
                "oauth_configured": is_oauth_configured(),
                "session_source": "legacy_cookie",
            }
        except Exception:
            return {"connected": False, "oauth_configured": is_oauth_configured()}

    return app
