#!/usr/bin/env bash
# Start the compliance scanner API with GITHUB_TOKEN from `gh` CLI (local dev).
# Prerequisite: `gh auth login` (and token must allow repo access you plan to scan).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) not found. Install: https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Run: gh auth login"
  exit 1
fi

export GITHUB_TOKEN
GITHUB_TOKEN="$(gh auth token)"

exec python3 -m uvicorn services.compliance_scanner.main:app \
  --host "${SCANNER_HOST:-127.0.0.1}" \
  --port "${SCANNER_PORT:-9010}" \
  "$@"
