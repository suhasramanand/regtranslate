"""Tests for LangGraph Q&A path (mocked LLM; no real Groq)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from app.main import app
from app.services import qa_agent_graph


@pytest.fixture
def client():
    return TestClient(app)


@patch.object(qa_agent_graph, "GROQ_API_KEY", "test-groq-key")
@patch.object(qa_agent_graph, "_new_chat_groq")
def test_run_qa_agent_tool_then_answer(mock_chat_factory):
    """Two model calls: first returns tool call, second returns final text."""
    llm = MagicMock()
    mock_chat_factory.return_value = llm

    def bind_tools(_tools):
        return llm

    llm.bind_tools = bind_tools

    def invoke(_messages):
        if not hasattr(invoke, "n"):
            invoke.n = 0
        invoke.n += 1
        if invoke.n == 1:
            return AIMessage(
                content="",
                tool_calls=[{"name": "get_workspace_summary", "args": {}, "id": "call-1"}],
            )
        return AIMessage(content="## Result\nWorkspace summarized.")

    llm.invoke = invoke

    out = qa_agent_graph.run_qa_agent(
        "doc-1",
        "How many tasks?",
        screen_context={"task_count": 3, "regulation_name": "HIPAA"},
        max_agent_steps=8,
    )
    assert "Result" in out["answer"]
    assert "agent_steps" in out
    assert len(out["agent_steps"]) >= 1
    assert out["agent_steps"][0]["tool"] == "get_workspace_summary"


@patch.object(qa_agent_graph, "vector_store")
@patch.object(qa_agent_graph, "embeddings")
def test_run_search_returns_sources(mock_emb, mock_vs):
    mock_emb.embed_query.return_value = [0.1]
    mock_vs.query.return_value = [
        {"text": "encryption required", "metadata": {"page": 3, "section": "2.1"}},
    ]
    text, srcs = qa_agent_graph._run_search("d1", "encryption", 5)
    assert "encryption required" in text
    assert len(srcs) == 1
    assert srcs[0].get("page") == 3


def test_dedupe_sources():
    s = [
        {"page": 1, "section": "a", "text": "foo"},
        {"page": 1, "section": "a", "text": "foo"},
        {"page": 2, "section": "a", "text": "bar"},
    ]
    d = qa_agent_graph._dedupe_sources(s)
    assert len(d) == 2


@patch("app.services.qa_agent_graph.run_qa_agent")
def test_api_qa_use_agent(mock_run, client):
    mock_run.return_value = {
        "answer": "agent ok",
        "sources": [],
        "agent_steps": [{"step": 1, "tool": "get_workspace_summary", "detail": "(no args)", "ts": 0.0}],
    }
    import app.config

    with patch.object(app.config, "GROQ_API_KEY", "test-key"):
        r = client.post(
            "/qa",
            json={
                "doc_id": "d",
                "question": "q",
                "use_agent": True,
                "max_agent_steps": 99,
            },
        )
    assert r.status_code == 200
    data = r.json()
    assert data["answer"] == "agent ok"
    assert data["agent_steps"][0]["tool"] == "get_workspace_summary"
    mock_run.assert_called_once()
    assert mock_run.call_args.kwargs["max_agent_steps"] == 20


def test_api_qa_use_agent_no_key(client):
    import app.config

    with patch.object(app.config, "GROQ_API_KEY", ""):
        r = client.post("/qa", json={"doc_id": "d", "question": "q", "use_agent": True})
    assert r.status_code == 503
