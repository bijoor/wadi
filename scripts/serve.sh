#!/bin/bash
# Serve docs/ over HTTP so the interactive 3D viewer (index.html) can load
# wadi.glb. Default port 8000; pass an alternate port as the first arg.
# Stop with Ctrl+C.

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PORT="${1:-8000}"

cd "$SCRIPT_DIR/../docs"

echo "Serving docs/ at http://localhost:$PORT"
echo "Open http://localhost:$PORT in your browser. Ctrl+C to stop."
echo ""

exec python3 -m http.server "$PORT"
