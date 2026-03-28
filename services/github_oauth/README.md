# github_oauth

Standalone FastAPI app for GitHub OAuth and PAT sign-in. It writes the same `scanner_sid` session and `auth.sqlite` store as the main app and Compliance Scanner (see `COMPLIANCE_SCANNER_AUTH_DB` / default under `scan_history`).

## Run locally

From repo root (loads `REGTRANSLATE_ROOT/.env` via `main.py`):

```bash
python -m uvicorn services.github_oauth.main:app --reload --host 127.0.0.1 --port 9020
```

Set `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, and `GITHUB_OAUTH_REDIRECT_URI` (must match the callback URL registered on GitHub, default `http://127.0.0.1:9020/auth/github/callback`). Use `COMPLIANCE_SCANNER_SESSION_SECRET` for signing cookies.

With the React dev server, Vite proxies `/oauth` → `9020` so the browser keeps one origin for cookies (`vite.config.ts`).

## Endpoints

- `GET /health`
- `GET /auth/github/status`, `/auth/github/login`, `/auth/github/callback`
- `POST /auth/github/pat`, `/auth/github/disconnect`
- `GET /github/session`
