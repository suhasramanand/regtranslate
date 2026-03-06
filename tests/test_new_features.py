"""Tests for new features: regulation version, confidence calibration, Q&A, gap analysis, evidence."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pytest

from app.models.schemas import EvidenceLink, ExtractionTask
from app.services import (
    confidence_calibration,
    gap_analysis,
    qa_agent,
    regulation_version,
)


class TestRegulationVersion:
    """Test regulation version tracking."""

    def test_record_and_list_versions(self):
        content = b"test pdf content"
        rec = regulation_version.record_version(
            doc_id="test-doc-1",
            regulation_name="GDPR",
            source_filename="gdpr.pdf",
            content=content,
            chunk_count=10,
        )
        assert rec.doc_id == "test-doc-1"
        assert rec.regulation_name == "GDPR"
        assert rec.chunk_count == 10
        assert len(rec.content_hash) > 0

        entries = regulation_version.list_versions(limit=5)
        assert len(entries) >= 1
        found = next((e for e in entries if e.doc_id == "test-doc-1"), None)
        assert found is not None
        assert found.regulation_name == "GDPR"

    def test_check_update_needed_same_content(self):
        content = b"same content"
        regulation_version.record_version("doc-same", "HIPAA", "h.pdf", content, 5)
        result = regulation_version.check_update_needed("doc-same", content)
        assert result["needs_update"] is False
        assert result["current_hash"] == result["new_hash"]

    def test_check_update_needed_different_content(self):
        content = b"original"
        regulation_version.record_version("doc-diff", "HIPAA", "h.pdf", content, 5)
        result = regulation_version.check_update_needed("doc-diff", b"different content")
        assert result["needs_update"] is True
        assert result["current_hash"] != result["new_hash"]

    def test_get_version(self):
        content = b"get-version-test"
        regulation_version.record_version("doc-get", "FDA", "fda.pdf", content, 3)
        rec = regulation_version.get_version("doc-get")
        assert rec is not None
        assert rec.regulation_name == "FDA"

    def test_check_content_changed_no_previous(self):
        result = regulation_version.check_content_changed(
            "HIPAA", "new_file.pdf", b"new content"
        )
        assert result["content_changed"] is False
        assert result["previous_processed_at"] is None

    def test_check_content_changed_same_content(self):
        content = b"unchanged content"
        regulation_version.record_version("doc-x", "GDPR", "gdpr.pdf", content, 5)
        result = regulation_version.check_content_changed("GDPR", "gdpr.pdf", content)
        assert result["content_changed"] is False
        assert result["previous_processed_at"] is not None

    def test_check_content_changed_different_content(self):
        content = b"original version"
        regulation_version.record_version("doc-y", "FDA", "fda.pdf", content, 3)
        result = regulation_version.check_content_changed(
            "FDA", "fda.pdf", b"updated version"
        )
        assert result["content_changed"] is True
        assert result["previous_processed_at"] is not None

    def test_check_content_changed_versioned_filename(self):
        content = b"original"
        regulation_version.record_version("doc-z", "HIPAA", "sample-hipaa-regulation.pdf", content, 5)
        result = regulation_version.check_content_changed(
            "HIPAA", "sample-hipaa-regulation-v2.pdf", b"updated content"
        )
        assert result["content_changed"] is True
        assert result["previous_processed_at"] is not None


class TestConfidenceCalibration:
    """Test confidence calibration."""

    def test_submit_feedback(self):
        confidence_calibration.submit_feedback("tid-1", "Audit logging", correct=True)
        confidence_calibration.submit_feedback("tid-1", "Audit logging", correct=True)
        # No exception

    def test_get_calibrated_confidence_no_feedback(self):
        c = confidence_calibration.get_calibrated_confidence("tid-x", "Title", 80)
        assert c == 80

    def test_get_calibrated_confidence_with_feedback(self):
        confidence_calibration.submit_feedback("tid-fb", "Task", correct=True)
        c = confidence_calibration.get_calibrated_confidence("tid-fb", "Task", 50)
        assert c is not None
        assert 0 <= c <= 100

    def test_get_stats(self):
        stats = confidence_calibration.get_stats()
        assert "total_feedback_entries" in stats
        assert "tasks_with_feedback" in stats
        assert "average_accuracy" in stats


class TestGapAnalysis:
    """Test cross-regulation gap analysis."""

    def test_analyze_gaps_empty(self):
        result = gap_analysis.analyze_gaps([], [], "A", "B")
        assert result["overlap"] == []
        assert result["unique_to_a"] == []
        assert result["unique_to_b"] == []

    def test_analyze_gaps_single_each(self):
        tasks_a = [{"title": "Encryption", "description": "Implement encryption at rest"}]
        tasks_b = [{"title": "Encryption", "description": "Implement encryption at rest"}]
        result = gap_analysis.analyze_gaps(tasks_a, tasks_b, "A", "B")
        assert len(result["overlap"]) >= 1
        assert len(result["unique_to_a"]) <= 1
        assert len(result["unique_to_b"]) <= 1

    def test_analyze_gaps_different(self):
        tasks_a = [{"title": "Audit logs", "description": "Implement audit logging"}]
        tasks_b = [{"title": "Password policy", "description": "Enforce password complexity"}]
        result = gap_analysis.analyze_gaps(tasks_a, tasks_b, "A", "B")
        assert "overlap" in result
        assert "unique_to_a" in result
        assert "unique_to_b" in result


class TestQAAgent:
    """Test compliance Q&A agent."""

    def test_answer_question_no_doc(self):
        result = qa_agent.answer_question("nonexistent-doc-id-xyz", "What is encryption?")
        assert "answer" in result
        assert "sources" in result
        assert len(result["sources"]) == 0
        assert "No relevant" in result["answer"] or "No text" in result["answer"] or "not found" in result["answer"].lower()


class TestEvidenceLink:
    """Test evidence linking schema."""

    def test_evidence_link_model(self):
        e = EvidenceLink(url="https://example.com/screenshot.png", label="Screenshot")
        assert e.url == "https://example.com/screenshot.png"
        assert e.label == "Screenshot"

    def test_extraction_task_has_evidence_links(self):
        t = ExtractionTask(
            task_id="T1",
            title="Test",
            description="Desc",
            priority="High",
            penalty_risk="",
            source_citation="",
            source_text="",
            responsible_role="",
            evidence_links=[EvidenceLink(url="https://a.com", label="A")],
        )
        assert len(t.evidence_links) == 1
        assert t.evidence_links[0].url == "https://a.com"
