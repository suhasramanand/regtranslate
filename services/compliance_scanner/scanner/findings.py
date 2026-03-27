from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.models.schemas import EvidenceLink


class FindingStatus(str, Enum):
    compliant = "compliant"
    non_compliant = "non_compliant"
    unknown = "unknown"


class Finding(BaseModel):
    control_id: str = Field(..., min_length=3)
    control_title: str = ""
    status: FindingStatus = FindingStatus.unknown
    confidence: int | None = Field(default=None, ge=0, le=100)

    summary: str = ""
    gap_description: str = ""
    acceptance_criteria: list[str] = Field(default_factory=list)

    evidence_links: list[EvidenceLink] = Field(default_factory=list)
    evidence_snippets: list[dict[str, Any]] = Field(default_factory=list)  # path/lines/text excerpts

    fingerprints: dict[str, str] = Field(
        default_factory=dict,
        description="Stable identifiers for dedupe (e.g., per control/path/lines).",
    )

