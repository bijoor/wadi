#!/usr/bin/env bash
# Publish the Wadi template catalog to a Cloudflare R2 bucket so new templates
# can be added WITHOUT rebuilding/redeploying the site or the desktop app.
#
# The catalog source of truth is editor/public/templates/ (index.json + the
# per-template .wadi/.json files + any cover images). This uploads every file
# in that dir to the bucket at the same names the app's index.json references
# (paths are relative to the catalog base — see io/templateSource.ts).
#
# Credentials come from a gitignored .env.r2 at the repo root (copy
# .env.r2.example, paste your token) — so day-to-day it's just:
#   ./scripts/publish-templates.sh
# You can still override any value via the environment if you prefer.
#
# .env.r2 (wrangler's OAuth login has NO R2 scope, so use an R2 API token):
#   CLOUDFLARE_ACCOUNT_ID=<account-id>
#   CLOUDFLARE_API_TOKEN=<token with "R2 Storage: Edit">
#   BUCKET=wadi-templates
#
# Requires: npx wrangler (Cloudflare CLI), an R2 bucket, and — for the app to
# read it — public access + a CORS policy on the bucket (see TEMPLATE_HOSTING.md).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Load the gitignored env file if present (existing env vars still win).
if [ -f "$ROOT/.env.r2" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env.r2"
  set +a
fi

BUCKET="${BUCKET:-wadi-templates}"
SRC="$ROOT/editor/public/templates"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "error: no CLOUDFLARE_API_TOKEN. Copy .env.r2.example to .env.r2 and paste" >&2
  echo "       an R2 API token (dash.cloudflare.com → My Profile → API Tokens →" >&2
  echo "       Create → R2 Storage: Edit). See TEMPLATE_HOSTING.md." >&2
  exit 1
fi

if [ ! -d "$SRC" ]; then
  echo "error: catalog source not found: $SRC" >&2
  exit 1
fi

# Regenerate index.json from the .wadi files first (derives bedrooms/bathrooms/
# floors/parametric; preserves editorial fields). So "drop a .wadi in the folder
# + run this" is all it takes to publish a new template.
echo "Regenerating catalog index…"
node "$(dirname "$0")/gen-catalog-index.mjs"
echo

echo "Publishing $SRC -> r2://$BUCKET"
for f in "$SRC"/*; do
  [ -f "$f" ] || continue
  key="$(basename "$f")"
  case "$key" in
    *.jpg|*.jpeg) ct="image/jpeg" ;;
    *.png)        ct="image/png" ;;
    *)            ct="application/json" ;;  # index.json, *.wadi, *.json
  esac
  echo "  put $key ($ct)"
  npx wrangler r2 object put "$BUCKET/$key" --file "$f" --content-type "$ct" --remote
done

echo "Done. In the app: New → Change source… → your bucket's public URL."
