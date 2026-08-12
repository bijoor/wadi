#!/usr/bin/env bash
# Publish locally-built desktop installers to a GitHub Release.
#
# GitHub Releases are NOT billing-locked (only Actions compute is), so this works
# even while the account's Actions are blocked. It creates the release as a DRAFT
# so you can review the assets and notes before making it public — nothing goes
# live until you click Publish on github.com/bijoor/wadi/releases.
#
# Usage:
#   scripts/publish-release.sh v0.1.0
#
# Requires: gh (authenticated with `repo` scope — already the case here).
# Run scripts/release-desktop.sh first so the artifacts exist.

set -euo pipefail
shopt -s nullglob   # unmatched globs (e.g. no .AppImage) expand to nothing, not a literal

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

TAG="${1:?usage: publish-release.sh <tag>  e.g. v0.1.0}"
VERSION="${TAG#v}"

# Collect whatever installers were built (macOS always; Linux if --linux was used).
# `add` must always return 0 so `set -e` doesn't abort when a file is absent.
ASSETS=()
add() { if [ -f "$1" ]; then ASSETS+=("$1"); echo "  + $1"; fi; return 0; }
echo "▶ Collecting installers for ${TAG}…"
add "src-tauri/target/universal-apple-darwin/release/bundle/dmg/Wadi_${VERSION}_universal.dmg"
# Fallback: an Apple-Silicon-only DMG, if that's all you built.
[ ${#ASSETS[@]} -eq 0 ] && add "src-tauri/target/release/bundle/dmg/Wadi_${VERSION}_aarch64.dmg"
# Version-specific globs, so a stale installer from a previous version is never
# attached to this release by mistake.
for f in src-tauri/target/release/bundle/appimage/Wadi_${VERSION}_*.AppImage \
         src-tauri/target/release/bundle/deb/Wadi_${VERSION}_*.deb; do
  add "$f"
done

if [ ${#ASSETS[@]} -eq 0 ]; then
  echo "✗ No installers found. Run scripts/release-desktop.sh first." >&2
  exit 1
fi

NOTES="Desktop builds of Wadi ${TAG}.

macOS: signed with a Developer ID and notarized by Apple. Open the .dmg and drag Wadi
into your Applications folder. It opens with no security warning.

Linux: install the .deb, e.g.  sudo dpkg -i Wadi_${VERSION}_amd64.deb  (or open it with
your software installer).

Windows: not included in this release (coming soon)."

# Create the draft release (idempotent: reuse if the tag's release already exists).
if gh release view "$TAG" >/dev/null 2>&1; then
  echo "▶ Release ${TAG} exists — uploading/replacing assets…"
  gh release upload "$TAG" "${ASSETS[@]}" --clobber
else
  echo "▶ Creating DRAFT release ${TAG}…"
  gh release create "$TAG" "${ASSETS[@]}" \
    --draft --title "Wadi ${TAG}" --notes "$NOTES"
fi

echo ""
echo "✓ Draft release ready. Review + publish at:"
echo "    https://github.com/bijoor/wadi/releases"
