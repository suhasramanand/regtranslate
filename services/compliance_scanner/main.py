from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv

# Same repo-root `.env` as the main API. `load_dotenv()` elsewhere uses the process cwd;
# starting uvicorn from another directory would skip OAuth vars and the UI shows
# "Continue with GitHub" disabled even when GITHUB_OAUTH_* are in the file.
_REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_REPO_ROOT / ".env")

from services.compliance_scanner.scanner.api import create_app

app = create_app()

