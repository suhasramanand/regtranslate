"""Automated alerting and review workflows for audit logs (weekly/monthly review; § 2.2.2)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from app.request_user import get_rt_user
from app.services.audit_models import AuditLogEntry, AuditReviewRecord
from app.services import audit_log
from app.user_paths import user_audit_log_dir


def _alerts_file():
    return user_audit_log_dir(get_rt_user()) / "alerts.jsonl"


def _reviews_file():
    return user_audit_log_dir(get_rt_user()) / "reviews.jsonl"


def _high_risk_actions() -> set[str]:
    return {"delete", "bulk_export", "admin_access", "login_failure"}


def _suspicious_patterns(entries: list[AuditLogEntry]) -> list[dict]:
    """Detect suspicious patterns: after-hours, many failures, same IP many users."""
    alerts = []
    by_user: dict[str, list[AuditLogEntry]] = {}
    by_ip: dict[str, list[AuditLogEntry]] = {}
    failures = []
    for e in entries:
        by_user.setdefault(e.user_id, []).append(e)
        by_ip.setdefault(e.source_ip, []).append(e)
        if e.action == "login_failure":
            failures.append(e)
    # Many login failures
    if len(failures) >= 5:
        alerts.append({
            "type": "multiple_login_failures",
            "count": len(failures),
            "message": f"{len(failures)} login failures detected",
            "entry_ids": [e.entry_hash for e in failures[:20]],
        })
    # Same IP, many distinct users (possible shared/compromised IP)
    for ip, list_e in by_ip.items():
        users = {e.user_id for e in list_e}
        if len(users) >= 10 and len(list_e) >= 20:
            alerts.append({
                "type": "same_ip_many_users",
                "source_ip": ip,
                "users": len(users),
                "events": len(list_e),
                "message": f"IP {ip}: {len(users)} users, {len(list_e)} events",
            })
    # High-risk actions
    for e in entries:
        if e.action in _high_risk_actions():
            alerts.append({
                "type": "high_risk_action",
                "action": e.action,
                "user_id": e.user_id,
                "resource": e.resource_accessed,
                "timestamp": e.timestamp,
                "entry_hash": e.entry_hash,
            })
    return alerts


def run_automated_alerts(entries: list[AuditLogEntry] | None = None) -> list[dict]:
    """Generate alerts for suspicious patterns. Append to ALERTS_FILE."""
    if entries is None:
        entries = audit_log.list_entries(limit=2000)
    alerts = _suspicious_patterns(entries)
    for a in alerts:
        a["id"] = str(uuid.uuid4())
        a["generated_at"] = datetime.now(timezone.utc).isoformat()
        with open(_alerts_file(), "a") as f:
            f.write(json.dumps(a) + "\n")
    return alerts


def get_high_risk_entries(limit: int = 100) -> list[AuditLogEntry]:
    """Entries that are high-risk for weekly manual review."""
    all_entries = audit_log.list_entries(limit=limit * 2)
    high = _high_risk_actions()
    return [e for e in all_entries if e.action in high][:limit]


def save_review_record(record: AuditReviewRecord) -> None:
    """Append a weekly or monthly review record (findings + remediation)."""
    line = json.dumps(record.model_dump()) + "\n"
    with open(_reviews_file(), "a") as f:
        f.write(line)


def list_review_records(limit: int = 50) -> list[AuditReviewRecord]:
    """List recent review records."""
    rv = _reviews_file()
    if not rv.exists():
        return []
    records = []
    with open(rv) as f:
        for line in f:
            if not line.strip():
                continue
            try:
                d = json.loads(line)
                records.append(AuditReviewRecord(**d))
            except Exception:
                continue
    records.reverse()
    return records[:limit]


def list_alerts(limit: int = 100) -> list[dict]:
    """List recent alerts."""
    af = _alerts_file()
    if not af.exists():
        return []
    alerts = []
    with open(af) as f:
        for line in f:
            if not line.strip():
                continue
            try:
                alerts.append(json.loads(line))
            except Exception:
                continue
    alerts.reverse()
    return alerts[:limit]
