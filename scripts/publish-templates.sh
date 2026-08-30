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
echo "Writing the catalog listing (manifest.json)…"
# A static host can't list its own folder, so we ship a filenames manifest.json.
# The templates are self-describing (each `.wadi`'s `template` block carries the
# editorial), so there is no metadata index to maintain. Runs via the editor's tsx.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/editor/node_modules/.bin/tsx" "$ROOT/scripts/gen-catalog-index.ts"
echo

echo "Publishing $SRC -> r2://$BUCKET"
# Walk the whole tree so the covers/ subfolder ships too. The object KEY is the
# path relative to SRC (e.g. "covers/family_home.jpg"), matching what the app's
# catalog.json references.
while IFS= read -r -d '' f; do
  key="${f#"$SRC"/}"
  case "$key" in
    *.jpg|*.jpeg) ct="image/jpeg" ;;
    *.png)        ct="image/png" ;;
    *.webp)       ct="image/webp" ;;
    *.wadi)       ct="application/zip" ;;   # .wadi is a zip BUNDLE now
    *)            ct="application/json" ;;   # manifest.json, catalog.json, *.json
  esac
  echo "  put $key ($ct)"
  npx wrangler r2 object put "$BUCKET/$key" --file "$f" --content-type "$ct" --remote
done < <(find "$SRC" -type f -print0)

echo "Done. In the app: New → Change source… → your bucket's public URL."
