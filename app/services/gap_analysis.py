"""Cross-regulation gap analysis."""

from __future__ import annotations

from typing import Any

from app.services import embeddings

SIM_THRESHOLD = 0.82


def _cosine_sim(a: list[float], b: list[float]) -> float:
    na = sum(x * x for x in a) ** 0.5
    nb = sum(x * x for x in b) ** 0.5
    if na <= 0 or nb <= 0:
        return 0.0
    return sum(x * y for x, y in zip(a, b)) / (na * nb)


def analyze_gaps(
    tasks_a: list[dict[str, Any]],
    tasks_b: list[dict[str, Any]],
    label_a: str = "A",
    label_b: str = "B",
    threshold: float = SIM_THRESHOLD,
) -> dict[str, Any]:
    """
    Compare two sets of tasks (e.g. from different regulations).
    Returns overlap (similar in both), unique_to_a, unique_to_b.
    """
    if not tasks_a and not tasks_b:
        return {"overlap": [], "unique_to_a": [], "unique_to_b": [], "label_a": label_a, "label_b": label_b}

    texts_a = [f"{t.get('title','')} {t.get('description','')}" for t in tasks_a]
    texts_b = [f"{t.get('title','')} {t.get('description','')}" for t in tasks_b]

    vecs_a = embeddings.embed_texts(texts_a) if texts_a else []
    vecs_b = embeddings.embed_texts(texts_b) if texts_b else []

    overlap: list[dict] = []
    matched_b: set[int] = set()

    for i, (ta, va) in enumerate(zip(tasks_a, vecs_a)):
        best_j = -1
        best_sim = threshold
        for j, (tb, vb) in enumerate(zip(tasks_b, vecs_b)):
            if j in matched_b:
                continue
            s = _cosine_sim(va, vb)
            if s > best_sim:
                best_sim = s
                best_j = j
        if best_j >= 0:
            matched_b.add(best_j)
            overlap.append({
                "task_a": ta,
                "task_b": tasks_b[best_j],
                "similarity": round(best_sim, 3),
            })

    unique_to_a = [tasks_a[i] for i in range(len(tasks_a)) if not any(o["task_a"] == tasks_a[i] for o in overlap)]
    unique_to_b = [tasks_b[j] for j in range(len(tasks_b)) if j not in matched_b]

    return {
        "overlap": overlap,
        "unique_to_a": unique_to_a,
        "unique_to_b": unique_to_b,
        "label_a": label_a,
        "label_b": label_b,
    }
