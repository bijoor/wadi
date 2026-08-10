#!/usr/bin/env bash
# Deploy the Wadi website (docs/) to Cloudflare Pages.
#
# docs/ is pre-built static, so there is no build step — this uploads the folder
# straight to Cloudflare's CDN (Direct Upload). Replaces GitHub Pages, which is
# tied to the billing-locked GitHub account. Cloudflare Pages' free tier needs no card.
#
# One-time setup (yours, in the Cloudflare dashboard):
#   1. Create a free Cloudflare account.
#   2. Create a Pages project named "wadi" (matches wrangler.toml `name`).
#   3. Add the custom domain wadi.house to the project and point its DNS at
#      Cloudflare (move the nameservers, or CNAME wadi.house → wadi.pages.dev).
#      Cloudflare provisions SSL automatically.
#
# Then, each deploy:
#   scripts/deploy-site.sh
#
# Auth: the first run opens a browser to authorize wrangler (or set CLOUDFLARE_API_TOKEN).

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

echo "▶ Deploying docs/ to Cloudflare Pages (project: wadi)…"
npx --yes wrangler pages deploy docs --project-name wadi

echo ""
echo "✓ Deployed. Live at your Pages URL (and wadi.house once DNS points at Cloudflare)."
