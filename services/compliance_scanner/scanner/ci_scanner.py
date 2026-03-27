from __future__ import annotations

import hashlib
import re
from pathlib import Path

from app.models.schemas import EvidenceLink

from .controls import Control, load_controls
from .findings import Finding, FindingStatus


def _fingerprint(control_id: str, path: str, line: int | None) -> str:
    h = hashlib.sha256(f"{control_id}|{path}|{line or 0}".encode("utf-8"))
    return h.hexdigest()[:32]


def _extract_terms(q: str) -> list[str]:
    # Split on whitespace and punctuation, keep meaningful tokens
    parts = re.split(r"[^a-zA-Z0-9_\-]+", q.lower())
    return [p for p in parts if len(p) >= 3]


def _find_first_match(text: str, terms: list[str]) -> tuple[int, str] | None:
    lines = text.splitlines()
    for i, line in enumerate(lines, 1):
        lo = line.lower()
        if any(t in lo for t in terms):
            return i, line.strip()[:240]
    return None


def scan_repo_lexical(
    *,
    repo_root: str | Path,
    controls_path: str | Path | None = None,
    max_files: int | None = None,
) -> list[Finding]:
    """
    Fast CI-mode scanner: lexical-only evidence discovery using control query terms.
    Produces compliant/non_compliant/unknown findings without embeddings/LLM.
    """
    root = Path(repo_root).resolve()
    controls: list[Control] = load_controls(controls_path)

    # Build a list of candidate files (small CI-friendly subset)
    files: list[Path] = []
    for p in root.rglob("*"):
        if p.is_file() and p.stat().st_size < 350_000:
            files.append(p)
            if max_files is not None and len(files) >= max_files:
                break

    findings: list[Finding] = []
    for control in controls:
        terms: list[str] = []
        for q in control.queries:
            terms.extend(_extract_terms(q.query))
        terms = sorted(set(terms))

        evidence_links: list[EvidenceLink] = []
        evidence_snippets: list[dict] = []
        for p in files:
            try:
                text = p.read_text(errors="ignore")
            except Exception:
                continue
            match = _find_first_match(text, terms)
            if not match:
                continue
            line_no, preview = match
            rel = str(p.relative_to(root))
            evidence_links.append(EvidenceLink(url=f"file://{p}", label=f"{rel}:{line_no}"))
            evidence_snippets.append({"path": rel, "start_line": line_no, "end_line": line_no, "preview": preview})
            break

        status = FindingStatus.unknown
        if evidence_links:
            status = FindingStatus.compliant
        else:
            # CI scanner can be opinionated: if there is no evidence found, mark non_compliant
            status = FindingStatus.non_compliant

        findings.append(
            Finding(
                control_id=control.id,
                control_title=control.title,
                status=status,
                confidence=70 if evidence_links else 60,
                summary="Lexical CI scan",
                gap_description="" if evidence_links else "No matching evidence found in repository text scan.",
                acceptance_criteria=control.acceptance_criteria,
                evidence_links=evidence_links,
                evidence_snippets=evidence_snippets,
                fingerprints={"primary": _fingerprint(control.id, evidence_snippets[0]["path"], evidence_snippets[0]["start_line"]) if evidence_snippets else _fingerprint(control.id, "", None)},
            )
        )
    return findings

