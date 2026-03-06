"""FastAPI application for RegTranslate."""

import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from starlette.middleware.base import BaseHTTPMiddleware

from app.config import CORS_ORIGINS_LIST
from app.models.schemas import EvidenceLink
from app.services import embeddings, pdf_processor, task_generator, vector_store

_VERSION = "1.0.0"
try:
    _vpath = Path(__file__).resolve().parents[1].parent / "VERSION"
    if _vpath.exists():
        _VERSION = _vpath.read_text().strip()
except Exception:
    pass

app = FastAPI(
    title="RegTranslate",
    description="AI-powered regulatory document to developer task converter",
    version=_VERSION,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response


app.add_middleware(SecurityHeadersMiddleware)

api = APIRouter()


class ProcessRequest(BaseModel):
    """Request to process a document (when passing path instead of upload)."""

    regulation_name: str = "Custom"


class ProcessResponse(BaseModel):
    """Response from document processing pipeline."""

    doc_id: str
    chunk_count: int
    regulation_name: str
    sample_query: str
    sample_results: list[dict]


class ExtractRequest(BaseModel):
    doc_id: str = ""
    doc_ids: list[str] | None = None  # multiple docs: extract from each, then dedupe
    regulation_name: str
    dedupe: bool = True
    return_coverage: bool = False
    product_context: str | None = None
    rag_query: str | None = None


class ExtractResponse(BaseModel):
    tasks: list[dict]
    coverage: dict | None = None  # Quick Test: pages, sections, section_4_in_chunks


@api.get("/health")
def health():
    """Liveness: is the process running?"""
    return {"status": "ok", "version": _VERSION}


@api.get("/ready")
def ready():
    """Readiness: can the app accept traffic? (ChromaDB dir, config basic checks)."""
    from app.config import CHROMA_PERSIST_DIR
    ok = CHROMA_PERSIST_DIR.exists() and CHROMA_PERSIST_DIR.is_dir()
    return {"status": "ready" if ok else "degraded", "chroma_dir": str(CHROMA_PERSIST_DIR)}


FLOW_STAGES = [
    {
        "id": "upload",
        "title": "Document Upload",
        "desc": "PDF selected and sent to backend",
        "duration_ms": 2000,
        "details": ["Receive file from client", "Validate PDF format", "Assign doc_id"],
    },
    {
        "id": "extract",
        "title": "Text Extraction",
        "desc": "PyPDF extracts and chunks text",
        "duration_ms": 2500,
        "details": ["Load PDF with PyPDF", "Extract raw text", "Split into chunks (overlap, size)", "Attach page/section metadata"],
    },
    {
        "id": "embed",
        "title": "Embeddings",
        "desc": "sentence-transformers creates vectors",
        "duration_ms": 3000,
        "details": ["Load embedding model", "Encode each chunk to vector", "Normalize embeddings"],
    },
    {
        "id": "store",
        "title": "ChromaDB",
        "desc": "Vectors stored for semantic search",
        "duration_ms": 2000,
        "details": ["Connect to ChromaDB collection", "Upsert vectors + metadata", "Index for similarity search"],
    },
    {
        "id": "rag",
        "title": "RAG Retrieval",
        "desc": "Retrieve relevant chunks for extraction",
        "duration_ms": 2500,
        "details": ["Embed product context / query", "Query ChromaDB (top-k)", "Return chunks + scores"],
    },
    {
        "id": "llm",
        "title": "LLM Extraction",
        "desc": "Groq/GenAI extracts structured tasks",
        "duration_ms": 3500,
        "details": ["Build prompt with chunks", "Call LLM (Groq Llama / Gemini)", "Parse JSON → tasks, acceptance criteria", "Deduplicate across regulations"],
    },
    {
        "id": "results",
        "title": "Results",
        "desc": "Tasks ready for export",
        "duration_ms": 3000,
        "details": ["Return tasks to frontend", "Display with priority, source", "Export to Jira / GitHub"],
    },
]


@api.get("/demo/flow-stages")
def get_flow_stages():
    """Return pipeline stages for the flow animation demo. Auto-plays through each stage."""
    return {"stages": FLOW_STAGES}


@api.get("/config/jira")
def get_jira_config():
    """
    Return JIRA URL, email, and token from .env for prepopulating the UI.
    Same source as Streamlit (app.config).
    """
    from app.config import JIRA_EMAIL, JIRA_API_TOKEN, JIRA_URL
    return {
        "url": JIRA_URL or "https://your-domain.atlassian.net",
        "email": JIRA_EMAIL or "",
        "api_token": JIRA_API_TOKEN or "",
    }


@api.get("/config/export")
def get_export_config():
    """
    Return Jira and GitHub config from .env for prepopulating the export UI.
    """
    from app.config import (
        GITHUB_REPO,
        GITHUB_TOKEN,
        JIRA_EMAIL,
        JIRA_API_TOKEN,
        JIRA_URL,
    )
    return {
        "jira": {
            "url": JIRA_URL or "https://your-domain.atlassian.net",
            "email": JIRA_EMAIL or "",
            "api_token": JIRA_API_TOKEN or "",
        },
        "github": {
            "repo": GITHUB_REPO or "",
            "token": GITHUB_TOKEN or "",
        },
    }


@api.post("/process", response_model=ProcessResponse)
async def process_document(
    file: UploadFile = File(...),
    regulation_name: str = "Custom",
):
    """
    Upload a PDF, extract and chunk text, embed, and store in ChromaDB.
    Returns doc_id, chunk count, and sample query results to verify the pipeline.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "File must be a PDF")

    doc_id = str(uuid.uuid4())
    content = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        try:
            tmp.write(content)
            tmp.flush()
            path = Path(tmp.name)
        except Exception as e:
            raise HTTPException(500, f"Failed to save upload: {e}")

    try:
        chunks = pdf_processor.extract_and_chunk(path)
    except Exception as e:
        raise HTTPException(422, f"PDF processing failed: {e}")
    finally:
        path.unlink(missing_ok=True)

    if not chunks:
        raise HTTPException(422, "No text extracted from PDF")

    from app.services import regulation_version
    regulation_version.record_version(
        doc_id=doc_id,
        regulation_name=regulation_name,
        source_filename=file.filename or "upload.pdf",
        content=content,
        chunk_count=len(chunks),
    )

    chunk_dicts = [
        {"text": c.text, "page": c.page, "section": c.section, "chunk_index": c.chunk_index}
        for c in chunks
    ]
    texts = [c.text for c in chunks]

    try:
        emb = embeddings.embed_texts(texts)
        meta = {"regulation_name": regulation_name, "source": file.filename or "upload.pdf"}
        vector_store.add_document(doc_id, chunk_dicts, emb, meta)
        sample_query = "encryption authentication access control"
        q_emb = embeddings.embed_query(sample_query)
        sample_results = vector_store.query(doc_id, q_emb, n_results=3)
    except Exception as e:
        vector_store.reset_client()
        raise HTTPException(
            500,
            "Processing failed (embeddings or database). Try Settings → Clear all data, then upload again.",
        ) from e

    return ProcessResponse(
        doc_id=doc_id,
        chunk_count=len(chunks),
        regulation_name=regulation_name,
        sample_query=sample_query,
        sample_results=[
            {"text": r["text"][:300] + "..." if len(r["text"]) > 300 else r["text"], "metadata": r["metadata"]}
            for r in sample_results
        ],
    )


@api.get("/process/{doc_id}/coverage")
def get_coverage(doc_id: str):
    """
    Quick Test: return RAG coverage (pages, sections, Section 4) for the doc without running LLM.
    Use to verify all 4 Parts (I–IV) and Section 4 (API Requirements) are in the retrieved chunks.
    """
    try:
        coverage = task_generator.get_rag_coverage(doc_id)
        return coverage
    except Exception as e:
        raise HTTPException(500, f"Coverage check failed: {e}")


@api.post("/extract", response_model=ExtractResponse)
def extract_tasks_endpoint(req: ExtractRequest) -> ExtractResponse:
    """
    Run RAG + LLM extraction on one or more processed documents.
    When doc_ids is provided, extracts from each doc then deduplicates across all.
    Applies confidence calibration from user feedback.
    """
    from app.services import confidence_calibration, deduplication

    doc_ids = req.doc_ids if req.doc_ids else ([req.doc_id] if req.doc_id else [])
    if not doc_ids:
        raise HTTPException(400, "doc_id or doc_ids required")

    try:
        all_raw: list = []
        merged_coverage: dict | None = None

        for doc_id in doc_ids:
            raw, cov = task_generator.extract_tasks(
                doc_id,
                req.regulation_name,
                product_context=req.product_context,
                rag_query=req.rag_query or task_generator.RAG_QUERY,
            )
            all_raw.extend(raw)
            if cov and req.return_coverage:
                if merged_coverage is None:
                    merged_coverage = {
                        "chunk_count": 0,
                        "pages": [],
                        "pages_summary": "",
                        "sections": [],
                        "section_4_in_chunks": False,
                    }
                merged_coverage["chunk_count"] += cov.get("chunk_count", 0)
                merged_coverage["pages"] = list(set(merged_coverage.get("pages", []) + cov.get("pages", [])))
                merged_coverage["sections"] = list(set(merged_coverage.get("sections", []) + cov.get("sections", [])))
                merged_coverage["section_4_in_chunks"] = merged_coverage.get("section_4_in_chunks") or cov.get("section_4_in_chunks", False)
                p = merged_coverage["pages"]
                merged_coverage["pages_summary"] = f"pages {min(p)}–{max(p)}" if p else "none"

        tasks = deduplication.deduplicate(all_raw) if req.dedupe and all_raw else all_raw
        out = []
        for t in tasks:
            d = t.model_dump()
            cal = confidence_calibration.get_calibrated_confidence(t.task_id, t.title, t.confidence)
            if cal is not None:
                d["confidence"] = cal
            out.append(d)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(500, f"Extraction failed: {e}")
    return ExtractResponse(
        tasks=out,
        coverage=merged_coverage if req.return_coverage else None,
    )


# --- Export to Jira / GitHub ---


class JiraExportRequest(BaseModel):
    tasks: list[dict]
    project_key: str
    url: str | None = None
    email: str | None = None
    api_token: str | None = None
    sprint_id: int | None = None
    board_id: int | None = None
    auto_create_sprint: bool = False
    assignee_overrides: dict[str, str] | None = None


class JiraExportResponse(BaseModel):
    keys: list[str]


class GitHubExportRequest(BaseModel):
    tasks: list[dict]
    repo: str  # owner/repo
    token: str


class GitHubExportResponse(BaseModel):
    urls: list[str]


def _parse_evidence(links: list | None) -> list[EvidenceLink]:
    if not links:
        return []
    out = []
    for e in links:
        if isinstance(e, dict) and e.get("url"):
            out.append(EvidenceLink(url=e["url"], label=e.get("label", "")))
        elif isinstance(e, EvidenceLink):
            out.append(e)
    return out


@api.post("/export/jira", response_model=JiraExportResponse)
def export_to_jira_endpoint(req: JiraExportRequest) -> JiraExportResponse:
    """Export selected tasks to Jira. Requires project_key and credentials."""
    from app.models.schemas import ExtractionSubtask, ExtractionTask
    from app.services import jira_export

    tasks = []
    for t in req.tasks:
        subtasks = [
            ExtractionSubtask(title=s.get("title", ""), description=s.get("description", ""))
            for s in (t.get("subtasks") or [])
        ]
        evidence = _parse_evidence(t.get("evidence_links"))
        tasks.append(
            ExtractionTask(
                task_id=t.get("task_id", ""),
                title=t.get("title", ""),
                description=t.get("description", ""),
                priority=t.get("priority", "Medium"),
                penalty_risk=t.get("penalty_risk", ""),
                source_citation=t.get("source_citation", ""),
                source_text=t.get("source_text", ""),
                responsible_role=t.get("responsible_role", "Backend Engineer"),
                acceptance_criteria=t.get("acceptance_criteria", []),
                also_satisfies=t.get("also_satisfies", []),
                confidence=t.get("confidence"),
                subtasks=subtasks,
                evidence_links=evidence,
            )
        )
    try:
        keys = jira_export.export_to_jira(
            tasks,
            req.project_key,
            url=req.url,
            email=req.email,
            api_token=req.api_token,
            sprint_id=req.sprint_id,
            board_id=req.board_id,
            auto_create_sprint=req.auto_create_sprint,
            assignee_overrides=req.assignee_overrides,
        )
        from app.services import export_history
        export_history.append_jira(req.project_key, keys, len(tasks), url=req.url)
        return JiraExportResponse(keys=keys)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(500, f"Jira export failed: {e}")


@api.post("/export/github", response_model=GitHubExportResponse)
def export_to_github_endpoint(req: GitHubExportRequest) -> GitHubExportResponse:
    """Export selected tasks to GitHub Issues. Requires repo (owner/name) and token."""
    from app.models.schemas import ExtractionSubtask, ExtractionTask
    from app.services import github_export

    tasks = []
    for t in req.tasks:
        subtasks = [
            ExtractionSubtask(title=s.get("title", ""), description=s.get("description", ""))
            for s in (t.get("subtasks") or [])
        ]
        evidence = _parse_evidence(t.get("evidence_links"))
        tasks.append(
            ExtractionTask(
                task_id=t.get("task_id", ""),
                title=t.get("title", ""),
                description=t.get("description", ""),
                priority=t.get("priority", "Medium"),
                penalty_risk=t.get("penalty_risk", ""),
                source_citation=t.get("source_citation", ""),
                source_text=t.get("source_text", ""),
                responsible_role=t.get("responsible_role", "Backend Engineer"),
                acceptance_criteria=t.get("acceptance_criteria", []),
                also_satisfies=t.get("also_satisfies", []),
                confidence=t.get("confidence"),
                subtasks=subtasks,
                evidence_links=evidence,
            )
        )
    try:
        urls = github_export.export_to_github(tasks, req.repo, req.token)
        from app.services import export_history
        export_history.append_github(req.repo, urls, len(tasks))
        return GitHubExportResponse(urls=urls)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(500, f"GitHub export failed: {e}")


# --- Regulation version tracking ---


@api.get("/regulation/versions")
def regulation_versions(regulation_name: str | None = None, limit: int = 100):
    """List regulation document versions."""
    from app.services import regulation_version
    entries = regulation_version.list_versions(regulation_name=regulation_name, limit=limit)
    return {"versions": [{"doc_id": v.doc_id, "regulation_name": v.regulation_name, "source_filename": v.source_filename, "content_hash": v.content_hash, "processed_at": v.processed_at, "version_label": v.version_label, "chunk_count": v.chunk_count} for v in entries]}


class CheckUpdateRequest(BaseModel):
    doc_id: str


@api.post("/regulation/check-update")
async def regulation_check_update(file: UploadFile = File(...), doc_id: str = ""):
    """Check if a document needs re-processing (content changed). Pass doc_id as query param."""
    if not doc_id.strip():
        raise HTTPException(400, "doc_id query param required")
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "PDF file required")
    content = await file.read()
    from app.services import regulation_version
    result = regulation_version.check_update_needed(doc_id, content)
    return result


@api.post("/regulation/check-content-change")
async def regulation_check_content_change(
    file: UploadFile = File(...), regulation_name: str = ""
):
    """Check if file content differs from last processed version (same regulation + filename)."""
    if not regulation_name.strip():
        raise HTTPException(400, "regulation_name query param required")
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "PDF file required")
    content = await file.read()
    from app.services import regulation_version
    result = regulation_version.check_content_changed(
        regulation_name=regulation_name.strip(),
        source_filename=file.filename or "upload.pdf",
        content=content,
    )
    return result


# --- Compliance Q&A agent ---


class QARequest(BaseModel):
    doc_id: str
    question: str
    screen_context: dict | None = None  # tasks, coverage, regulation_name, etc.


@api.post("/qa")
def qa_agent(req: QARequest):
    """Answer compliance questions using RAG + LLM. Also answers questions about the current screen state."""
    from app.services import qa_agent as qa_svc
    result = qa_svc.answer_question(req.doc_id, req.question, screen_context=req.screen_context)
    return result


# --- Cross-regulation gap analysis ---


class GapAnalysisRequest(BaseModel):
    tasks_a: list[dict]
    tasks_b: list[dict]
    label_a: str = "A"
    label_b: str = "B"


@api.post("/gap-analysis")
def gap_analysis_endpoint(req: GapAnalysisRequest):
    """Compare two task sets and return overlap, unique_to_a, unique_to_b."""
    from app.services import gap_analysis
    result = gap_analysis.analyze_gaps(req.tasks_a, req.tasks_b, req.label_a, req.label_b)
    return result


# --- Confidence calibration ---


class CalibrationFeedbackRequest(BaseModel):
    task_id: str
    title: str
    correct: bool


@api.post("/calibration/feedback")
def calibration_feedback(req: CalibrationFeedbackRequest):
    """Submit user feedback (correct/incorrect) for confidence calibration."""
    from app.services import confidence_calibration
    confidence_calibration.submit_feedback(req.task_id, req.title, req.correct)
    return {"ok": True}


@api.get("/calibration/stats")
def calibration_stats():
    """Get calibration statistics."""
    from app.services import confidence_calibration
    return confidence_calibration.get_stats()


# --- Export history ---


@api.get("/history/export")
def get_export_history(limit: int = 100):
    """List history of created Jira tickets and GitHub issues."""
    from app.services import export_history
    return {"entries": export_history.list_entries(limit=limit)}


# --- § 2.2.1 Audit logging; § 2.2.2 = review/alerting ---


class AuditLogAppendRequest(BaseModel):
    user_id: str
    action: str
    resource_accessed: str
    source_ip: str
    details: str = ""


class AuditReviewCreateRequest(BaseModel):
    review_type: str  # "weekly_high_risk" | "monthly_comprehensive"
    performed_by: str
    findings: list[str] = []
    remediation_actions: list[str] = []
    high_risk_event_ids: list[str] = []


@api.post("/audit/log")
def audit_append(req: AuditLogAppendRequest, x_forwarded_for: str | None = None):
    """Append a tamper-evident audit log entry (timestamp, user_id, action, resource, source_ip)."""
    from app.services import audit_log as audit_svc
    source_ip = (x_forwarded_for or "").split(",")[0].strip() or req.source_ip
    entry = audit_svc.append_entry(
        user_id=req.user_id,
        action=req.action,
        resource_accessed=req.resource_accessed,
        source_ip=source_ip,
        details=req.details,
    )
    return {"ok": True, "entry_hash": entry.entry_hash}


@api.get("/audit/logs")
def audit_list(limit: int = 500, since: str | None = None):
    """List audit log entries (optional since ISO timestamp)."""
    from app.services import audit_log as audit_svc
    entries = audit_svc.list_entries(limit=limit, since_ts=since)
    return {"entries": [e.model_dump() for e in entries]}


@api.get("/audit/verify")
def audit_verify():
    """Verify tamper-evident chain integrity."""
    from app.services import audit_log as audit_svc
    ok, errors = audit_svc.verify_chain()
    return {"valid": ok, "errors": errors}


@api.post("/audit/retention")
def audit_enforce_retention():
    """Enforce retention (remove entries older than 6 years)."""
    from app.services import audit_log as audit_svc
    removed = audit_svc.enforce_retention()
    return {"removed": removed}


@api.get("/audit/alerts")
def audit_alerts_list(limit: int = 100):
    """List automated alerts (suspicious patterns)."""
    from app.services import audit_alerts
    return {"alerts": audit_alerts.list_alerts(limit=limit)}


@api.post("/audit/alerts/run")
def audit_alerts_run():
    """Run automated alerting for suspicious patterns."""
    from app.services import audit_alerts
    alerts = audit_alerts.run_automated_alerts()
    return {"generated": len(alerts), "alerts": alerts}


@api.get("/audit/reviews")
def audit_reviews_list(limit: int = 50):
    """List review records (weekly/monthly, findings, remediation)."""
    from app.services import audit_alerts
    records = audit_alerts.list_review_records(limit=limit)
    return {"reviews": [r.model_dump() for r in records]}


@api.post("/audit/reviews")
def audit_review_create(req: AuditReviewCreateRequest):
    """Record a weekly high-risk or monthly comprehensive review (findings + remediation)."""
    from datetime import datetime, timezone
    from app.services import audit_alerts
    from app.services.audit_models import AuditReviewRecord
    record = AuditReviewRecord(
        id=str(__import__("uuid").uuid4()),
        review_type=req.review_type,
        performed_at=datetime.now(timezone.utc).isoformat(),
        performed_by=req.performed_by,
        findings=req.findings,
        remediation_actions=req.remediation_actions,
        high_risk_event_ids=req.high_risk_event_ids,
    )
    audit_alerts.save_review_record(record)
    return {"ok": True, "id": record.id}


# --- § 2.5.2 Password Requirements (REQUIRED) ---


class ValidatePasswordRequest(BaseModel):
    password: str


@api.get("/compliance/password-policy")
def get_password_policy():
    """§ 2.5.2 policy summary: min length 12, complexity, lockout 5, history 24, max age 90 days."""
    from app.services import password_policy
    return password_policy.policy_summary()


@api.post("/compliance/validate-password")
def validate_password_endpoint(req: ValidatePasswordRequest):
    """Validate password against § 2.5.2 (length, complexity)."""
    from app.services import password_policy
    valid, errors = password_policy.validate_password(req.password)
    return {"valid": valid, "errors": errors}


# --- Settings: reset all data ---


@api.post("/settings/reset-all")
def settings_reset_all():
    """Clear all stored data: regulation versions, audit logs, export history, ChromaDB, calibration."""
    from app.config import AUDIT_LOG_DIR, CHROMA_PERSIST_DIR
    cleared = []
    # Regulation versions
    reg_versions = Path(__file__).resolve().parents[1].parent / "regulation_versions"
    versions_file = reg_versions / "versions.json"
    if versions_file.exists():
        versions_file.unlink()
        cleared.append("regulation_versions")
    # Audit logs
    for name in ("audit.jsonl", "chain_state.json", "reviews.jsonl"):
        p = AUDIT_LOG_DIR / name
        if p.exists():
            p.unlink()
            cleared.append(f"audit/{name}")
    # Export history
    export_dir = Path(__file__).resolve().parents[1].parent / "export_history"
    exports_file = export_dir / "exports.json"
    if exports_file.exists():
        exports_file.unlink()
        cleared.append("export_history")
    # ChromaDB
    if CHROMA_PERSIST_DIR.exists():
        import shutil
        shutil.rmtree(CHROMA_PERSIST_DIR)
        CHROMA_PERSIST_DIR.mkdir(parents=True, exist_ok=True)
        from app.services import vector_store
        vector_store.reset_client()
        cleared.append("chroma_db")
    # Calibration
    calib_dir = Path(__file__).resolve().parents[1].parent / "calibration"
    feedback_file = calib_dir / "feedback.json"
    if feedback_file.exists():
        feedback_file.unlink()
        cleared.append("calibration")
    return {"ok": True, "cleared": cleared}


# Register routes at root (tests, direct API) and under /api (frontend proxy)
app.include_router(api)
app.include_router(api, prefix="/api")
