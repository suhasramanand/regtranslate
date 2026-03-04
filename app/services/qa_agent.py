"""Compliance Q&A agent using RAG + LLM."""

from __future__ import annotations

from app.services import embeddings, llm_service, vector_store

QA_SYSTEM = """You are a regulatory compliance expert. Answer the user's question based ONLY on the provided regulatory text chunks. Be concise and cite the exact section when possible. If the chunks do not contain relevant information, say so."""


def answer_question(doc_id: str, question: str, n_chunks: int = 8) -> dict:
    """
    Answer a compliance question using RAG over the document.
    Returns {answer: str, sources: list[{text, page, section}]}.
    """
    q_emb = embeddings.embed_query(question)
    results = vector_store.query(doc_id, q_emb, n_results=n_chunks)
    if not results:
        return {
            "answer": "No relevant content found for this document. Please process a regulatory PDF first.",
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

    context = "\n\n---\n\n".join(context_parts)
    prompt = f"Context from regulatory document:\n\n{context}\n\nQuestion: {question}\n\nAnswer based on the context:"
    messages = [("system", QA_SYSTEM), ("human", prompt)]
    answer = llm_service.invoke_with_fallback(messages)
    return {"answer": answer.strip(), "sources": sources}
