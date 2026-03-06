"""Jira REST API integration for exporting compliance tasks."""

from __future__ import annotations

import logging
from typing import Any

from app.config import (
    JIRA_API_TOKEN,
    JIRA_ASSIGNEE_BACKEND,
    JIRA_ASSIGNEE_DEVOPS,
    JIRA_ASSIGNEE_FRONTEND,
    JIRA_ASSIGNEE_SECURITY,
    JIRA_EMAIL,
    JIRA_SPRINT_FIELD_ID,
    JIRA_URL,
)

logger = logging.getLogger(__name__)
from app.models.schemas import ExtractionSubtask, ExtractionTask

PRIORITY_MAP = {"High": "Highest", "Medium": "Medium", "Low": "Low"}

# Map responsible_role from LLM to JIRA assignee accountId
ROLE_ASSIGNEE_MAP = {
    "Backend Engineer": JIRA_ASSIGNEE_BACKEND,
    "Frontend Engineer": JIRA_ASSIGNEE_FRONTEND,
    "DevOps": JIRA_ASSIGNEE_DEVOPS,
    "DevOps Engineer": JIRA_ASSIGNEE_DEVOPS,
    "Security": JIRA_ASSIGNEE_SECURITY,
    "Security Engineer": JIRA_ASSIGNEE_SECURITY,
}


def _get_assignee_for_role(role: str, overrides: dict[str, str] | None) -> str | None:
    """Resolve assignee accountId from responsible_role. overrides from UI take precedence."""
    if overrides:
        r = (role or "").strip()
        if r in overrides and overrides[r]:
            return overrides[r]
    normalized = (role or "").strip()
    return ROLE_ASSIGNEE_MAP.get(normalized) or ROLE_ASSIGNEE_MAP.get(
        normalized.replace(" Engineer", "")
    )


def _format_subtask_description(subtask: ExtractionSubtask) -> str:
    """Format subtask description for JIRA."""
    if subtask.description:
        return subtask.description
    return ""


def _format_description(t: ExtractionTask) -> str:
    """PM-quality description: Context, Acceptance Criteria, Technical Notes, Source."""
    parts = [
        "h2. Context",
        "",
        t.description,
        "",
    ]
    if t.acceptance_criteria:
        parts.extend(["h3. Acceptance Criteria", ""])
        for c in t.acceptance_criteria:
            parts.append(f"* {c}")
        parts.append("")
    if t.penalty_risk:
        parts.extend(["h3. Compliance Risk", "", t.penalty_risk, ""])
    parts.extend(["h3. Technical Notes", ""])
    parts.append(f"*Responsible:* {t.responsible_role}")
    if t.also_satisfies:
        parts.append(f"*Also satisfies:* {', '.join(t.also_satisfies)}")
    parts.extend(["", "h3. Regulatory Source", ""])
    parts.append(f"*Citation:* {t.source_citation}")
    if t.source_text:
        parts.append(f"*Quote:* {t.source_text[:600]}{'...' if len(t.source_text) > 600 else ''}")
    evidence = getattr(t, "evidence_links", None) or []
    if evidence:
        parts.extend(["", "h3. Evidence", ""])
        for e in evidence:
            url = getattr(e, "url", "")
            label = getattr(e, "label", url) or url
            parts.append(f"* [{label}|{url}]")
    return "\n".join(parts)


