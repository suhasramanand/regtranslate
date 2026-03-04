"""Compliance Q&A agent using RAG + LLM. Also answers questions about the current screen state."""

from __future__ import annotations

from app.services import embeddings, llm_service, vector_store

QA_SYSTEM = """You are a regulatory compliance expert assistant. You can answer two types of questions:

1) **Regulation questions**: Answer based on the provided regulatory text chunks. Be concise and cite exact sections (e.g. § 2.4.1). If the chunks don't contain relevant info, say so.

2) **Screen/workspace questions**: Answer based on the provided "Current workspace context" (tasks, coverage, regulation name, exports, etc.). Examples: "How many tasks did we extract?", "What's the coverage?", "What tasks are high priority?", "What did we export to Jira?"

For exports: recent_exports lists each export EVENT (each time the user clicked Export). Multiple entries mean the user exported multiple times — this can create duplicate Jira tickets if the same tasks were selected again. "Duplicate exports" = multiple export events, not duplicate tasks within a single export. To check for duplicate tickets, compare the Jira keys (e.g. REG-1, REG-2) across export events.

Use whichever context is relevant to the question. If both apply, use both.

FORMAT your response using Markdown:
- Use ## for section headings
- Use bullet points for lists
- Use **bold** for key terms
- Keep citations inline (e.g. § 2.4.1)"""


def answer_question(doc_id: str, question: str, n_chunks: int = 8, screen_context: dict | None = None) -> dict:
    """
    Answer a compliance question using RAG over the document.
    Returns {answer: str, sources: list[{text, page, section}]}.
    """
    results = []
    if doc_id:
        try:
            q_emb = embeddings.embed_query(question)
            results = vector_store.query(doc_id, q_emb, n_results=n_chunks)
        except Exception:
            results = []
    if not results and not screen_context:
        return {
            "answer": "No document context available. Process a regulatory PDF first, or ask about the current workspace (tasks, coverage, exports).",
            "sources": [],
        }

    context_parts = []
    sources = []
    for r in results:
        meta = r.get("metadata") or {}
        text = (r.get("text") or "")[:2000]
        page = meta.get("page", "?")
        section = meta.get("section", "")
        context_parts.append(f"[Page {page}" + (f", {section}]" if section else "]") + f"\n{text}")
        sources.append({"text": text[:300] + "..." if len(text) > 300 else text, "page": page, "section": section})

    reg_context = "\n\n---\n\n".join(context_parts) if context_parts else "No regulatory document chunks provided."
    screen_block = ""
    if screen_context:
        lines = ["Current workspace context:"]
        if screen_context.get("regulation_name"):
            lines.append(f"- Regulation: {screen_context['regulation_name']}")
        if screen_context.get("task_count") is not None:
            lines.append(f"- Extracted tasks: {screen_context['task_count']}")
        if screen_context.get("tasks"):
            tasks = screen_context["tasks"]
            for i, t in enumerate(tasks[:20], 1):
                title = t.get("title", str(t))[:80]
                prio = t.get("priority", "")
                lines.append(f"  {i}. {title}" + (f" ({prio})" if prio else ""))
            if len(tasks) > 20:
                lines.append(f"  ... and {len(tasks) - 20} more")
        if screen_context.get("coverage"):
            c = screen_context["coverage"]
            lines.append(f"- Coverage: {c.get('chunk_count', '?')} chunks, {c.get('pages_summary', '')}")
            if c.get("sections"):
                lines.append(f"  Sections: {', '.join(str(s) for s in c['sections'][:10])}")
        if screen_context.get("recent_exports"):
            for i, e in enumerate(screen_context["recent_exports"][:5], 1):
                target = e.get("target", "")
                count = e.get("task_count", 0)
                proj = e.get("project_key", "")
                keys = e.get("keys") or []
                parts = [f"Export {i}: {target} - {count} tasks"]
                if proj:
                    parts.append(f"project={proj}")
                if keys:
                    k = ", ".join(keys[:10])
                    if len(keys) > 10:
                        k += f", +{len(keys) - 10} more"
                    parts.append(f"keys=[{k}]")
                lines.append("- " + ", ".join(parts))
        screen_block = "\n\n" + "\n".join(lines) + "\n\n"
    prompt = f"Context from regulatory document:\n\n{reg_context}\n\n{screen_block}Question: {question}\n\nAnswer:"
    messages = [("system", QA_SYSTEM), ("human", prompt)]
    answer = llm_service.invoke_with_fallback(messages)
    return {"answer": answer.strip(), "sources": sources}
