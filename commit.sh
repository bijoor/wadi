#!/bin/bash
# Stage everything (respecting .gitignore), commit with the provided message,
# and push to origin/main. GitHub Pages picks up the new commit automatically.
#
# Usage:  ./commit.sh "Short commit message"

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

if [ -z "$1" ]; then
    echo "Usage: $0 \"commit message\""
    exit 1
fi

MESSAGE="$1"

echo "=========================================="
echo "Staging changes…"
echo "=========================================="
git add -A

if git diff --cached --quiet; then
    echo "No changes staged. Nothing to commit."
    exit 0
fi

echo ""
echo "=== Files in this commit ==="
git diff --cached --name-status

echo ""
echo "=========================================="
echo "Committing…"
echo "=========================================="
git commit -m "$(cat <<EOF
$MESSAGE

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

echo ""
echo "=========================================="
echo "Pushing to origin/main…"
echo "=========================================="
git push origin main

echo ""
echo "=========================================="
echo "Done. GitHub Pages will rebuild within ~1-2 minutes."
echo "Live URL: https://bijoor.github.io/konkan-house/"
echo "=========================================="
