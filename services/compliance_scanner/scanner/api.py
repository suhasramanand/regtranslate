from __future__ import annotations

import uuid
from datetime import datetime

import os

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field

from app.models.schemas import ExtractionTask
from app.services import jira_export

from .github_session import (
    get_github_token_from_cookie,
    list_authenticated_user_repos_brief,
    list_org_repos_brief,
    list_user_orgs,
)
from .models import OrgSource, RepoRef, ScanRun, ScanStatus
from .persistence import get_run, list_runs, upsert_run
from .results import load_findings
from .runner import run_org_scan
from .session_store import SESSION_COOKIE_NAME, get_token_for_session, prune_expired_sessions


class RepoRefIn(BaseModel):
    full_name: str = Field(..., min_length=3)
    default_branch: str = Field("main", min_length=1)


class StartOrgScanRequest(BaseModel):
    org: str = Field(..., min_length=1)
    repos: list[str] | None = None
    selected_repos: list[RepoRefIn] | None = None
    mode: str = "org_scan"
    config: dict | None = None


class StartOrgScanResponse(BaseModel):
    run_id: str
    status: ScanStatus


class JiraExportFindingsRequest(BaseModel):
    project_key: str
    url: str | None = None
    email: str | None = None
    api_token: str | None = None
    only_non_compliant: bool = True


class JiraExportFindingsResponse(BaseModel):
    keys: list[str]


class GitHubPatLoginRequest(BaseModel):
    token: str = Field(..., min_length=1, description="GitHub personal access token")


def _session_id_from_request(request: Request) -> str | None:
    s = request.cookies.get(SESSION_COOKIE_NAME)
    return s.strip() if s and str(s).strip() else None


def resolve_github_token_from_request(request: Request) -> str | None:
    sid = _session_id_from_request(request)
    t = get_token_for_session(sid)
    if t:
        return t
    return get_github_token_from_cookie(request)


def resolve_github_token_for_scan(
    request: Request,
    config_token: str | None,
) -> str:
    if config_token and str(config_token).strip():
        return str(config_token).strip()
    cookie_t = resolve_github_token_from_request(request)
    if cookie_t:
        return cookie_t
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    x = request.headers.get("x-scanner-github-token") or ""
    if x.strip():
        return x.strip()
    env_t = os.getenv("GITHUB_TOKEN", "")
    if env_t.strip():
        return env_t.strip()
    raise HTTPException(
        400,
        "Missing GitHub authentication. Use Connect GitHub, paste a token, "
        "or set GITHUB_TOKEN / run with `gh auth token`.",
    )


def _allowed_oauth_next_origins() -> list[str]:
    out = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ]
    _cors = os.getenv("COMPLIANCE_SCANNER_CORS_ORIGINS", "").strip()
    if _cors:
        for o in _cors.split(","):
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


def resolve_github_token_for_api(request: Request, header_token: str | None) -> str:
    if header_token and header_token.strip():
        return header_token.strip()
    cookie_t = resolve_github_token_from_request(request)
    if cookie_t:
        return cookie_t
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    env_t = os.getenv("GITHUB_TOKEN", "")
    if env_t.strip():
        return env_t.strip()
    raise HTTPException(
        401,
        "GitHub token required. Connect GitHub in the UI, or set GITHUB_TOKEN on the server.",
    )


