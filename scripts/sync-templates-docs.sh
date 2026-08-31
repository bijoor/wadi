#!/usr/bin/env bash
# Mirror the template catalog SOURCE (editor/public/templates) into the bundled
# fallback copies under docs/ — the offline catalog the app serves from
# BUNDLED_BASE "/templates" when the R2 host is unreachable.
#
# Three destinations:
#   docs/templates          — the app's "/templates" fallback (served at site root)
#   docs/app/templates       — the viewer build's public/ mirror
#   docs/editor/templates    — the editor SPA build's public/ mirror
#
# A Vite build regenerates the docs/app + docs/editor mirrors, but not docs/templates,
# and not between builds — so this keeps all three current after a publish. Uses
# --delete so a removed template (or a renamed cover) doesn't linger in the fallback.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/editor/public/templates"

if [ ! -d "$SRC" ]; then
  echo "error: template source not found: $SRC" >&2
  exit 1
fi

for dest in "$ROOT/docs/templates" "$ROOT/docs/app/templates" "$ROOT/docs/editor/templates"; do
  mkdir -p "$dest"
  rsync -a --delete "$SRC"/ "$dest"/
  echo "synced → ${dest#"$ROOT"/}"
done
