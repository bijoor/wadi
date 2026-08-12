#!/usr/bin/env bash
# Report whether a signed + notarized macOS release is configured, without building.
# Reads scripts/.signing.env (gitignored) if present, the same way release-desktop.sh does.

set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -f "$REPO/scripts/.signing.env" ] && { set -a; . "$REPO/scripts/.signing.env"; set +a; }

yes() { echo "  ✓ $1"; }
no()  { echo "  ✗ $1"; }
have() { [ -n "${!1:-}" ]; }

echo "Keychain — Developer ID Application identities:"
if security find-identity -v -p codesigning 2>/dev/null | grep -q "Developer ID Application"; then
  security find-identity -v -p codesigning | grep "Developer ID Application" | sed 's/^ */  /'
else
  echo "  ✗ none found (create + install a Developer ID Application certificate)"
fi

echo "notarytool:"
if xcrun --find notarytool >/dev/null 2>&1; then yes "available"; else no "missing (install Xcode command line tools)"; fi

echo "Environment (from shell or scripts/.signing.env):"
have APPLE_SIGNING_IDENTITY && yes "APPLE_SIGNING_IDENTITY = ${APPLE_SIGNING_IDENTITY}" || no "APPLE_SIGNING_IDENTITY not set"
have APPLE_ID              && yes "APPLE_ID = ${APPLE_ID}"                 || no "APPLE_ID not set"
have APPLE_PASSWORD        && yes "APPLE_PASSWORD set (app-specific)"      || no "APPLE_PASSWORD not set"
have APPLE_TEAM_ID         && yes "APPLE_TEAM_ID = ${APPLE_TEAM_ID}"       || no "APPLE_TEAM_ID not set"

echo ""
if have APPLE_SIGNING_IDENTITY && have APPLE_ID && have APPLE_PASSWORD && have APPLE_TEAM_ID; then
  echo "→ Ready: release-desktop.sh will SIGN and NOTARIZE the macOS build."
elif have APPLE_SIGNING_IDENTITY; then
  echo "→ Partial: it will SIGN but NOT notarize (set APPLE_ID + APPLE_PASSWORD + APPLE_TEAM_ID)."
else
  echo "→ Not configured: builds will be UNSIGNED. Fill scripts/.signing.env (see .signing.env.example)."
fi
