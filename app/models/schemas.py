"""Pydantic schemas for RegTranslate."""

from typing import Literal

from pydantic import BaseModel, Field


class PDFChunk(BaseModel):
    """A chunk of PDF text with metadata for source tracking."""

    text: str
    page: int
    section: str = ""
    chunk_index: int = 0


class ExtractionSubtask(BaseModel):
    """Subtask under a parent compliance task."""

    title: str
    description: str = ""


class EvidenceLink(BaseModel):
    """Link to evidence (URL or path) for compliance attestation."""

    url: str
    label: str = ""


class ExtractionTask(BaseModel):
    """Developer task extracted from regulatory text."""

    task_id: str
    title: str
    description: str
    priority: Literal["High", "Medium", "Low"]
    penalty_risk: str
    source_citation: str
    source_text: str
    responsible_role: str
    acceptance_criteria: list[str] = Field(default_factory=list)
    also_satisfies: list[str] = Field(default_factory=list)
    confidence: int | None = None
    subtasks: list[ExtractionSubtask] = Field(default_factory=list)
    evidence_links: list[EvidenceLink] = Field(default_factory=list)


class TaskExportRequest(BaseModel):
    """Request to export selected tasks to Jira or GitHub."""

    task_ids: list[str]
    target: Literal["jira", "github"]


# --- § 2.2.1 Audit logging (what to log, retention, tamper-evident); § 2.2.2 = review procedures ---


class AuditLogEntry(BaseModel):
    """Single audit log entry (§ 2.2.1). Tamper-evident via hash chain. Log access (success + fail) and auth events."""

    timestamp: str  # ISO 8601
    user_id: str
    action: str  # e.g. "access", "access_denied", "create", "update", "delete", "login", "login_failure", "logout"
    resource_accessed: str
    source_ip: str
    details: str = ""
    prev_hash: str = ""
    entry_hash: str = ""


class AuditReviewRecord(BaseModel):
    """Record of weekly/monthly review (§ 2.2.2): findings, remediation, remediation tracking."""

    id: str
    review_type: Literal["weekly_high_risk", "monthly_comprehensive"]
    performed_at: str
    performed_by: str
    findings: list[str] = Field(default_factory=list)
    remediation_actions: list[str] = Field(default_factory=list)
    high_risk_event_ids: list[str] = Field(default_factory=list)
