# RegTranslate Product Requirements Document (PRD)

**Document version:** 1.2  
**Last updated:** 2026-03-27  
**Product:** RegTranslate — regulatory document to engineering work  

---

## 1. Executive summary

RegTranslate helps regulated teams turn dense policy PDFs into structured, traceable engineering work. The product combines document ingestion, semantic retrieval (RAG), large language model (LLM) extraction, human review in a web UI, and export to work-tracking systems. A companion **Compliance Scanner** service maps code repositories to control catalogs and produces findings suitable for CI and review.

**Agentic direction (product intent):** the product should move beyond a passive ChatGPT-style chat window. Users set **goals**; the system **plans, reasons, calls tools, observes results, and iterates** until the goal is achieved or blocked—with clear audit of steps and human approval where actions are sensitive (exports, ticket creation, org-wide scan triggers). See Section 3.3.

This PRD describes **current shipped capabilities** (Section 5), a consolidated **feature backlog** you intend to implement (Section 8), and supporting goals, personas, and metrics.

---

## 2. Problem statement

- Regulatory text is long, cross-referenced, and hard to operationalize into backlogs.
- Teams need **citations** and **coverage signals** so legal and engineering can trust automation.
- Outputs must fit existing tools (Jira, GitHub Issues) without duplicating work or losing auditability.

---

## 3. Goals and non-goals

### 3.1 Goals

- Reduce time from PDF publication to actionable, prioritized tasks.
- Preserve **source traceability** (pages, sections, citations).
- Support **multi-document** extraction and deduplication where configured.
- Offer **Q&A** over the active regulation and workspace context, evolving toward **goal-driven agents** that execute product capabilities (Section 3.3).
- Provide a path from **controls** to **code evidence** (scanner).
- Maintain a professional **marketing and auth** experience in the React UI.

### 3.2 Non-goals (current)

- Fully automated legal sign-off or certification.
- Replacing customer-owned policy interpretation without human review.
- Guaranteed completeness of extraction without user validation of RAG coverage.

### 3.3 Agentic automation — what “agentic” means here

**In scope:** an **outcome-driven** assistant, not chat for its own sake.

- **Think / reason:** decompose a user goal into steps, choose strategies when retrieval is thin or ambiguous, and explain tradeoffs in structured summaries (not only free-form prose).
- **Act / execute:** invoke **real capabilities** as tools—RAG search, run or preview extraction, assemble export payloads, trigger scanner jobs (where allowed), query workspace state—not just return text that *describes* what someone could do manually.
- **Observe / adjust:** read tool outputs (chunk lists, task counts, API errors), **retry or branch** (e.g. reformulate query, widen `k`, switch document) until success criteria or limits are hit.
- **Finish:** produce a **verifiable outcome**—e.g. draft tasks ready for review, export package staged with diff summary, scan run id with SARIF link—plus a short “what was done / what was blocked” report.
- **Govern:** guardrails on steps, budgets (time, tokens, max tool calls), and **approval gates** for irreversible or customer-visible actions (create tickets, post to Slack, destructive resets).

**Explicitly not the target:** a single-turn Q&A façade that only *sounds* helpful without executing the product’s own APIs toward a concrete goal.

---

## 4. Personas

- **Compliance / GRC lead:** Uploads regulations, checks coverage, curates tasks, cares about audit logs and exports.
- **Engineering lead:** Prioritizes tasks, exports to Jira/GitHub, may run scanner on repos.
- **Developer:** Consumes tasks and scanner findings; may use Q&A for clarification.
- **Admin / DevOps:** Configures API keys, reset/clear data, deploys services.

---

## 5. Current product capabilities

### 5.1 Core pipeline (FastAPI main app)

| Capability | Description |
|------------|-------------|
| Health / readiness | `GET /health`, `GET /ready` (Chroma directory check). |
| PDF upload and indexing | `POST /process` — PyPDF chunking, embeddings (sentence-transformers), ChromaDB storage; returns `doc_id`, chunk count, sample retrieval. |
| RAG coverage (no LLM) | `GET /process/{doc_id}/coverage` — quick test for pages/sections coverage. |
| Task extraction | `POST /extract` — RAG + LLM JSON extraction; multi-`doc_ids` with deduplication; optional `product_context`, `rag_query`, `return_coverage`; confidence calibration from feedback. |
| Jira export | `POST /export/jira` — push selected tasks to Jira. |
| GitHub export | `POST /export/github` — push selected tasks to GitHub Issues. |
| Config helpers | `GET /config/jira`, `GET /config/export` — prepopulate UI from environment. |
| Regulation versioning | `GET /regulation/versions`, `POST /regulation/check-update`, `POST /regulation/check-content-change` — version and change awareness. |
| Compliance Q&A | `POST /qa` — RAG + LLM answers; optional `screen_context` (tasks, coverage, exports). |
| Gap analysis | `POST /gap-analysis` — cross-regulation task overlap/unique analysis. |
| Calibration | `POST /calibration/feedback`, `GET /calibration/stats` — user feedback on extraction quality. |
| Export history | `GET /history/export` — historical export events. |
| Audit APIs | `POST /audit/log`, `GET /audit/logs`, `GET /audit/verify`, `POST /audit/retention`, `GET /audit/alerts`, `POST /audit/alerts/run`, `GET /audit/reviews`, `POST /audit/reviews` — audit-oriented endpoints. |
| Password policy (compliance) | `GET /compliance/password-policy`, `POST /compliance/validate-password`. |
| Demo flow animation | `GET /demo/flow-stages` — staged pipeline description for UI demo. |
| Data reset | `POST /settings/reset-all` — clear app data (destructive). |

