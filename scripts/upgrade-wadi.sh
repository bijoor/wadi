#!/usr/bin/env bash
# Upgrade old `.wadi` files (legacy JSON or an older bundle) to the current `.wadi`
# BUNDLE format. Thin wrapper around scripts/upgrade-wadi.ts.
#
#   scripts/upgrade-wadi.sh <src> [<src>…] [--out <dir>]
#     <src>   a .wadi/.json file, or a directory of them
#     --out   destination dir (default: editor/public/templates)
#
# We run through wadi-dsl's vite-node (not tsx): the upgrader compiles WDL with the
# Langium engine, whose ESM-only package exports plain `tsx` fails to resolve.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VN="$ROOT/wadi-dsl/node_modules/.bin/vite-node"

if [ ! -x "$VN" ]; then
  echo "error: $VN not found — run 'npm --prefix wadi-dsl install' first." >&2
  exit 1
fi

exec "$VN" "$ROOT/scripts/upgrade-wadi.ts" -- "$@"
