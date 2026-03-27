from __future__ import annotations

import hashlib
import json
import re
from typing import Any

from app.models.schemas import EvidenceLink
from app.services import embeddings, llm_service, vector_store

from .controls import Control
from .findings import Finding, FindingStatus


def _permalink(repo_full_name: str, sha: str, path: str, start_line: int | None, end_line: int | None) -> str:
    base = f"https://github.com/{repo_full_name}/blob/{sha}/{path}"
    if start_line and end_line:
        if start_line == end_line:
            return f"{base}#L{start_line}"
        return f"{base}#L{start_line}-L{end_line}"
    return base


def _fingerprint(*parts: str) -> str:
    h = hashlib.sha256()
    for p in parts:
        h.update(p.encode("utf-8", errors="ignore"))
        h.update(b"\n")
    return h.hexdigest()[:32]


def _repair_json(raw: str) -> str:
    raw = re.sub(r",\s*([}\]])", r"\1", raw)
    return raw


def _extract_json_obj(raw: str) -> dict[str, Any]:
    raw = raw.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw)
    if m:
        raw = m.group(1).strip()
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start >= 0 and end > start:
        raw = raw[start:end]
    else:
        raise ValueError("No JSON object found in LLM output")

    last_err: json.JSONDecodeError | None = None
    for txt in (raw, _repair_json(raw)):
        try:
            return json.loads(txt)
        except json.JSONDecodeError as e:
            last_err = e
    try:
        import json_repair

        obj = json_repair.loads(raw)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass
    raise ValueError(f"Failed to parse JSON object: {last_err}") from last_err


def evaluate_control(
    *,
    control: Control,
    code_key: str,
    repo_full_name: str,
    commit_sha: str,
    n_results_per_query: int = 6,
) -> Finding:
    """
    Evaluate a control by retrieving candidate code evidence and asking the LLM to classify.
    """
    evidence: list[dict[str, Any]] = []
    for q in control.queries:
        q_emb = embeddings.embed_query(q.query)
        res = vector_store.query_codebase(key=code_key, query_embedding=q_emb, n_results=n_results_per_query, where=q.where)
        for r in res:
            meta = r.get("metadata") or {}
            evidence.append(
                {
                    "path": meta.get("path", ""),
                    "language": meta.get("language", ""),
                    "start_line": int(meta.get("start_line", 0) or 0) or None,
                    "end_line": int(meta.get("end_line", 0) or 0) or None,
                    "text": r.get("text", ""),
                }
            )

    # De-dupe by path/lines/text hash
    seen = set()
    uniq: list[dict[str, Any]] = []
    for e in evidence:
        k = (e.get("path"), e.get("start_line"), e.get("end_line"), hashlib.md5((e.get("text") or "").encode()).hexdigest())
        if k in seen:
            continue
        seen.add(k)
        uniq.append(e)
    evidence = uniq[:20]

    context = []
    for i, e in enumerate(evidence, 1):
        head = f"[{i}] {e.get('path')}:{e.get('start_line') or '?'}-{e.get('end_line') or '?'}"
        snippet = (e.get("text") or "")[:6000]
        context.append(f"{head}\n{snippet}")
    context_text = "\n\n---\n\n".join(context) if context else "(no evidence retrieved)"

    prompt = f"""You are a compliance engineer. Decide whether the code evidence satisfies the control.\n\nCONTROL_ID: {control.id}\nCONTROL_TITLE: {control.title}\nCONTROL_DESCRIPTION: {control.description}\n\nEVIDENCE_SNIPPETS:\n{context_text}\n\nReturn ONLY valid JSON (no markdown) with this schema:\n{{\n  \"status\": \"compliant\"|\"non_compliant\"|\"unknown\",\n  \"confidence\": 0-100,\n  \"summary\": \"...\",\n  \"gap_description\": \"...\", \n  \"acceptance_criteria\": [\"...\"],\n  \"evidence\": [\n    {{\"path\":\"...\",\"start_line\":1,\"end_line\":2,\"why\":\"...\"}}\n  ]\n}}\n\nRules:\n- If evidence is insufficient, choose \"unknown\".\n- If non_compliant/unknown, propose concrete acceptance criteria.\n- Evidence items must refer to the provided snippets.\n"""

    raw = llm_service.invoke_with_fallback([("system", "You output only valid JSON."), ("human", prompt)])
    obj = _extract_json_obj(raw)

    status = obj.get("status", "unknown")
    if status not in ("compliant", "non_compliant", "unknown"):
        status = "unknown"

    evidence_items = obj.get("evidence") or []
    links: list[EvidenceLink] = []
    ev_snips: list[dict[str, Any]] = []
    if isinstance(evidence_items, list):
        for it in evidence_items[:10]:
            if not isinstance(it, dict):
                continue
            path = str(it.get("path", "")).strip()
            if not path:
                continue
            sl = it.get("start_line")
            el = it.get("end_line")
            try:
                sl_i = int(sl) if sl is not None else None
                el_i = int(el) if el is not None else None
            except Exception:
                sl_i = None
                el_i = None
            url = _permalink(repo_full_name, commit_sha, path, sl_i, el_i)
            links.append(EvidenceLink(url=url, label=str(it.get("why", "")).strip()[:120]))
            ev_snips.append({"path": path, "start_line": sl_i, "end_line": el_i, "why": str(it.get("why", "")).strip()})

    acceptance = obj.get("acceptance_criteria")
    if not isinstance(acceptance, list) or not acceptance:
        acceptance = control.acceptance_criteria
    acceptance = [str(x).strip() for x in acceptance if str(x).strip()]

    finding = Finding(
        control_id=control.id,
        control_title=control.title,
        status=FindingStatus(status),
        confidence=obj.get("confidence") if isinstance(obj.get("confidence"), int) else None,
        summary=str(obj.get("summary", "")).strip(),
        gap_description=str(obj.get("gap_description", "")).strip(),
        acceptance_criteria=acceptance,
        evidence_links=links,
        evidence_snippets=ev_snips,
        fingerprints={
            "control": control.id,
            "primary": _fingerprint(control.id, repo_full_name, status, (links[0].url if links else "")),
        },
    )
    return finding

