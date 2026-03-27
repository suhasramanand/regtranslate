"""LangGraph multi-step compliance Q&A (RAG tools + Groq tool-calling).

Requires GROQ_API_KEY (same as extraction). Tracing (e.g. LangSmith) is not configured.

Typical env:
  GROQ_API_KEY   — required for ChatGroq tool loop
  GROQ_MODEL     — optional; defaults from app.config
"""

from __future__ import annotations

import logging
import operator
import time
from typing import Annotated, Any, Literal, Sequence, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from app.config import GROQ_API_KEY, GROQ_MODEL, GROQ_TEMPERATURE
from app.services import embeddings, vector_store
from app.services.qa_agent import QA_SYSTEM

logger = logging.getLogger(__name__)

AGENT_TOOL_GUIDE = """
You can call tools when helpful, then answer.

- Use **search_regulation** when you need citations or text from the uploaded PDF.
- Use **get_workspace_summary** when the question is about tasks, coverage, exports, or the current dashboard.

After enough evidence, respond with a direct **final answer** (no more tool calls) using Markdown per the system rules.
"""


def _format_workspace(screen_context: dict | None) -> str:
    if not screen_context:
        return "No workspace context was provided in this session."
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
    return "\n".join(lines) + "\n"


def _run_search(doc_id: str, query: str, n_results: int) -> tuple[str, list[dict]]:
    if not doc_id:
        return "No regulatory document is loaded. Ask the user to upload a PDF first.", []
    n_results = max(1, min(int(n_results), 20))
    try:
        q_emb = embeddings.embed_query(query)
        results = vector_store.query(doc_id, q_emb, n_results=n_results)
    except Exception as e:
        logger.exception("search_regulation failed")
        return f"Retrieval failed: {e}", []

    if not results:
        return "No matching passages found for that query.", []

    parts: list[str] = []
    sources: list[dict] = []
    for r in results:
        meta = r.get("metadata") or {}
        text = (r.get("text") or "")[:2000]
        page = meta.get("page", "?")
        section = meta.get("section", "")
        header = f"[Page {page}" + (f", {section}]" if section else "]")
        parts.append(f"{header}\n{text}")
        sources.append(
            {"text": text[:300] + "..." if len(text) > 300 else text, "page": page, "section": section}
        )
    return "\n\n---\n\n".join(parts), sources


def _make_tools(doc_id: str, screen_context: dict | None):
    @tool
    def search_regulation(query: str, n_results: int = 8) -> str:
        """Search the uploaded regulation PDF for passages relevant to the query. Use for citations and policy text."""
        text, _src = _run_search(doc_id, query, n_results)
        return text

    @tool
    def get_workspace_summary() -> str:
        """Summarize tasks, RAG coverage, and recent exports from the current workspace / dashboard."""
        return _format_workspace(screen_context)

    return [search_regulation, get_workspace_summary]


def _summarize_tool_args(name: str, args: dict[str, Any]) -> str:
    if name == "search_regulation":
        q = (args.get("query") or "")[:120]
        n = args.get("n_results", 8)
        return f"query={q!r}, n_results={n}"
    if name == "get_workspace_summary":
        return "(no args)"
    return str(list(args.keys()))


def _new_chat_groq(**kwargs: Any) -> Any:
    """Lazy import so loading this module does not require langchain_groq/Pydantic to agree at import time."""
    from langchain_groq import ChatGroq

    return ChatGroq(**kwargs)


def _dedupe_sources(sources: list[dict]) -> list[dict]:
    seen: set[tuple[Any, Any, str]] = set()
    out: list[dict] = []
    for s in sources:
        key = (s.get("page"), s.get("section"), (s.get("text") or "")[:80])
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    return out


class QAAgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    doc_id: str
    screen_context: dict | None
    sources: Annotated[list[dict], operator.add]
    step_log: Annotated[list[dict], operator.add]
    tool_rounds: int


