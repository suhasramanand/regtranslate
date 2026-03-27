"""ChromaDB vector store for regulatory document chunks."""

from __future__ import annotations

import hashlib
from typing import Any

from app.config import CHROMA_CODE_PERSIST_DIR, CHROMA_PERSIST_DIR


def _chroma_client():
    """Chroma client for regulation / document chunks (lazy init)."""
    import chromadb
    from chromadb.config import Settings

    return chromadb.PersistentClient(
        path=str(CHROMA_PERSIST_DIR),
        settings=Settings(anonymized_telemetry=False),
    )


def _chroma_code_client():
    """Chroma client for compliance scanner code chunks (separate SQLite schema on disk)."""
    import chromadb
    from chromadb.config import Settings

    return chromadb.PersistentClient(
        path=str(CHROMA_CODE_PERSIST_DIR),
        settings=Settings(anonymized_telemetry=False),
    )


_client = None
_code_client = None


def _get_client():
    global _client
    if _client is None:
        _client = _chroma_client()
    return _client


def _get_code_client():
    global _code_client
    if _code_client is None:
        _code_client = _chroma_code_client()
    return _code_client


def reset_client() -> None:
    """Clear cached ChromaDB clients. Call after resetting persist directories."""
    global _client, _code_client
    _client = None
    _code_client = None


def _collection_name(doc_id: str) -> str:
    """Sanitize doc_id for use as Chroma collection name."""
    return "rt_" + "".join(c if c.isalnum() or c in "-_" else "_" for c in doc_id)


def _code_collection_name(key: str) -> str:
    """
    Map a logical code key (e.g. \"owner/repo@sha\") to a Chroma collection name.

    Chroma requires names of 3-63 characters, [A-Za-z0-9_-], start/end alphanumeric.
    Long keys must be hashed so repo@commit identifiers stay stable but fit the limit.
    """
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:32]
    return f"rtc{digest}"


def add_document(
    doc_id: str,
    chunks: list[dict[str, Any]],
    embeddings: list[list[float]],
    metadata: dict[str, Any],
) -> None:
    """
    Store document chunks in a ChromaDB collection (one per regulation doc).

    chunks: list of {"text": str, "page": int, "section": str, "chunk_index": int}
    embeddings: parallel list of embedding vectors
    metadata: shared fields, e.g. regulation_name, source file
    """
    client = _get_client()
    name = _collection_name(doc_id)
    try:
        coll = client.get_collection(name=name)
    except Exception:
        coll = client.create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )

    ids = [f"{doc_id}_chunk_{c['chunk_index']}" for c in chunks]
    documents = [c["text"] for c in chunks]
    metadatas = []
    for c in chunks:
        m = {**metadata, "page": c["page"], "section": c.get("section", ""), "chunk_index": c["chunk_index"]}
        metadatas.append({k: (v if isinstance(v, (str, int, float, bool)) else str(v)) for k, v in m.items()})

    coll.upsert(ids=ids, documents=documents, embeddings=embeddings, metadatas=metadatas)


def add_codebase(
    *,
    key: str,
    chunks: list[dict[str, Any]],
    embeddings: list[list[float]],
    metadata: dict[str, Any],
) -> str:
    """
    Store code chunks in a ChromaDB collection (one per repo@sha or scan key).

    chunks: list of {"text": str, "path": str, "chunk_index": int, "start_line": int, "end_line": int, "language": str}
    metadata: shared fields, e.g. org, repo_full_name, commit_sha, scan_run_id
    Returns the created collection name.
    """
    client = _get_code_client()
    name = _code_collection_name(key)
    try:
        coll = client.get_collection(name=name)
    except Exception:
        coll = client.create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )

    ids = [f"{name}_chunk_{c['chunk_index']}" for c in chunks]
    documents = [c["text"] for c in chunks]
    metadatas = []
    for c in chunks:
        m = {
            **metadata,
            "path": c.get("path", ""),
            "language": c.get("language", ""),
            "chunk_index": c["chunk_index"],
            "start_line": c.get("start_line", 0),
            "end_line": c.get("end_line", 0),
        }
        metadatas.append({k: (v if isinstance(v, (str, int, float, bool)) else str(v)) for k, v in m.items()})

    coll.upsert(ids=ids, documents=documents, embeddings=embeddings, metadatas=metadatas)
    return name


def query_codebase(
    *,
    key: str,
    query_embedding: list[float],
    n_results: int = 5,
    where: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """
    Query a code collection by key. Returns list of {text, metadata}.
    """
    client = _get_code_client()
    name = _code_collection_name(key)
    try:
        coll = client.get_collection(name=name)
    except Exception:
        return []

    total = coll.count()
    if total == 0:
        return []

    kwargs: dict[str, Any] = {}
    if where:
        kwargs["where"] = where

    results = coll.query(
        query_embeddings=[query_embedding],
        n_results=min(n_results, total),
        include=["documents", "metadatas"],
        **kwargs,
    )
    out = []
    docs = results.get("documents", [[]])[0] or []
    metas = results.get("metadatas", [[]])[0] or []
    for d, m in zip(docs, metas):
        out.append({"text": d, "metadata": m or {}})
    return out


def query(
    doc_id: str,
    query_embedding: list[float],
    n_results: int = 5,
) -> list[dict[str, Any]]:
    """
    Query ChromaDB for relevant chunks. Returns list of {text, metadata}.
    """
    client = _get_client()
    name = _collection_name(doc_id)
    try:
        coll = client.get_collection(name=name)
    except Exception:
        return []

    total = coll.count()
    if total == 0:
        return []

    results = coll.query(
        query_embeddings=[query_embedding],
        n_results=min(n_results, total),
        include=["documents", "metadatas"],
    )
    out = []
    docs = results.get("documents", [[]])[0] or []
    metas = results.get("metadatas", [[]])[0] or []
    for d, m in zip(docs, metas):
        out.append({"text": d, "metadata": m or {}})
    return out


def get_doc_metadata(doc_id: str) -> dict[str, Any] | None:
    """Return metadata (e.g. regulation_name, source) from the document's collection."""
    client = _get_client()
    name = _collection_name(doc_id)
    try:
        coll = client.get_collection(name=name)
    except Exception:
        return None
    n = coll.count()
    if n == 0:
        return None
    res = coll.get(limit=1, include=["metadatas"])
    metas = res.get("metadatas") or []
    if not metas:
        return None
    m = metas[0] or {}
    return {k: v for k, v in m.items() if k not in ("chunk_index", "page", "section")}


def delete_collection(doc_id: str) -> None:
    """Remove the collection for the given document."""
    client = _get_client()
    name = _collection_name(doc_id)
    try:
        client.delete_collection(name=name)
    except Exception:
        pass