def create_app() -> FastAPI:
    app = FastAPI(title="Compliance Scanner", version="0.1.0")

    _cors = os.getenv("COMPLIANCE_SCANNER_CORS_ORIGINS", "").strip()
    if _cors:
        origins = [o.strip() for o in _cors.split(",") if o.strip()]
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
  <head><meta charset="utf-8"/><title>Compliance Scanner</title></head>
  <body style="font-family: ui-sans-serif, system-ui; max-width: 880px; margin: 32px auto; padding: 0 16px;">
    <h2>Compliance Scanner</h2>
    <p>Use the React UI at <code>/scanner</code> or OpenAPI at <code>/docs</code>.</p>
    <p>GitHub sign-in runs on the <strong>OAuth service</strong> (default <code>http://127.0.0.1:9020</code>), not this API.</p>
    <ul>
      <li><a href="/docs">OpenAPI docs</a></li>
    </ul>
  </body>
</html>"""

    @app.get("/health")
    def health():
        prune_expired_sessions()
        return {"ok": True, "service": "compliance-scanner"}

    @app.get("/github/orgs")
    def github_orgs(
        request: Request,
        x_scanner_github_token: str | None = Header(None, alias="X-Scanner-GitHub-Token"),
    ):
        token = resolve_github_token_for_api(request, x_scanner_github_token)
        try:
            orgs = list_user_orgs(token)
        except Exception as e:
            raise HTTPException(502, f"Failed to list GitHub orgs: {e}") from e
        return {"orgs": orgs}

    @app.get("/github/orgs/{org}/repos")
    def github_org_repos(
        org: str,
        request: Request,
        limit: int = 200,
        x_scanner_github_token: str | None = Header(None, alias="X-Scanner-GitHub-Token"),
    ):
        token = resolve_github_token_for_api(request, x_scanner_github_token)
        try:
            repos = list_org_repos_brief(token, org, limit=min(max(limit, 1), 500))
        except Exception as e:
            raise HTTPException(502, f"Failed to list repositories: {e}") from e
        return {"repos": repos}

    @app.get("/github/user/repos")
    def github_user_repos(
        request: Request,
        limit: int = 200,
        x_scanner_github_token: str | None = Header(None, alias="X-Scanner-GitHub-Token"),
    ):
        token = resolve_github_token_for_api(request, x_scanner_github_token)
        try:
            login, repos = list_authenticated_user_repos_brief(
                token, limit=min(max(limit, 1), 500)
            )
        except Exception as e:
            raise HTTPException(502, f"Failed to list your repositories: {e}") from e
        return {"login": login, "repos": repos}

    @app.get("/runs")
    def runs(limit: int = 50):
        return {"runs": [r.model_dump(mode="json") for r in list_runs(limit=limit)]}

    @app.get("/runs/{run_id}")
    def run(run_id: str):
        r = get_run(run_id)
        if not r:
            raise HTTPException(404, "run not found")
        return r.model_dump(mode="json")

    @app.get("/runs/{run_id}/findings")
    def run_findings(run_id: str, limit: int = 200):
        r = get_run(run_id)
        if not r:
            raise HTTPException(404, "run not found")
        findings = load_findings(run_id)
        return {"findings": [f.model_dump(mode="json") for f in findings[: max(1, limit)]]}

    @app.post("/org-scan/start", response_model=StartOrgScanResponse)
    def start_org_scan(req: StartOrgScanRequest, background: BackgroundTasks, request: Request):
        cfg = dict(req.config or {})
        token = resolve_github_token_for_scan(request, cfg.get("github_token"))
        run_id = str(uuid.uuid4())

        repo_refs: list[RepoRef] = []
        if req.selected_repos:
            repo_refs = [
                RepoRef(full_name=r.full_name, default_branch=r.default_branch, commit_sha="")
                for r in req.selected_repos
            ]
        elif req.repos:
            repo_refs = [
                RepoRef(full_name=full, default_branch="main", commit_sha="") for full in req.repos
            ]

        run = ScanRun(
            id=run_id,
            created_at=datetime.utcnow(),
            status=ScanStatus.queued,
            org_source=OrgSource(org=req.org),
            repos=repo_refs,
            mode=req.mode if req.mode in ("org_scan", "ci_pr", "ci_main") else "org_scan",
            config=cfg,
        )
        upsert_run(run)
        background.add_task(run_org_scan, run_id=run_id, github_token=token)
        return StartOrgScanResponse(run_id=run_id, status=run.status)

    @app.post("/runs/{run_id}/export/jira", response_model=JiraExportFindingsResponse)
    def export_findings_to_jira(run_id: str, req: JiraExportFindingsRequest):
        r = get_run(run_id)
        if not r:
            raise HTTPException(404, "run not found")
        findings = load_findings(run_id)
        if req.only_non_compliant:
            findings = [f for f in findings if f.status.value == "non_compliant"]
        if not findings:
            return JiraExportFindingsResponse(keys=[])

        tasks: list[ExtractionTask] = []
        for f in findings:
            title = f"[{f.control_id}] {f.control_title}".strip()
            desc_parts = []
            if f.summary:
                desc_parts.append(f"Summary:\n{f.summary}")
            if f.gap_description:
                desc_parts.append(f"Gap:\n{f.gap_description}")
            if f.acceptance_criteria:
                desc_parts.append("Acceptance criteria:\n- " + "\n- ".join(f.acceptance_criteria))
            if f.evidence_links:
                desc_parts.append(
                    "Evidence:\n- " + "\n- ".join([f"[{e.label or 'link'}] {e.url}" for e in f.evidence_links])
                )

            tasks.append(
                ExtractionTask(
                    task_id=f.fingerprints.get("primary", f.control_id),
                    title=title,
                    description="\n\n".join(desc_parts).strip(),
                    priority="High",
                    penalty_risk="",
                    source_citation=f.control_id,
                    source_text="",
                    responsible_role="Backend Engineer",
                    acceptance_criteria=f.acceptance_criteria,
                    also_satisfies=[],
                    confidence=f.confidence,
                    subtasks=[],
                    evidence_links=f.evidence_links,
                )
            )

        keys = jira_export.export_to_jira(
            tasks,
            req.project_key,
            url=req.url,
            email=req.email,
            api_token=req.api_token,
        )
        return JiraExportFindingsResponse(keys=keys)

    return app
