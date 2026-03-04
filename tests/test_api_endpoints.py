"""Integration tests for new API endpoints."""

from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_regulation_versions_empty():
    r = client.get("/regulation/versions")
    assert r.status_code == 200
    assert "versions" in r.json()


def test_qa_no_doc():
    r = client.post("/qa", json={"doc_id": "nonexistent-xyz", "question": "What is encryption?"})
    assert r.status_code == 200
    data = r.json()
    assert "answer" in data
    assert "sources" in data
    assert len(data["sources"]) == 0


def test_gap_analysis():
    r = client.post(
        "/gap-analysis",
        json={
            "tasks_a": [{"title": "A", "description": "Task A"}],
            "tasks_b": [{"title": "B", "description": "Task B"}],
            "label_a": "Reg1",
            "label_b": "Reg2",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert "overlap" in data
    assert "unique_to_a" in data
    assert "unique_to_b" in data
    assert data["label_a"] == "Reg1"
    assert data["label_b"] == "Reg2"


def test_calibration_feedback():
    r = client.post(
        "/calibration/feedback",
        json={"task_id": "t1", "title": "Test task", "correct": True},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_calibration_stats():
    r = client.get("/calibration/stats")
    assert r.status_code == 200
    data = r.json()
    assert "total_feedback_entries" in data
    assert "tasks_with_feedback" in data
    assert "average_accuracy" in data


def test_check_update_no_doc():
    pdf_content = b"%PDF-1.4 minimal"
    r = client.post(
        "/regulation/check-update",
        params={"doc_id": "nonexistent"},
        files={"file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")},
    )
    assert r.status_code == 200
    data = r.json()
    assert "needs_update" in data
    assert data["needs_update"] is True
    assert "new_hash" in data


def test_check_update_missing_doc_id():
    pdf_content = b"%PDF-1.4 minimal"
    r = client.post(
        "/regulation/check-update",
        files={"file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")},
    )
    assert r.status_code == 400  # doc_id required


def test_check_content_change_missing_regulation():
    pdf_content = b"%PDF-1.4 minimal"
    r = client.post(
        "/regulation/check-content-change",
        files={"file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")},
    )
    assert r.status_code == 400  # regulation_name required


def test_check_content_change_success():
    pdf_content = b"%PDF-1.4 minimal"
    r = client.post(
        "/regulation/check-content-change",
        params={"regulation_name": "HIPAA"},
        files={"file": ("hipaa.pdf", io.BytesIO(pdf_content), "application/pdf")},
    )
    assert r.status_code == 200
    data = r.json()
    assert "content_changed" in data
    assert "previous_processed_at" in data
