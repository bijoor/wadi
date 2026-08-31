#!/usr/bin/env bash
# Publish ONE `.wadi` file to the R2 template catalog — add or update a single
# template without re-uploading the whole folder.
#
#   scripts/publish-wadi.sh <file.wadi|file.json> [<catalog-id>]
#     <file>        the model to publish (legacy JSON or a bundle — it's upgraded
#                   to the current bundle format on the way in)
#     <catalog-id>  optional id/filename in the catalog (default: the file's
#                   basename). The published object is "<catalog-id>.wadi".
#
# What it does:
#   1. upgrade the file into editor/public/templates/<id>.wadi (scripts/upgrade-wadi.sh)
#   2. regenerate catalog.json + manifest.json + covers/ (gen-catalog-index.ts)
#   3. mirror the bundled offline fallback under docs/ (sync-templates-docs.sh)
#   4. upload just the changed keys to R2: <id>.wadi, its cover, catalog.json, manifest.json
#
# Credentials come from a gitignored .env.r2 at the repo root (same as
# publish-templates.sh): CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, BUCKET.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRCDIR="$ROOT/editor/public/templates"

if [ -f "$ROOT/.env.r2" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env.r2"
  set +a
fi
BUCKET="${BUCKET:-wadi-templates}"

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "usage: publish-wadi.sh <file.wadi|file.json> [<catalog-id>]" >&2
  exit 2
fi
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "error: no CLOUDFLARE_API_TOKEN. Copy .env.r2.example to .env.r2 and paste an" >&2
  echo "       R2 API token (R2 Storage: Edit). See TEMPLATE_HOSTING.md." >&2
  exit 1
fi

# Catalog id: the 2nd arg, else the file's basename (sans extension).
BASE="$(basename "$FILE")"
ID="${2:-${BASE%.*}}"

echo "▶ [1/4] Upgrading $BASE → $SRCDIR/$ID.wadi"
"$ROOT/scripts/upgrade-wadi.sh" "$FILE" --out "$SRCDIR"
# upgrade-wadi names the output by the SOURCE basename; rename if a catalog-id was given.
if [ "$ID" != "${BASE%.*}" ]; then
  mv -f "$SRCDIR/${BASE%.*}.wadi" "$SRCDIR/$ID.wadi"
fi

echo "▶ [2/4] Regenerating the catalog index"
"$ROOT/editor/node_modules/.bin/tsx" "$ROOT/scripts/gen-catalog-index.ts" >/dev/null

echo "▶ [3/4] Syncing the bundled docs/ fallback"
"$ROOT/scripts/sync-templates-docs.sh" >/dev/null

echo "▶ [4/4] Uploading to r2://$BUCKET"
put() {
  local key="$1" ct="$2"
  echo "  put $key ($ct)"
  npx wrangler r2 object put "$BUCKET/$key" --file "$SRCDIR/$key" --content-type "$ct" --remote >/dev/null
}
put "$ID.wadi" "application/zip"
put "manifest.json" "application/json"
put "catalog.json" "application/json"
# The cover, whatever extension gen-catalog-index chose (from magic bytes).
shopt -s nullglob
for cover in "$SRCDIR/covers/$ID".*; do
  cbase="covers/$(basename "$cover")"
  case "$cbase" in
    *.jpg|*.jpeg) put "$cbase" "image/jpeg" ;;
    *.png)        put "$cbase" "image/png" ;;
    *.webp)       put "$cbase" "image/webp" ;;
    *.gif)        put "$cbase" "image/gif" ;;
  esac
done
shopt -u nullglob

echo "Done. Published '$ID' to r2://$BUCKET (catalog.json updated)."
