# Changelog

All notable changes to RegTranslate are documented here.

## [1.0.0] - 2025-03-06

### Added
- PDF upload and processing with pypdf extraction
- RAG + LLM task extraction (Groq Llama 3.3 70B, optional Gemini fallback)
- ChromaDB vector store with sentence-transformers embeddings
- React dashboard: upload, extract, review, export
- Jira and GitHub Issues export
- CSV export, saved presets
- Manual task templates (Security review, Accessibility audit, Audit logging)
- Gap analysis between requirements and implemented tasks
- Compliance Q&A with source citations
- Regulation version tracking and content-change detection
- Confidence calibration (thumbs up/down feedback)
- Audit trail (§ 2.2.1) tamper-evident log viewer
- Dark mode
- Flow demo page (Timeline + React Flow graph views)
- Vercel deployment for frontend
- Branch protection, CODEOWNERS
- Proprietary license (All Rights Reserved)

### Tech
- Backend: FastAPI, Python 3.11+
- Frontend: React, Vite, TypeScript
- LLM: Groq API
- Embeddings: sentence-transformers (local)
- Vector DB: ChromaDB
