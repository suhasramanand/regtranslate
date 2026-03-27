from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, Field, TypeAdapter


Severity = Literal["critical", "high", "medium", "low"]


class ControlQuery(BaseModel):
    """
    A retrieval query for finding evidence in code.
    """

    query: str = Field(..., min_length=3)
    where: dict[str, Any] | None = None  # optional Chroma where-filter


class Control(BaseModel):
    id: str = Field(..., min_length=3)
    title: str = Field(..., min_length=3)
    description: str = ""
    severity: Severity = "medium"

    # One or more retrieval queries used for candidate evidence selection
    queries: list[ControlQuery] = Field(default_factory=list)

    # Optional ticket template hints
    acceptance_criteria: list[str] = Field(default_factory=list)


def default_catalog_path() -> Path:
    return Path(__file__).resolve().parents[3] / "controls" / "catalog.yaml"


def load_controls(path: str | Path | None = None) -> list[Control]:
    p = Path(path) if path else default_catalog_path()
    raw = yaml.safe_load(p.read_text()) if p.exists() else []
    return TypeAdapter(list[Control]).validate_python(raw or [])

