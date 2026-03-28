"""Pytest hooks: default open local auth so API tests need no GitHub cookie."""

from __future__ import annotations

import os

os.environ.setdefault("REGTRANSLATE_REQUIRE_AUTH", "0")
