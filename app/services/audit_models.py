"""Audit log models (§ 2.2.1 / § 2.2.2). No app.models dependency so services load reliably."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class AuditLogEntry(BaseModel):
    """Single audit log entry (§ 2.2.1). Tamper-evident via hash chain."""

    timestamp: str
    user_id: str
    action: str
    resource_accessed: str
    source_ip: str
    details: str = ""
    audit_subject: str = ""  # human-readable who (name, email, github) for reviewers
    prev_hash: str = ""
    entry_hash: str = ""


class AuditReviewRecord(BaseModel):
    """Record of weekly/monthly review (§ 2.2.2): findings, remediation."""

    id: str
    review_type: Literal["weekly_high_risk", "monthly_comprehensive"]
    performed_at: str
    performed_by: str
    findings: list[str] = Field(default_factory=list)
    remediation_actions: list[str] = Field(default_factory=list)
    high_risk_event_ids: list[str] = Field(default_factory=list)
