#!/usr/bin/env bash
# Run RegTranslate demo: start app and open demo recorder
set -e
cd "$(dirname "$0")/.."

echo "Starting demo..."
echo "1. Backend: uvicorn (port 8000)"
echo "2. Frontend: npm run dev (port 5173)"
echo "3. Demo recorder: scripts/demo-recorder.html"
echo ""

# Open demo recorder in browser (macOS)
open scripts/demo-recorder.html 2>/dev/null || xdg-open scripts/demo-recorder.html 2>/dev/null || echo "Open scripts/demo-recorder.html manually"

echo "Make sure backend and frontend are running:"
echo "  Terminal 1: uvicorn app.main:app --reload"
echo "  Terminal 2: cd react-ui && npm run dev"
echo ""
echo "Then full-screen the demo page (F11) and start recording."
