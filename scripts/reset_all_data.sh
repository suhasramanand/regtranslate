#!/usr/bin/env bash
# Reset all RegTranslate data for a clean test.
# Use this to test version change detection: first upload shows no change;
# upload same file again = no change; upload different file = change detected.

set -e
cd "$(dirname "$0")/.."

echo "Resetting RegTranslate data..."

# Regulation version tracking (content-change detection)
rm -f regulation_versions/versions.json
echo "  cleared regulation_versions/"

# Audit logs
rm -f audit_logs/audit.jsonl audit_logs/chain_state.json audit_logs/reviews.jsonl
echo "  cleared audit_logs/"

# Export history
rm -f export_history/exports.json
echo "  cleared export_history/"

# ChromaDB vector store (document embeddings)
rm -rf chroma_db
echo "  cleared chroma_db/"

# Confidence calibration feedback
rm -f calibration/feedback.json 2>/dev/null || true
echo "  cleared calibration/ (if any)"

echo "Done. Start fresh to test version detection:"
echo "  1. Upload a PDF (e.g. hipaa.pdf) → no notice (first time)"
echo "  2. Upload the SAME file again (same content) → no notice"
echo "  3. Edit the PDF, save as same name, upload → version-change notice"
