# RegTranslate — Development Guide

## Tech Stack

- **Backend:** Python 3.11+, FastAPI
- **LLM:** Groq API (Llama 3.3 70B)
- **Embeddings:** HuggingFace `sentence-transformers` (`all-MiniLM-L6-v2`), local
- **Vector DB:** ChromaDB (local, persistent)
- **Document processing:** pypdf
- **Frontend:** React (Vite + TypeScript), Streamlit (legacy)

## Project Structure

```
regtranslate/
├── app/
│   ├── main.py           # FastAPI app
│   ├── config.py         # Env config
│   ├── models/schemas.py
│   ├── services/         # pdf_processor, embeddings, vector_store, etc.
│   └── prompts/extraction.py
├── frontend/streamlit_app.py
├── react-ui/             # React UI
├── tests/
├── docs/
├── requirements.txt
└── .env.example
```

## Quick Start

### 1. Install

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment

```bash
cp .env.example .env
# Add GROQ_API_KEY (required for extraction and for Dashboard “Multi-step Q&A”, which uses ChatGroq + LangGraph on `/qa`)
# Optional: GOOGLE_API_KEY, CHROMA_PERSIST_DIR
#
# Tests: if pytest fails with `No module named 'langsmith.pytest_plugin'`, run:
#   chmod +x scripts/run_pytest.sh && ./scripts/run_pytest.sh tests/ -q
# or: `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest tests/ -q`
```

### 3. Run

**Backend + React UI (recommended)**

```bash
# Terminal 1
uvicorn app.main:app --reload

# Terminal 2
cd react-ui && npm install && npm run dev
# Open http://localhost:5173
```

**Streamlit UI**

```bash
streamlit run frontend/streamlit_app.py
```

### 4. Tests

```bash
pytest tests/ -v
```

## Pipeline

1. **PDF** → pypdf extract text, chunk (~4000 chars, 200 overlap)
2. **Embeddings** → sentence-transformers
3. **ChromaDB** → one collection per document
4. **RAG + LLM** → Groq (llama-3.3-70b-versatile), optional Gemini fallback
5. **Deduplication** → semantic similarity
6. **Export** → Jira, GitHub Issues, CSV

## Features

- Hero page, Dashboard, batch processing
- Task search/filter, bulk select
- Manual tasks, export presets
- Audit trail (§ 2.2.1), dark mode
- Regulation version tracking, Q&A, gap analysis

## Deployment

See [DEPLOYMENT.md](../DEPLOYMENT.md) in the repo root.
