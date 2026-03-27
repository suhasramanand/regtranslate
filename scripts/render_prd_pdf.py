#!/usr/bin/env python3
"""Render docs/PRD.md to docs/RegTranslate-PRD.pdf (simple Markdown-aware layout)."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def _strip_md(s: str) -> str:
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)
    return s.strip()


def _ascii_safe(s: str) -> str:
    s = (
        s.replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2022", "*")
    )
    return s.encode("ascii", "replace").decode("ascii")


def _wrap_line(txt: str, max_chars: int = 100) -> list[str]:
    if len(txt) <= max_chars:
        return [txt]
    words = txt.split()
    lines: list[str] = []
    cur: list[str] = []
    n = 0
    for w in words:
        add = len(w) + (1 if cur else 0)
        if n + add > max_chars and cur:
            lines.append(" ".join(cur))
            cur, n = [w], len(w)
        else:
            cur.append(w)
            n += add
    if cur:
        lines.append(" ".join(cur))
    return lines


def main() -> int:
    try:
        from fpdf import FPDF
    except ImportError:
        print("fpdf2 is required: pip install fpdf2", file=sys.stderr)
        return 1

    root = Path(__file__).resolve().parents[1]
    md_path = root / "docs" / "PRD.md"
    out_path = root / "docs" / "RegTranslate-PRD.pdf"
    if not md_path.is_file():
        print(f"Missing {md_path}", file=sys.stderr)
        return 1

    raw = md_path.read_text(encoding="utf-8")
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.set_margins(18, 16, 18)
    pdf.add_page()
    body = 10
    pdf.set_font("Helvetica", size=body)
    epw = pdf.w - pdf.l_margin - pdf.r_margin

    def emit_para(text: str, h: float = 5) -> None:
        for chunk in _wrap_line(text):
            pdf.multi_cell(epw, h, chunk)
            pdf.set_x(pdf.l_margin)

    for line in raw.splitlines():
        t = _ascii_safe(_strip_md(line))
        if t.strip() == "---":
            pdf.ln(4)
            continue
        if t.startswith("# "):
            pdf.set_font("Helvetica", "B", 16)
            emit_para(t[2:].strip(), h=8)
            pdf.ln(3)
            pdf.set_font("Helvetica", size=body)
        elif t.startswith("## "):
            pdf.set_font("Helvetica", "B", 13)
            emit_para(t[3:].strip(), h=7)
            pdf.ln(2)
            pdf.set_font("Helvetica", size=body)
        elif t.startswith("### "):
            pdf.set_font("Helvetica", "B", 11)
            emit_para(t[4:].strip(), h=6)
            pdf.ln(2)
            pdf.set_font("Helvetica", size=body)
        elif t.startswith("| ") and "|" in t[2:]:
            pdf.set_font("Helvetica", size=9)
            emit_para(t, h=4)
            pdf.set_font("Helvetica", size=body)
        elif re.match(r"^\|[-:| ]+\|$", t.strip()):
            pdf.ln(1)
        elif t.strip().startswith("- ") or t.strip().startswith("* "):
            pdf.set_font("Helvetica", size=body)
            emit_para("* " + t.strip()[2:].strip(), h=5)
        elif not t.strip():
            pdf.ln(2)
        else:
            emit_para(t, h=5)

    pdf.output(str(out_path))
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
