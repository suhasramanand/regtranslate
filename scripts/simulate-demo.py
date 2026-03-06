#!/usr/bin/env python3
"""
Simulate RegTranslate demo: create sample PDF, process, extract tasks, Q&A.
Run with backend: uvicorn app.main:app --reload
"""

import io
import sys
from pathlib import Path

# Add project root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from fpdf import FPDF
except ImportError:
    print("Install fpdf2: pip install fpdf2")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("Install requests: pip install requests")
    sys.exit(1)

API_BASE = "http://localhost:8000"


def create_sample_pdf() -> bytes:
    """Create a minimal regulatory-style PDF for demo."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("helvetica", size=11)
    text = """
    HIPAA Section 164.312 - Technical Safeguards

    (a) Access control. Implement technical policies and procedures for electronic
    information systems that maintain ePHI to allow access only to those persons
    or software programs that have been granted access rights.

    (b) Audit controls. Implement hardware, software, and/or procedural mechanisms
    that record and examine activity in information systems that contain ePHI.

    (c) Integrity. Implement policies and procedures to protect ePHI from improper
    alteration or destruction.

    (d) Person or entity authentication. Implement procedures to verify that a
    person or entity seeking access to ePHI is the one claimed.

    (e) Transmission security. Implement technical security measures to guard
    against unauthorized access to ePHI that is being transmitted over an
    electronic communications network.
    """
    pdf.multi_cell(0, 6, text.strip())
    buf = io.BytesIO()
    pdf.output(buf)
    buf.seek(0)
    return buf.read()


def main():
    print("RegTranslate Demo Simulation")
    print("=" * 50)
    print("Ensure backend is running: uvicorn app.main:app --reload")
    print()

    # 1. Create sample PDF
    print("[1] Creating sample regulatory PDF...")
    pdf_bytes = create_sample_pdf()
    print("    OK - PDF created")

    # 2. Process document
    print("[2] Processing document (upload + embed)...")
    r = requests.post(
        f"{API_BASE}/process",
        params={"regulation_name": "HIPAA"},
        files={"file": ("sample-hipaa.pdf", pdf_bytes, "application/pdf")},
        timeout=120,
    )
    if r.status_code != 200:
        print(f"    FAILED: {r.status_code} {r.text[:200]}")
        return 1
    data = r.json()
    doc_id = data["doc_id"]
    chunks = data["chunk_count"]
    print(f"    OK - doc_id={doc_id[:8]}..., chunks={chunks}")

    # 3. Extract tasks
    print("[3] Extracting tasks (RAG + LLM)...")
    r = requests.post(
        f"{API_BASE}/extract",
        json={
            "doc_id": doc_id,
            "regulation_name": "HIPAA",
            "dedupe": True,
            "return_coverage": True,
        },
        timeout=120,
    )
    if r.status_code != 200:
        print(f"    FAILED: {r.status_code} {r.text[:200]}")
        return 1
    data = r.json()
    tasks = data.get("tasks", [])
    print(f"    OK - extracted {len(tasks)} tasks")
    for t in tasks[:3]:
        print(f"       - {t.get('title', '')[:60]}")

    # 4. Q&A
    print("[4] Q&A: What does HIPAA say about access control?")
    r = requests.post(
        f"{API_BASE}/qa",
        json={"doc_id": doc_id, "question": "What does HIPAA say about access control?"},
        timeout=60,
    )
    if r.status_code != 200:
        print(f"    FAILED: {r.status_code}")
        return 1
    data = r.json()
    answer = (data.get("answer", "") or "")[:200]
    print(f"    OK - {answer}...")

    print()
    print("Demo simulation complete. Open http://localhost:5173 for the UI.")
    print("  Hero: /  |  Dashboard: /dashboard")
    return 0


if __name__ == "__main__":
    sys.exit(main())
