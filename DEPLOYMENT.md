# RegTranslate Deployment Guide

Production deployment for RegTranslate: frontend (Vercel) + backend (Docker / Railway / Render).

---

## Architecture

- **Frontend**: React SPA, deployed on Vercel
- **Backend**: FastAPI + ChromaDB + embeddings, requires persistent storage
- **API**: Frontend calls backend at `VITE_API_URL`

---

## 1. Frontend (Vercel)

Already configured. Deploy from GitHub:

```bash
vercel --prod
```

Or connect the repo in [vercel.com](https://vercel.com) and enable auto-deploy.

**Environment variables** (Vercel project settings):

| Variable        | Description                                      |
|-----------------|--------------------------------------------------|
| `VITE_API_URL`  | Backend API base URL, e.g. `https://api.yourapp.com/api` |

---

## 2. Backend Deployment Options

### Option A: Docker (self-hosted / VPS)

```bash
# Build and run
docker-compose up -d

# Backend at http://localhost:8000
# Health: GET /api/health
# Ready:  GET /api/ready
```

Required env vars in `.env`:
- `GROQ_API_KEY` (required for extraction)
- `CHROMA_PERSIST_DIR`, `AUDIT_LOG_DIR` (defaults work with Docker volumes)
- `CORS_ORIGINS` – set to your Vercel URL, e.g. `https://regtranslate.vercel.app`

### Option B: Railway

1. Create project, connect GitHub repo
2. Root: set to repo root
3. Build: `docker build -t regtranslate .` (or use Dockerfile)
4. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add env vars: `GROQ_API_KEY`, `CORS_ORIGINS`
6. Mount persistent volume for `/data` (ChromaDB, audit logs)

### Option C: Render

1. New Web Service, connect repo
2. Build: `pip install -r requirements.txt`
3. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add env vars
5. Use Render disk for `./chroma_db`, `./audit_logs`, etc.

---

## 3. Environment Variables (Backend)

| Variable                      | Required | Default                    | Notes                    |
|------------------------------|----------|----------------------------|--------------------------|
| `GROQ_API_KEY`               | Yes      | -                          | LLM extraction           |
| `GOOGLE_API_KEY`             | No       | -                          | Gemini fallback          |
| `CHROMA_PERSIST_DIR`         | No       | `./chroma_db`              | Vector DB storage        |
| `AUDIT_LOG_DIR`              | No       | `./audit_logs`             | Audit trail              |
| `CORS_ORIGINS`               | No       | `*`                        | Comma-separated origins  |
| `JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` | No | - | Jira export              |
| `GITHUB_REPO`, `GITHUB_TOKEN`| No       | -                          | GitHub export            |

---

## 4. Health & Readiness

- `GET /api/health` – Liveness (process running, returns version)
- `GET /api/ready` – Readiness (ChromaDB dir present)

Use these for k8s/load balancer health checks.

---

## 5. Checklist Before Go-Live

- [ ] Set `VITE_API_URL` in Vercel to your backend URL
- [ ] Set `CORS_ORIGINS` on backend to your Vercel domain(s)
- [ ] `GROQ_API_KEY` configured
- [ ] Persistent volume for ChromaDB and audit logs
- [ ] Jira/GitHub credentials if using export

---

## 6. Versioning

Version is read from `VERSION` at repo root. Update before release:

```bash
echo "1.0.1" > VERSION
```

Build/redeploy to pick up the new version.
