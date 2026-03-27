from __future__ import annotations

import subprocess
import traceback
from datetime import datetime
from pathlib import Path

from app.services import embeddings, vector_store

from .code_ingest import chunk_text_by_lines, cleanup_clone, iter_repo_files, list_org_repos, shallow_clone
from .controls import Control, load_controls
from .evaluator import evaluate_control
from .findings import Finding, FindingStatus
from .models import RepoRef, ScanError, ScanRun, ScanStatus
from .persistence import get_run, mark_finished, mark_started, upsert_run
from .results import save_findings


def _git_head_sha(repo_dir: Path) -> str:
    out = subprocess.run(
        ["git", "-C", str(repo_dir), "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        check=True,
    )
    return out.stdout.strip()


def _update_counts(run: ScanRun, **kwargs) -> None:
    run.counts = run.counts.model_copy(update=kwargs)
    upsert_run(run)


def run_org_scan(
    *,
    run_id: str,
    github_token: str,
    controls_path: str | None = None,
    max_repos: int | None = None,
) -> list[Finding]:
    """
    Executes an org scan for a queued run. This is a synchronous runner; call it from a background task.
    """
    run = get_run(run_id)
    if not run:
        raise ValueError(f"Unknown run_id: {run_id}")

    mark_started(run_id)
    run = get_run(run_id) or run

    controls: list[Control] = load_controls(controls_path)
    _update_counts(run, controls_total=len(controls), controls_done=0)

    try:
        repos: list[RepoRef] = run.repos
        if not repos:
            repos = list_org_repos(run.org_source.org, github_token)
        if max_repos is not None:
            repos = repos[: max_repos]
        run.repos = repos
        run.counts.repos_total = len(repos)
        upsert_run(run)

        findings: list[Finding] = []

        for idx, repo in enumerate(repos, 1):
            # 1) Clone
            clone_dir = shallow_clone(repo.full_name, repo.default_branch, token=github_token)
            try:
                head_sha = _git_head_sha(clone_dir)
                repo = repo.model_copy(update={"commit_sha": head_sha})
                # 2) Chunk
                chunks: list[dict] = []
                file_count = 0
                for sf in iter_repo_files(clone_dir):
                    file_count += 1
                    for ch in chunk_text_by_lines(sf.text):
                        chunks.append(
                            {
                                "text": ch["text"],
                                "path": sf.path,
                                "language": sf.language,
                                "chunk_index": len(chunks),
                                "start_line": ch["start_line"],
                                "end_line": ch["end_line"],
                            }
                        )

                if not chunks:
                    run.counts.repos_done = idx
                    upsert_run(run)
                    continue

                # 3) Embed + store
                texts = [c["text"] for c in chunks]
                emb = embeddings.embed_texts(texts)
                code_key = f"{repo.full_name}@{head_sha}"
                vector_store.add_codebase(
                    key=code_key,
                    chunks=chunks,
                    embeddings=emb,
                    metadata={
                        "repo_full_name": repo.full_name,
                        "commit_sha": repo.commit_sha,
                        "default_branch": repo.default_branch,
                        "scan_run_id": run_id,
                    },
                )

                run.counts.files_indexed += file_count
                run.counts.chunks_indexed += len(chunks)
                upsert_run(run)

                # 4) Evaluate controls
                for c_idx, control in enumerate(controls, 1):
                    f = evaluate_control(
                        control=control,
                        code_key=code_key,
                        repo_full_name=repo.full_name,
                        commit_sha=repo.commit_sha,
                    )
                    findings.append(f)

                    run.counts.controls_done = c_idx
                    run.counts.findings_total = len(findings)
                    run.counts.findings_non_compliant = sum(1 for x in findings if x.status == FindingStatus.non_compliant)
                    run.counts.findings_unknown = sum(1 for x in findings if x.status == FindingStatus.unknown)
                    upsert_run(run)

            finally:
                cleanup_clone(clone_dir)

            run.counts.repos_done = idx
            upsert_run(run)

        save_findings(run_id, findings)
        mark_finished(run_id, ScanStatus.completed)
        return findings

    except Exception as e:
        run = get_run(run_id) or run
        run.status = ScanStatus.failed
        run.finished_at = datetime.utcnow()
        run.errors.append(ScanError(message=str(e), details={"traceback": traceback.format_exc()}))
        upsert_run(run)
        mark_finished(run_id, ScanStatus.failed)
        raise