def _jira_agile_request(
    method: str,
    path: str,
    *,
    url: str | None = None,
    email: str | None = None,
    api_token: str | None = None,
    json_body: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Make a request to JIRA Agile REST API."""
    import requests
    from requests.auth import HTTPBasicAuth

    base_url = (url or JIRA_URL).rstrip("/")
    auth_email = email or JIRA_EMAIL
    token = api_token or JIRA_API_TOKEN
    if not base_url or not auth_email or not token:
        raise ValueError("Jira URL, email, and API token required.")
    full_url = f"{base_url}{path}"
    kwargs: dict[str, Any] = {
        "auth": HTTPBasicAuth(auth_email, token),
        "headers": {"Accept": "application/json", "Content-Type": "application/json"},
        "timeout": 30,
    }
    if json_body:
        kwargs["json"] = json_body
    resp = requests.request(method, full_url, **kwargs)
    resp.raise_for_status()
    if resp.status_code == 204:
        return None
    return resp.json()


def fetch_active_sprints(
    board_id: int | str,
    *,
    url: str | None = None,
    email: str | None = None,
    api_token: str | None = None,
) -> list[dict[str, Any]]:
    """
    Fetch sprints for a board. Use board_id from your board URL (e.g. .../boards/123).
    Returns list of {id, name, state} for each sprint.
    """
    data = _jira_agile_request(
        "GET",
        f"/rest/agile/1.0/board/{board_id}/sprint",
        url=url,
        email=email,
        api_token=api_token,
    )
    sprints = (data or {}).get("values", [])
    return [
        {"id": s["id"], "name": s.get("name", ""), "state": s.get("state", "")}
        for s in sprints
    ]


def create_sprint(
    board_id: int | str,
    name: str,
    *,
    url: str | None = None,
    email: str | None = None,
    api_token: str | None = None,
    goal: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict[str, Any]:
    """
    Create a new sprint on the board. Returns {id, name, state, ...}.
    Use board_id from your board URL (e.g. .../boards/42).
    """
    from datetime import datetime, timedelta, timezone

    bid = int(board_id) if isinstance(board_id, str) and str(board_id).isdigit() else board_id
    body: dict[str, Any] = {"name": name, "originBoardId": bid}
    if goal:
        body["goal"] = goal
    if start_date:
        body["startDate"] = start_date
    if end_date:
        body["endDate"] = end_date
    if not start_date and not end_date:
        # Default: 2-week sprint starting today (ISO format for JIRA)
        now = datetime.now(timezone.utc)
        end = now + timedelta(days=14)
        body["startDate"] = now.strftime("%Y-%m-%dT09:00:00.000+00:00")
        body["endDate"] = end.strftime("%Y-%m-%dT17:00:00.000+00:00")
    data = _jira_agile_request(
        "POST",
        "/rest/agile/1.0/sprint",
        url=url,
        email=email,
        api_token=api_token,
        json_body=body,
    )
    if not data:
        raise ValueError("Failed to create sprint")
    return data


def start_sprint(
    sprint_id: int | str,
    *,
    url: str | None = None,
    email: str | None = None,
    api_token: str | None = None,
) -> dict[str, Any] | None:
    """Start a sprint (set state to active) so issues appear on the board. Uses partial update."""
    sid = int(sprint_id) if isinstance(sprint_id, str) and str(sprint_id).isdigit() else sprint_id
    return _jira_agile_request(
        "POST",
        f"/rest/agile/1.0/sprint/{sid}",
        url=url,
        email=email,
        api_token=api_token,
        json_body={"state": "active"},
    )


def get_or_create_sprint(
    board_id: int | str,
    *,
    url: str | None = None,
    email: str | None = None,
    api_token: str | None = None,
    sprint_name: str | None = None,
    start_after_create: bool = True,
) -> int:
    """
    Get an active or future sprint, or create one if none exists.
    Returns sprint ID to use for adding issues.
    If start_after_create=True and we create a new sprint, starts it so tasks appear on the board.
    """
    from datetime import datetime, timezone

    sprints = fetch_active_sprints(board_id, url=url, email=email, api_token=api_token)
    # Prefer active, then future
    for state in ("active", "future"):
        for s in sprints:
            if s.get("state") == state:
                return int(s["id"])
    # No active/future sprint — create one
    name = sprint_name or f"RegTranslate Compliance {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    created = create_sprint(
        board_id,
        name,
        url=url,
        email=email,
        api_token=api_token,
        goal="HIPAA compliance tasks from RegTranslate",
    )
    sid = int(created["id"])
    if start_after_create:
        try:
            start_sprint(sid, url=url, email=email, api_token=api_token)
            logger.info("Started sprint id=%s", sid)
        except Exception as e:
            logger.warning("Could not start sprint %s: %s", sid, e)
    return sid


def _regulation_label(citation: str) -> str:
    """Derive a short label from source_citation (e.g. 'GDPR' from 'GDPR Article 32')."""
    for prefix in ("HIPAA", "GDPR", "ADA", "WCAG", "FDA"):
        if prefix.upper() in (citation or "").upper():
            return prefix
    return "compliance"


def export_to_jira(
    tasks: list[ExtractionTask],
    project_key: str,
    *,
    url: str | None = None,
    email: str | None = None,
    api_token: str | None = None,
    sprint_id: int | str | None = None,
    board_id: int | str | None = None,
    auto_create_sprint: bool = False,
    sprint_field_id: str | None = None,
    assignee_overrides: dict[str, str] | None = None,
) -> list[str]:
    """
    Create Jira issues for the given tasks. Returns created issue keys.

    Uses basic_auth (email, API token). Provide url/email/api_token or use config defaults.
    - sprint_id: Add issues to this sprint (visible on board).
    - board_id: Required for auto_create_sprint. From URL .../boards/42.
    - auto_create_sprint: If True and no sprint_id, gets active/future sprint or creates one.
    - sprint_field_id: Sprint custom field (default customfield_10020 for JIRA Cloud)
    - assignee_overrides: Map role -> accountId for auto-assignment
    """
    base_url = (url or JIRA_URL).rstrip("/")
    auth_email = email or JIRA_EMAIL
    token = api_token or JIRA_API_TOKEN
    if not base_url or not auth_email or not token:
        raise ValueError("Jira URL, email, and API token required. Set in .env or pass explicitly.")
    if not project_key:
        raise ValueError("Jira project key required.")

    # Resolve sprint: use provided sprint_id, or auto-create if requested
    resolved_sprint_id: int | None = None
    if sprint_id is not None:
        try:
            resolved_sprint_id = int(sprint_id) if isinstance(sprint_id, str) and str(sprint_id).isdigit() else int(sprint_id)
        except (ValueError, TypeError):
            pass
    elif auto_create_sprint and board_id is not None:
        resolved_sprint_id = get_or_create_sprint(
            board_id,
            url=url,
            email=email,
            api_token=api_token,
        )
        logger.info("Auto-created/selected sprint id=%s", resolved_sprint_id)

    from jira import JIRA

    jira = JIRA(server=base_url, basic_auth=(auth_email, token))
    keys: list[str] = []
    sprint_field = sprint_field_id or JIRA_SPRINT_FIELD_ID

    for t in tasks:
        reg = _regulation_label(t.source_citation)
        fields: dict[str, Any] = {
            "project": {"key": project_key},
            "summary": t.title,
            "description": _format_description(t),
            "issuetype": {"name": "Task"},
            "labels": ["compliance", reg, "ai-pm", "hipaa-compliance" if "HIPAA" in reg.upper() else reg.lower()],
        }
        priority = PRIORITY_MAP.get(t.priority, "Medium")
        try:
            fields["priority"] = {"name": priority}
        except Exception:
            pass

        # Auto-assign by responsible_role (Backend Engineer -> assignee, etc.)
        assignee_id = _get_assignee_for_role(t.responsible_role, assignee_overrides)
        if assignee_id:
            fields["assignee"] = {"accountId": assignee_id}

        # Add to sprint so tasks appear on board (not just backlog)
        if resolved_sprint_id is not None and sprint_field:
            fields[sprint_field] = resolved_sprint_id

        try:
            parent_issue = jira.create_issue(fields=fields)
        except Exception as e:
            err_str = str(e).lower()
            for key in ["priority", "assignee", sprint_field]:
                fields.pop(key, None)
            try:
                parent_issue = jira.create_issue(fields=fields)
            except Exception:
                raise e
        keys.append(parent_issue.key)

        # Create subtasks linked to parent (visible on JIRA board)
        for st in t.subtasks:
            sub_fields: dict[str, Any] = {
                "project": {"key": project_key},
                "summary": st.title,
                "parent": {"key": parent_issue.key},
                "issuetype": {"name": "Sub-task"},
                "labels": ["compliance", reg, "ai-pm"],
            }
            if st.description:
                sub_fields["description"] = st.description
            # Assign subtask to same engineer as parent
            if assignee_id:
                sub_fields["assignee"] = {"accountId": assignee_id}
            try:
                sub_issue = jira.create_issue(sub_fields)
                keys.append(sub_issue.key)
            except Exception as e:
                err_str = str(e).lower()
                if "subtask" in err_str or "sub-task" in err_str or "issue type" in err_str:
                    sub_fields.pop("assignee", None)
                    try:
                        sub_fields["issuetype"] = {"name": "Subtask"}
                        sub_issue = jira.create_issue(sub_fields)
                        keys.append(sub_issue.key)
                    except Exception:
                        logger.warning("Could not create subtask %s: %s", st.title, e)
                else:
                    raise
    return keys
