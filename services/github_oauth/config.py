from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel, Field


class GitHubOAuthConfig(BaseModel):
    """Shared data directory with Compliance Scanner (auth.sqlite, runs, etc.)."""

    data_dir: Path = Field(default_factory=lambda: Path(__file__).resolve().parents[2] / "scan_history")


def get_oauth_config() -> GitHubOAuthConfig:
    cfg = GitHubOAuthConfig()
    cfg.data_dir.mkdir(parents=True, exist_ok=True)
    return cfg