### 5.2 LLM and RAG implementation

- **LLM:** Groq (primary) with optional Google Gemini fallback via `app/services/llm_service.py`.
- **Embeddings / store:** sentence-transformers + ChromaDB (`app/services/embeddings.py`, `vector_store.py`).
- **Extraction:** `app/services/task_generator.py` — retrieval, structured JSON parsing, repair paths for malformed JSON.

### 5.3 React UI (react-ui)

| Area | Description |
|------|-------------|
| Marketing landing | Hero, FAQ (including frameworks, repo scanning, integrations, Jira customization, security), Compliance Scanner entry, theme toggle. |
| Routes | `/`, `/login`, `/dashboard`, `/scanner`, `/scanner/app` (authenticated), marketing docs (`/about`, `/blog`, `/careers`, `/contact`, `/privacy`, `/terms`, `/security`, `/status`, `/changelog`). |
| Dashboard | PDF workflow, extraction, Jira/GitHub export, Q&A (`qaAsk`), gap analysis, calibration, guided demo query param, theme. |
| Scanner landing | Product story for Compliance Scanner; links to app. |
| Scanner app | Authenticated scanner experience (GitHub/session flows per `api.ts`). |
| Footer | Shared marketing footer with theme-aware tokens (`MarketingFooter`). |

### 5.4 Compliance Scanner (separate service)

- **Purpose:** Org-wide and CI-oriented scanning; code ingest, control catalog, evaluator LLM or lexical CI path, SARIF/results persistence.
- **Run:** Uvicorn app under `services/compliance_scanner` (see `services/compliance_scanner/README.md`).
- **Storage:** Run history (e.g. `services/scan_history/runs.json`, configurable).
- **Integrations:** GitHub-oriented dev flows; GitLab mentioned in marketing FAQ as part of future/positioning alignment.

### 5.5 Additional surfaces

- **Streamlit** frontend (`frontend/streamlit_app.py`) for alternate/demo workflows.
- **CI / workflow:** Example GitHub workflow for compliance scan (repository root).

---

## 6. User stories (representative)

1. As a compliance lead, I upload a HIPAA PDF and confirm RAG coverage hits the sections I care about before extracting tasks.
2. As an engineer, I filter high-priority tasks and export them to my Jira project without retyping acceptance criteria.
3. As a reviewer, I ask Q&A how many tasks we extracted and what coverage looks like using screen context.
4. As a security-minded admin, I use audit-related APIs and password validation where enabled.
5. As a developer, I sign in to the scanner app and review findings tied to repository paths.

---

## 7. Non-functional requirements

- **Security:** No secrets in client bundles; tokens server-side; CORS configured via `app/config.py`.
- **Observability:** Logging in Python services; audit endpoints for enterprise-style tracking.
- **Performance:** Extraction and embedding scale with PDF size; scanner bounded by repo size and controls count.
- **Accessibility:** UI targets readable typography and keyboard-friendly patterns (ongoing improvement).

---

## 8. Feature backlog — intended implementations

Use this section as the master list of work to ship. Checkbox convention: `- [ ]` not started, `- [x]` done (update when features reach Section 5). Remove or re-scope items as priorities change.

### 8.1 AI: goal-driven agent (plan, reason, execute, verify)

Architecture target: **orchestration graph** (e.g. LangGraph) with **tools**, **state**, and **stop conditions**—aligned with Section 3.3, not a chat-only wrapper.

- [ ] **Goal-oriented API** — accept a **user objective** (natural language + optional structured hints: doc_ids, repos, targets) in addition to legacy `/qa`-style questions; return **final artifacts** (summaries, task IDs list, staged export metadata) plus **run status** (`completed` / `blocked` / `needs_approval`).
- [ ] **Planner node** — turn objective into a short ordered plan; revise plan when tool output invalidates assumptions.
- [ ] **Tool layer (execute)** — bind first-class tools: `search_regulation`, `get_workspace_context`, `run_extract` (or dry-run variant), `prepare_export` (build payload without send), later `trigger_scan` / `get_scan_results`—each implemented as calls into existing services, not duplicated logic.
- [ ] **Reflection / verifier node** — after critical steps, check success criteria (e.g. coverage threshold, JSON validity, citation presence) and loop or escalate.
- [ ] **Approval gates** — interrupt graph before side effects (create Jira/GitHub/GitLab issues, Slack post, production scanner) until user or policy confirms; resume with same thread/checkpoint where supported.
- [ ] **LangGraph (or equivalent) runtime** — checkpointing optional; strict **max steps**, **timeouts**, and **per-tool** budgets to control cost and runaway loops.
- [ ] **Agent run audit log** — every plan revision, tool invocation (name, redacted args, outcome snippet), and human approval event—returned in API and surfaced in UI for trust and demos.
- [ ] **Session / thread memory** — persist conversation and intermediate state so multi-turn goals (“now export those to Jira project X”) continue without restating context.
- [ ] **Eval harness** — scenario tests where the expected outcome is **state change + structured output**, not only BLEU-style answer similarity.

