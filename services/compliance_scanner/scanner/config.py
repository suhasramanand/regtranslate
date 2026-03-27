from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel, Field


class ScannerConfig(BaseModel):
    data_dir: Path = Field(default_factory=lambda: Path(__file__).resolve().parents[2] / "scan_history")


def get_config() -> ScannerConfig:
    cfg = ScannerConfig()
    cfg.data_dir.mkdir(parents=True, exist_ok=True)
    return cfg

