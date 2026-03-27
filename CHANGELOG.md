# Changelog

All notable changes to RegTranslate are documented here.

## [Unreleased] - 2026-03-27

### Added
- Compliance scanner service (FastAPI, Docker, controls catalog, SARIF and JSON findings export)
- GitHub session authentication, session store, and CI workflow for repository scans
- React scanner landing and scanner pages, dashboard routing, and auth gating (`RequireAuth`, `GithubSessionGate`)
- Optional LangGraph-based Q&A agent path (dashboard toggle, mocked tests)
- Signup page, auth redirect helper, and dashboard path utilities for scanner navigation
- Marketing layout, footer, and PRD markdown (`docs/PRD.md`)
- Scripts: compliance scanner dev helper, PRD PDF render helper, pytest helper
- Tests for compliance scanner CLI, session store, and QA agent

### Changed
- Vector store: hashed code collection names; separate `CHROMA_CODE_PERSIST_DIR` for scanner code embeddings (avoids legacy `chroma_db` schema conflicts)
- GitHub OAuth/session (SSL via certifi), user-owned repo listing for scanner
- Vector store service and frontend API client updates for new flows
- Hero page, dashboard, login, and global styles; favicon and demo recorder tweaks
- Dependencies: Python requirements (incl. `httpx` pin for TestClient) and React/Vite stack updates

### Removed
- Standalone flow demo page (timeline/React Flow views) in favor of the scanner experience

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
