# compliance_scanner

Separate service for org-wide and CI compliance scanning.

## Run locally

From repo root (so `.env` is found; the app also loads `REGTRANSLATE_ROOT/.env` explicitly):

```bash
python -m uvicorn services.compliance_scanner.main:app --reload --host 127.0.0.1 --port 9010
```

GitHub OAuth and PAT login run on a **separate** service (port **9020** by default). Start it with `python -m uvicorn services.github_oauth.main:app --host 127.0.0.1 --port 9020` (see `services/github_oauth/README.md`). With Vite, `/oauth` is proxied to 9020. OAuth env vars live in the same repo `.env` (see `.env.example`).

### Use GitHub CLI for auth (recommended local dev)

Log in once:

```bash
gh auth login
```

Start the API with `GITHUB_TOKEN` taken from `gh` (no token pasted in the UI):

```bash
chmod +x scripts/dev_compliance_scanner_with_gh.sh
./scripts/dev_compliance_scanner_with_gh.sh --reload
```

Then open the React UI: scanner landing at `http://127.0.0.1:5173/scanner`, or the signed-in tool at `http://127.0.0.1:5173/scanner/app` (leave the token field empty if the API uses `GITHUB_TOKEN` from `gh`).

## Data

By default scan runs are stored under `services/scan_history/runs.json`.
Override with `COMPLIANCE_SCANNER_RUNS_PATH`.

