# compliance_scanner

Separate service for org-wide and CI compliance scanning.

## Run locally

From repo root:

```bash
python -m uvicorn services.compliance_scanner.main:app --reload --port 8010
```

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

