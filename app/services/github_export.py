"""GitHub Issues integration for exporting compliance tasks."""

from __future__ import annotations

import time

from app.models.schemas import ExtractionTask


def _regulation_label(citation: str) -> str:
    for prefix in ("HIPAA", "GDPR", "ADA", "WCAG", "FDA"):
        if prefix.upper() in (citation or "").upper():
            return prefix
    return "compliance"


def _format_body(t: ExtractionTask) -> str:
    parts = [t.description, ""]
    if t.acceptance_criteria:
        parts.append("## Acceptance criteria")
        for c in t.acceptance_criteria:
            parts.append(f"- [ ] {c}")
        parts.append("")
    parts.append("---")
    parts.append(f"**Source:** {t.source_citation}")
    if t.source_text:
        parts.append(f"\n> {t.source_text[:400]}{'...' if len(t.source_text) > 400 else ''}")
    if t.also_satisfies:
        parts.append("")
        parts.append("**Also satisfies:** " + ", ".join(t.also_satisfies))
    evidence = getattr(t, "evidence_links", None) or []
    if evidence:
        parts.append("")
        parts.append("**Evidence:**")
        for e in evidence:
            url = getattr(e, "url", "")
            label = getattr(e, "label", url) or url
            parts.append(f"- [{label}]({url})")
    return "\n".join(parts)


def export_to_github(
    tasks: list[ExtractionTask],
    repo_full_name: str,
    token: str,
    *,
    rate_limit_delay: float = 0.5,
) -> list[str]:
    """
    Create GitHub issues for the given tasks. Returns created issue URLs or numbers.

    repo_full_name: e.g. 'owner/repo'. Uses PyGithub. Optional rate_limit_delay between creates.
    """
    if not token or not repo_full_name:
        raise ValueError("GitHub token and repo (owner/name) required.")

    from github import Github

    gh = Github(token)
    repo = gh.get_repo(repo_full_name)
    created: list[str] = []
    for t in tasks:
        body = _format_body(t)
        labels = ["compliance", t.priority.lower()]
        reg = _regulation_label(t.source_citation)
        if reg != "compliance":
            labels.append(reg)
        try:
            issue = repo.create_issue(title=t.title, body=body, labels=labels)
            created.append(issue.html_url or str(issue.number))
        except Exception:
            raise
        if rate_limit_delay > 0:
            time.sleep(rate_limit_delay)
    return created
