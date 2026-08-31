#!/usr/bin/env bash
# Delete ONE template from the R2 catalog (and the local mirror) — the inverse of
# publish-wadi.sh.
#
#   scripts/delete-wadi.sh <catalog-id>
#     <catalog-id>  the template's id in the catalog (its object is "<id>.wadi")
#
# What it does:
#   1. remove editor/public/templates/<id>.wadi (+ its local cover)
#   2. regenerate catalog.json + manifest.json (gen-catalog-index.ts) — the id drops
#      out of the index
#   3. mirror the bundled offline fallback under docs/ (sync-templates-docs.sh)
#   4. delete the R2 objects for <id> (the bundle + every covers/<id>.* extension)
#   5. re-upload the updated catalog.json + manifest.json
#
# Source of truth is editor/public/templates (the git-tracked, complete mirror), so
# the regenerated index reflects every remaining template. Credentials come from a
# gitignored .env.r2 (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, BUCKET).
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

ID="${1:-}"
if [ -z "$ID" ]; then
  echo "usage: delete-wadi.sh <catalog-id>" >&2
  exit 2
fi
ID="${ID%.wadi}" # tolerate passing "<id>.wadi"
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "error: no CLOUDFLARE_API_TOKEN. Copy .env.r2.example to .env.r2 and paste an" >&2
  echo "       R2 API token (R2 Storage: Edit). See TEMPLATE_HOSTING.md." >&2
  exit 1
fi

if [ ! -f "$SRCDIR/$ID.wadi" ]; then
  echo "note: $SRCDIR/$ID.wadi not found locally — will still remove it from R2." >&2
fi

echo "▶ [1/5] Removing local $ID.wadi"
rm -f "$SRCDIR/$ID.wadi"
rm -f "$SRCDIR/covers/$ID".*

echo "▶ [2/5] Regenerating the catalog index"
"$ROOT/editor/node_modules/.bin/tsx" "$ROOT/scripts/gen-catalog-index.ts" >/dev/null

echo "▶ [3/5] Syncing the bundled docs/ fallback"
"$ROOT/scripts/sync-templates-docs.sh" >/dev/null

echo "▶ [4/5] Deleting R2 objects for '$ID'"
# wrangler r2 object delete prints "Delete complete" for a real delete AND for a
# missing key, so confirm that string (a transient failure prints neither) and
# retry once. Deleting a nonexistent cover extension is a harmless no-op.
rm_key() {
  local key="$1"
  echo "  delete $key"
  for attempt in 1 2; do
    if npx wrangler r2 object delete "$BUCKET/$key" --remote 2>&1 | grep -qi "Delete complete"; then
      return 0
    fi
    echo "    warning: delete of $key did not confirm (attempt $attempt)" >&2
  done
  return 1
}
rm_key "$ID.wadi"
for ext in jpg jpeg png webp gif; do
  rm_key "covers/$ID.$ext"
done

# Authoritative check (not the possibly-edge-cached public URL): the bundle must
# be gone. `object get` on a deleted key errors with "key does not exist". Write to
# /dev/null so a still-present object isn't downloaded into the working directory.
if npx wrangler r2 object get "$BUCKET/$ID.wadi" --file /dev/null --remote >/dev/null 2>&1; then
  echo "error: $ID.wadi still present on R2 after delete — re-run delete-wadi.sh $ID." >&2
  exit 1
fi

echo "▶ [5/5] Uploading the updated catalog index"
npx wrangler r2 object put "$BUCKET/manifest.json" --file "$SRCDIR/manifest.json" --content-type "application/json" --remote >/dev/null
npx wrangler r2 object put "$BUCKET/catalog.json" --file "$SRCDIR/catalog.json" --content-type "application/json" --remote >/dev/null

echo "Done. Removed '$ID' from r2://$BUCKET (catalog.json updated)."