Legacy **single-shot** `/qa` remains available for simple questions without invoking the full agent loop.

### 8.2 Integrations: work tracking and comms (FAQ-aligned)

Marketing and product promise broad integration; backlog tracks real connectors.

- [ ] **GitLab Issues export** — parity with GitHub Issues from Dashboard (`POST /export/gitlab` or unified export API); PAT/token handling consistent with security model.
- [ ] **Linear export** — create/update issues from extracted tasks; field mapping.
- [ ] **Slack** — post export summaries, scanner run results, or alerts (incoming webhooks / bot app); configurable channels.
- [ ] **Outbound webhooks** — signed HTTP callbacks for “extraction complete”, “export done”, “scan finished”; payload schema versioned for custom pipelines.
- [ ] **Jira / GitHub export hardening** — field-mapping UI, templates per project, clearer duplicate-export warnings using export history.

### 8.3 Enterprise identity and lifecycle

- [ ] **SAML 2.0 SSO** — IdP-initiated and SP-initiated flows; map assertions to app users.
- [ ] **SCIM provisioning** — user and group create/update/disable for SSO tenants.
- [ ] **Org / tenant model** — if multi-customer cloud: isolation for docs, vectors, scanner runs, and audit logs (depends on hosting strategy).

### 8.4 Compliance Scanner service

- [ ] **GitLab scan targets** — read-only token; repo selection UX aligned with GitHub flows.
- [ ] **CI integration depth** — SARIF upload to GitHub/GitLab Security tab; fail/warn thresholds; baseline diff between runs.
- [ ] **Control catalog UX** — org-level or repo-level packs; import/export YAML; version pinning.
- [ ] **Trace matrix** — link regulation extraction tasks to scanner control IDs and findings (cross-surface traceability).
- [ ] **Scanner analytics** — run history UI: trends, flaky controls, time-to-remediate (uses existing run persistence).

### 8.5 Core pipeline and regulation lifecycle

- [ ] **Scheduled regulation checks** — optional job to re-fetch sources and surface content/ version deltas (extends existing version/check APIs).
- [ ] **Smarter chunking** — tables, appendices, or domain-specific chunk rules for long standards (evaluate per customer).
- [ ] **Multi-language PDFs** — detect language; optional translated summary layer (policy decision).

### 8.6 Product UX and trust

- [ ] **Dashboard: integration setup wizards** — validate tokens, test issue create, show scope summary.
- [ ] **Audit UI** — read-only views over `/audit/*` data for compliance leads (not API-only).
- [ ] **Marketing / scanner polish** — mobile layout passes; loading and empty states; accessibility audit on key flows.
- [ ] **Documentation site** — developer API docs (OpenAPI-derived) and deployment runbooks linked from app.

### 8.7 Platform, security, and compliance posture

- [ ] **Customer-managed keys (CMK)** — encrypt data at rest where applicable (cloud roadmap).
- [ ] **Data residency** — region-pinned deployments or storage (cloud roadmap).
- [ ] **Rate limiting and abuse controls** — API quotas per tenant/key for public or partner deployments.

---

## 9. Success metrics (suggested)

- Time from upload to first export.
- User-reported calibration accuracy trend.
- Q&A usage rate and qualitative feedback.
- Scanner adoption: runs per week, findings triaged to done.

---

## 10. Dependencies and assumptions

- Valid **GROQ_API_KEY** (and optional **GOOGLE_API_KEY**) for LLM features.
- **ChromaDB** persistence path available and writable.
- For exports: Jira/GitHub credentials configured where those features are used.
- Compliance Scanner may require **GITHUB_TOKEN** or OAuth/PAT flows depending on deployment.

---

## 11. Open questions

- Single vs multi-tenant deployment model for enterprise SSO (see Section 8.3).
- Data residency and customer-managed keys for cloud offerings (Section 8.7).
- Ordering: which Section 8 items ship as core vs enterprise-only add-ons.

---

## 12. Document maintenance

- Update this PRD when major API or UI modules change.
- Source of truth for API behavior: `app/main.py` and service packages.
- Regenerate the PDF via `python scripts/render_prd_pdf.py` after substantive edits.

---

*End of PRD*
