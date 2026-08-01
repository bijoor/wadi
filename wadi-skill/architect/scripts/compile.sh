#!/usr/bin/env bash
# Compile a .wdl (Wadi DSL) source file to a resolved .wadi (house_config JSON)
# AND validate it — the one command to run after every edit when authoring in the
# DSL. It:
#   1. parses the .wdl and reports parse errors with line:col (compile fails → non-zero),
#   2. resolves formulas/grids into concrete numbers (the shape the app persists),
#   3. runs the real schema + wall/roof geometry validator on the result.
#
# The resulting .wadi is what the Wadi desktop app watches/renders — point the
# app's Load (or the file association) at it once; each recompile updates the
# live model. Author the .wdl; treat the .wadi as the compiled artifact.
#
# Usage:
#   wadi-skill/architect/scripts/compile.sh <in.wdl> [out.wadi]
# Default out: alongside the input, same name with a .wadi extension.
# Exit 0 = compiled + valid. Non-zero = parse or validation error (printed).

set -euo pipefail

IN="${1:?usage: compile.sh <in.wdl> [out.wadi]}"
OUT="${2:-${IN%.wdl}.wadi}"

# Find the wadi repo by walking up from this script until we see editor/.
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
while [ "$REPO" != "/" ] && [ ! -f "$REPO/editor/package.json" ]; do REPO="$(dirname "$REPO")"; done
[ -f "$REPO/editor/package.json" ] || { echo "cannot find the wadi repo (editor/) above this script" >&2; exit 1; }

IN_ABS="$(cd "$(dirname "$IN")" && pwd)/$(basename "$IN")"
OUT_DIR="$(cd "$(dirname "$OUT")" && pwd)"
OUT_ABS="$OUT_DIR/$(basename "$OUT")"
[ -f "$IN_ABS" ] || { echo "no such .wdl file: $IN_ABS" >&2; exit 1; }

# 1 + 2. Parse + resolve the DSL → resolved .wadi. Parse errors (line:col) and
# resolver warnings print to stderr; a parse failure exits non-zero here.
npm --prefix "$REPO/wadi-dsl" run --silent gen -- "$IN_ABS" "$OUT_ABS"

# 3. Validate the compiled .wadi against the real schema + geometry pipeline.
( cd "$REPO/editor" && npx tsx ../wadi-skill/architect/scripts/validate.mjs "$OUT_ABS" )

echo "✓ compiled + validated → $OUT_ABS"
echo "  (this .wadi is the app's live-watched file; render it with preview.sh)"
