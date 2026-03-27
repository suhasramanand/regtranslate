#!/usr/bin/env bash
# Disables auto-loaded pytest entry points (avoids broken langsmith.pytest_plugin on some installs).
set -euo pipefail
export PYTEST_DISABLE_PLUGIN_AUTOLOAD="${PYTEST_DISABLE_PLUGIN_AUTOLOAD:-1}"
exec python3 -m pytest "$@"