def _build_graph(tools: list, max_tool_rounds: int):
    model_base = _new_chat_groq(
        model=GROQ_MODEL,
        temperature=GROQ_TEMPERATURE,
        api_key=GROQ_API_KEY,
    )

    def call_model(state: QAAgentState) -> dict[str, Any]:
        rounds = state["tool_rounds"]
        if rounds >= max_tool_rounds:
            llm = model_base
        else:
            llm = model_base.bind_tools(tools)
        out = llm.invoke(list(state["messages"]))
        return {"messages": [out]}

    def run_tools(state: QAAgentState) -> dict[str, Any]:
        last = state["messages"][-1]
        if not isinstance(last, AIMessage) or not last.tool_calls:
            return {}
        msgs: list[ToolMessage] = []
        new_steps: list[dict] = []
        new_sources: list[dict] = []
        base_idx = len(state["step_log"])
        for i, tc in enumerate(last.tool_calls):
            name = tc.get("name") or ""
            tid = tc.get("id") or f"call_{i}"
            args = tc.get("args") or {}
            if isinstance(args, str):
                args = {}
            new_steps.append(
                {
                    "step": base_idx + i + 1,
                    "tool": name,
                    "detail": _summarize_tool_args(name, args),
                    "ts": time.time(),
                }
            )
            try:
                if name == "search_regulation":
                    content, srcs = _run_search(
                        state["doc_id"],
                        str(args.get("query") or ""),
                        int(args.get("n_results") or 8),
                    )
                    new_sources.extend(srcs)
                elif name == "get_workspace_summary":
                    content = _format_workspace(state["screen_context"])
                else:
                    content = f"Unknown tool: {name}"
            except Exception as e:
                logger.exception("tool %s failed", name)
                content = f"Tool error: {e}"
            msgs.append(ToolMessage(content=str(content)[:8000], tool_call_id=str(tid)))
        return {
            "messages": msgs,
            "step_log": new_steps,
            "sources": new_sources,
            "tool_rounds": state["tool_rounds"] + 1,
        }

    def route_after_agent(state: QAAgentState) -> Literal["tools", "__end__"]:
        last = state["messages"][-1]
        if (
            isinstance(last, AIMessage)
            and last.tool_calls
            and state["tool_rounds"] < max_tool_rounds
        ):
            return "tools"
        return END

    g = StateGraph(QAAgentState)
    g.add_node("agent", call_model)
    g.add_node("tools", run_tools)
    g.add_edge(START, "agent")
    g.add_conditional_edges("agent", route_after_agent, {"tools": "tools", END: END})
    g.add_edge("tools", "agent")
    return g.compile()


def run_qa_agent(
    doc_id: str,
    question: str,
    screen_context: dict | None = None,
    max_agent_steps: int = 8,
) -> dict[str, Any]:
    """
    Run LangGraph tool loop; return same keys as classic Q&A plus agent_steps.

    agent_steps: list of {step, tool, detail, ts}
    """
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is required for agentic Q&A (ChatGroq).")

    max_tool_rounds = max(1, min(int(max_agent_steps), 20))
    tools = _make_tools(doc_id, screen_context)
    graph = _build_graph(tools, max_tool_rounds)

    system = f"{QA_SYSTEM}\n\n{AGENT_TOOL_GUIDE}"
    initial: QAAgentState = {
        "messages": [SystemMessage(content=system), HumanMessage(content=question)],
        "doc_id": doc_id,
        "screen_context": screen_context,
        "sources": [],
        "step_log": [],
        "tool_rounds": 0,
    }
    limit = min(50, 3 + max_tool_rounds * 4)
    final = graph.invoke(initial, config={"recursion_limit": limit})

    messages = final["messages"]
    answer = ""
    for m in reversed(messages):
        if isinstance(m, AIMessage) and m.content:
            # content may be str or list parts
            c = m.content
            if isinstance(c, str):
                answer = c.strip()
            else:
                answer = str(c).strip()
            break

    if not answer:
        answer = "I could not produce a final answer. Try rephrasing or check document/work context."

    sources = _dedupe_sources(list(final.get("sources") or []))
    steps = list(final.get("step_log") or [])

    return {
        "answer": answer,
        "sources": sources,
        "agent_steps": steps,
    }
