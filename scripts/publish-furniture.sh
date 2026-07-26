#!/usr/bin/env bash
# Publish the Wadi furniture GLB catalog to a Cloudflare R2 bucket so furniture can
# be served from a CDN (and grown) WITHOUT rebuilding/redeploying the app.
#
# Source of truth: editor/public/furniture/*.glb (the bundled CC0 set + any you add).
# Uploads each GLB under a `furniture/` key prefix on the bucket, so with the existing
# templates domain the files are served at:
#   https://templates.wadi.house/furniture/<id>.glb
# Point the app at them by setting REMOTE_FURNITURE_URL in editor/src/furniture/catalog.ts
# (or the "wadi.furnitureUrl" localStorage override) to that base, then rebuild.
#
# Credentials come from the same gitignored .env.r2 as publish-templates.sh — an
# account-level R2 API token (My Profile → API Tokens → Custom → Entire Account →
# "Workers R2 Storage: Read + Edit"). Day-to-day it's just:
#   ./scripts/publish-furniture.sh
#
# Requires: npx wrangler, an R2 bucket with public access + CORS `*` (see
# TEMPLATE_HOSTING.md — the wadi-templates bucket already has this).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -f "$ROOT/.env.r2" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env.r2"
  set +a
fi

BUCKET="${BUCKET:-wadi-templates}"
PREFIX="${FURNITURE_PREFIX:-furniture}"
SRC="$ROOT/editor/public/furniture"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "error: no CLOUDFLARE_API_TOKEN. Copy .env.r2.example to .env.r2 and paste an" >&2
  echo "       account-level R2 API token. See TEMPLATE_HOSTING.md." >&2
  exit 1
fi

if [ ! -d "$SRC" ]; then
  echo "error: furniture source not found: $SRC" >&2
  exit 1
fi

echo "Publishing $SRC/*.glb -> r2://$BUCKET/$PREFIX/"
for f in "$SRC"/*.glb; do
  [ -f "$f" ] || continue
  key="$PREFIX/$(basename "$f")"
  echo "  put $key"
  npx wrangler r2 object put "$BUCKET/$key" --file "$f" --content-type "model/gltf-binary" --remote
done

echo "Done. Set REMOTE_FURNITURE_URL to your bucket's public base + /$PREFIX and rebuild."
