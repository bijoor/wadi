#!/usr/bin/env bash
# Verify a .wdl (Wadi DSL) source compiles and validates — WITHOUT producing a
# .wadi. The Wadi app's DSL previewer does the .wdl → render conversion live; this
# script only lints your source so you never save a broken .wdl into a co-edited
# file. It: parses (line:col parse errors) → resolves formulas/grids → runs the
# real schema + wall/roof geometry validator, all against a THROWAWAY temp file
# that is deleted immediately.
#
# Usage:
#   wadi-skill/architect/scripts/check.sh <house.wdl>
# Exit 0 = compiles + valid. Non-zero = parse or validation error (printed).

set -euo pipefail

IN="${1:?usage: check.sh <house.wdl>}"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
while [ "$REPO" != "/" ] && [ ! -f "$REPO/editor/package.json" ]; do REPO="$(dirname "$REPO")"; done
[ -f "$REPO/editor/package.json" ] || { echo "cannot find the wadi repo (editor/) above this script" >&2; exit 1; }

IN_ABS="$(cd "$(dirname "$IN")" && pwd)/$(basename "$IN")"
[ -f "$IN_ABS" ] || { echo "no such .wdl file: $IN_ABS" >&2; exit 1; }

TMP="$(mktemp -t wadi-check.XXXXXX).wadi"
trap 'rm -f "$TMP"' EXIT

# Parse + resolve the DSL to a throwaway .wadi (parse errors + resolver warnings
# print here; a parse failure exits non-zero).
npm --prefix "$REPO/wadi-dsl" run --silent gen -- "$IN_ABS" "$TMP"

# Validate against the real schema + geometry pipeline.
( cd "$REPO/editor" && npx tsx ../wadi-skill/architect/scripts/validate.mjs "$TMP" )

echo "✓ $(basename "$IN_ABS") compiles + validates (the app's DSL previewer renders it live)"
