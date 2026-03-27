from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class RepoProvider(str, Enum):
    github = "github"


class OrgSource(BaseModel):
    provider: RepoProvider = RepoProvider.github
    org: str = Field(..., min_length=1, description="GitHub organization login")


class RepoRef(BaseModel):
    full_name: str = Field(..., min_length=3, description="owner/repo")
    default_branch: str = Field("main", min_length=1)
    commit_sha: str = Field(..., min_length=0, description="Resolved commit SHA for scan permalink stability")


class ScanStatus(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class ScanError(BaseModel):
    message: str
    at: datetime = Field(default_factory=lambda: datetime.utcnow())
    details: dict[str, Any] | None = None


class ScanCounts(BaseModel):
    repos_total: int = 0
    repos_done: int = 0
    files_indexed: int = 0
    chunks_indexed: int = 0
    controls_total: int = 0
    controls_done: int = 0
    findings_total: int = 0
    findings_non_compliant: int = 0
    findings_unknown: int = 0


class ScanRun(BaseModel):
    id: str
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    started_at: datetime | None = None
    finished_at: datetime | None = None
    status: ScanStatus = ScanStatus.queued

    org_source: OrgSource
    repos: list[RepoRef] = Field(default_factory=list)

    mode: Literal["org_scan", "ci_pr", "ci_main"] = "org_scan"

    counts: ScanCounts = Field(default_factory=ScanCounts)
    errors: list[ScanError] = Field(default_factory=list)

    config: dict[str, Any] = Field(default_factory=dict)

