# RegTranslate

AI-powered tool that converts regulatory documents (HIPAA, GDPR, ADA/WCAG, FDA 21 CFR Part 11) into developer-ready tasks exportable to Jira/GitHub.

## Tech Stack

- **Backend:** Python 3.11+, FastAPI  
- **LLM:** Groq API (Llama 3.1 70B) via LangChain  
- **Embeddings:** HuggingFace `sentence-transformers` (`all-MiniLM-L6-v2`), local  
- **Vector DB:** ChromaDB (local, persistent)  
- **Document processing:** pypdf  
- **Frontend:** Streamlit (legacy) + React (Vite + TypeScript)

## React UI Features

- **Hero page** — Problem statement, FAQ, Get started CTA
- **Dashboard** — Upload PDF → Extract tasks → Review → Export to Jira/GitHub
- **Batch processing** — Multiple PDFs at once
- **Task search/filter** — By priority, confidence
- **Bulk select** — Select all, deselect all, high priority only
- **Manual tasks** — Add tasks with templates (Security review, Accessibility audit, Audit logging)
- **Export** — Jira, GitHub, CSV; saved presets
- **Dark mode** — Theme toggle
- **Audit trail** — Tamper-evident log viewer (§ 2.2.1)
- **Keyboard shortcuts** — Ctrl+Shift+E: Extract, Ctrl+Shift+S: Export Jira

## Quick Start

### 1. Create venv and install deps

```bash
cd regtranslate
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment

```bash
cp .env.example .env
# Edit .env: add GROQ_API_KEY (required for LLM extraction later).
# Optional: GOOGLE_API_KEY (Gemini fallback), CHROMA_PERSIST_DIR.
```

### 3. Verify PDF → Embeddings → ChromaDB pipeline

**Option A: Streamlit UI**

```bash
# From project root (regtranslate/)
streamlit run frontend/streamlit_app.py
```

- Select regulation type, upload a PDF, click **Process Document**.  
- You should see chunk count and sample query results.  
- The first run downloads the `all-MiniLM-L6-v2` embedding model (~90MB).

**Option B: FastAPI + React UI (recommended)**

```bash
# Terminal 1: Start the API
uvicorn app.main:app --reload

# Terminal 2: Start the React UI
cd react-ui && npm install && npm run dev
# Open http://localhost:5173 — hero page → Get started → dashboard
# Upload PDF, extract tasks, edit, export to Jira/GitHub
```

**Option C: FastAPI (curl)**

```bash
uvicorn app.main:app --reload
# POST /process with PDF + ?regulation_name=GDPR
curl -X POST "http://127.0.0.1:8000/process?regulation_name=GDPR" \
  -F "file=@/path/to/regulation.pdf"
```

### 4. Run tests

```bash
pytest tests/ -v
```

### 5. Optional: generate a sample PDF for testing

```bash
python scripts/create_sample_pdf.py   # creates sample.pdf
curl -X POST "http://127.0.0.1:8000/process?regulation_name=GDPR" -F "file=@sample.pdf"
```

## Project Structure

```
regtranslate/
├── app/
│   ├── main.py           # FastAPI app
│   ├── config.py         # Env config
│   ├── models/schemas.py # Pydantic models
│   ├── services/
│   │   ├── pdf_processor.py
│   │   ├── embeddings.py
│   │   ├── vector_store.py
│   │   └── ...
│   └── prompts/extraction.py
├── frontend/streamlit_app.py
├── react-ui/                 # React UI (hero page, dashboard)
├── tests/test_pipeline.py
├── requirements.txt
└── .env.example
```

## Pipeline

1. **PDF** → pypdf extract text, chunk (≈1000 tokens / 4000 chars, 200 overlap).  
2. **Embeddings** → `sentence-transformers` `all-MiniLM-L6-v2`.  
3. **ChromaDB** → one collection per document, store chunks + metadata (page, section, regulation).  
4. **RAG + LLM** → Groq (`llama-3.3-70b-versatile`) via official SDK; optional Gemini fallback.  
5. **Deduplication** → semantic similarity (embeddings), merge clusters into tasks with `also_satisfies`.  
6. **Export** → Jira (basic_auth) or GitHub Issues (PyGithub). CSV export, saved presets.

7. **Audit (§ 2.2.2)** — ePHI audit logs: tamper-evident (hash chain), 6-year retention, automated alerts for suspicious patterns, weekly high-risk review and monthly comprehensive review with documented findings and remediation.  

## License

All Rights Reserved. Proprietary — see [LICENSE](LICENSE) for full terms.
