from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from github import Github

from .models import RepoRef


DEFAULT_MAX_FILE_BYTES = 350_000
DEFAULT_ALLOWED_EXTS = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".java",
    ".go",
    ".rs",
    ".rb",
    ".php",
    ".cs",
    ".kt",
    ".swift",
    ".scala",
    ".sql",
    ".yaml",
    ".yml",
    ".json",
    ".toml",
    ".ini",
    ".env",
    ".md",
    ".txt",
    ".sh",
    ".bash",
    ".dockerfile",
    "dockerfile",
}

DEFAULT_SKIP_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "target",
    ".venv",
    "venv",
    "__pycache__",
    ".next",
    ".turbo",
    ".cache",
    ".pytest_cache",
    ".mypy_cache",
}


def _ext_for(path: Path) -> str:
    if path.name.lower() == "dockerfile":
        return "dockerfile"
    return path.suffix.lower()


def _looks_binary(data: bytes) -> bool:
    if not data:
        return False
    if b"\x00" in data:
        return True
    # crude heuristic: lots of non-text bytes
    text = sum(1 for b in data[:4096] if 9 <= b <= 13 or 32 <= b <= 126)
    return text / max(1, min(len(data), 4096)) < 0.75


def list_org_repos(org: str, token: str, repos: list[str] | None = None) -> list[RepoRef]:
    """
    Resolve repos for an org (and their default-branch head SHA) using GitHub API.
    If `repos` is provided, it must contain full names (owner/repo) and will be validated.
    """
    gh = Github(token)
    if repos:
        out: list[RepoRef] = []
        for full in repos:
            r = gh.get_repo(full)
            branch = r.default_branch or "main"
            sha = r.get_branch(branch).commit.sha
            out.append(RepoRef(full_name=r.full_name, default_branch=branch, commit_sha=sha))
        return out

    org_obj = gh.get_organization(org)
    out = []
    for r in org_obj.get_repos():
        branch = r.default_branch or "main"
        sha = r.get_branch(branch).commit.sha
        out.append(RepoRef(full_name=r.full_name, default_branch=branch, commit_sha=sha))
    return out


def _clone_url(full_name: str, token: str | None) -> str:
    if token:
        # Works for both public and private repos on GitHub-hosted.
        # We do not log this URL anywhere.
        return f"https://x-access-token:{token}@github.com/{full_name}.git"
    return f"https://github.com/{full_name}.git"


def shallow_clone(full_name: str, branch: str, token: str | None = None) -> Path:
    """
    Shallow clone a repo branch to a temp dir. Caller must delete returned path.
    """
    tmpdir = Path(tempfile.mkdtemp(prefix="compliance_repo_"))
    url = _clone_url(full_name, token)
    subprocess.run(
        ["git", "clone", "--depth", "1", "--branch", branch, url, str(tmpdir)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return tmpdir


def cleanup_clone(path: Path) -> None:
    shutil.rmtree(path, ignore_errors=True)


@dataclass(frozen=True)
class SourceFile:
    path: str  # repo-relative path
    language: str
    text: str


def iter_repo_files(
    repo_root: Path,
    *,
    max_file_bytes: int = DEFAULT_MAX_FILE_BYTES,
    allowed_exts: set[str] = DEFAULT_ALLOWED_EXTS,
    skip_dirs: set[str] = DEFAULT_SKIP_DIRS,
) -> Iterable[SourceFile]:
    """
    Walk a checked-out repo and yield text source files suitable for chunking.
    """
    repo_root = repo_root.resolve()
    for p in repo_root.rglob("*"):
        rel = p.relative_to(repo_root)
        if any(part in skip_dirs for part in rel.parts):
            continue
        if not p.is_file():
            continue
        ext = _ext_for(p)
        if ext not in allowed_exts:
            continue
        try:
            size = p.stat().st_size
        except OSError:
            continue
        if size <= 0 or size > max_file_bytes:
            continue
        try:
            data = p.read_bytes()
        except OSError:
            continue
        if _looks_binary(data):
            continue
        try:
            text = data.decode("utf-8", errors="replace")
        except Exception:
            continue
        yield SourceFile(path=str(rel), language=ext.lstrip(".") if ext != "dockerfile" else "dockerfile", text=text)


def chunk_text_by_lines(
    text: str,
    *,
    max_chars: int = 6000,
    overlap_lines: int = 10,
) -> list[dict]:
    """
    Chunk by line ranges to preserve stable line-based evidence anchors.
    Returns list of {text,start_line,end_line,chunk_index}.
    """
    lines = text.splitlines()
    chunks: list[dict] = []
    i = 0
    chunk_index = 0
    while i < len(lines):
        start = i
        buf = []
        n = 0
        while i < len(lines):
            line = lines[i]
            if n + len(line) + 1 > max_chars and buf:
                break
            buf.append(line)
            n += len(line) + 1
            i += 1
        end = i  # exclusive
        chunks.append(
            {
                "text": "\n".join(buf),
                "start_line": start + 1,
                "end_line": end,
                "chunk_index": chunk_index,
            }
        )
        chunk_index += 1
        if i >= len(lines):
            break
        i = max(0, end - overlap_lines)
    return chunks

