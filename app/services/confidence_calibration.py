"""Confidence calibration from user feedback."""

from __future__ import annotations

import json
from pathlib import Path

_CALIB_DIR = Path(__file__).resolve().parents[1].parent / "calibration"
_CALIB_DIR.mkdir(parents=True, exist_ok=True)
FEEDBACK_FILE = _CALIB_DIR / "feedback.json"
MAX_ENTRIES = 2000


def _load() -> list[dict]:
    if not FEEDBACK_FILE.exists():
        return []
    try:
        data = json.loads(FEEDBACK_FILE.read_text())
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _save(entries: list[dict]) -> None:
    FEEDBACK_FILE.write_text(json.dumps(entries, indent=2))


def _task_key(task_id: str, title: str) -> str:
    """Create a stable key for calibration lookup."""
    return f"{task_id}:{title[:80]}"


def submit_feedback(
    task_id: str,
    title: str,
    correct: bool,
) -> None:
    """Record user feedback (correct/incorrect) for a task."""
    entries = _load()
    key = _task_key(task_id, title)
    entries.append(
        {
            "task_key": key,
            "task_id": task_id,
            "title": title[:200],
            "correct": correct,
        }
    )
    _save(entries[-MAX_ENTRIES:])


def get_calibrated_confidence(
    task_id: str,
    title: str,
    raw_confidence: int | None,
) -> int | None:
    """
    Return confidence adjusted by feedback history.
    Uses simple averaging: if we have feedback, blend raw with feedback ratio.
    """
    entries = _load()
    key = _task_key(task_id, title)
    feedbacks = [e for e in entries if e.get("task_key") == key]
    if not feedbacks:
        return raw_confidence

    correct_count = sum(1 for e in feedbacks if e.get("correct") is True)
    total = len(feedbacks)
    feedback_score = int(100 * correct_count / total) if total else 50

    if raw_confidence is None:
        return feedback_score
    # Blend: 60% raw, 40% feedback
    return int(0.6 * raw_confidence + 0.4 * feedback_score)


def get_stats() -> dict:
    """Return calibration statistics."""
    entries = _load()
    by_key: dict[str, list[bool]] = {}
    for e in entries:
        k = e.get("task_key", "")
        if k:
            by_key.setdefault(k, []).append(e.get("correct", False))

    total_feedback = len(entries)
    tasks_with_feedback = len(by_key)
    avg_accuracy = (
        sum(sum(v) / len(v) for v in by_key.values()) / tasks_with_feedback
        if tasks_with_feedback else 0.0
    )
    return {
        "total_feedback_entries": total_feedback,
        "tasks_with_feedback": tasks_with_feedback,
        "average_accuracy": round(avg_accuracy, 2),
    }
