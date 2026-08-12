# Releasing Wadi (off GitHub Actions)

This account's **GitHub Actions compute is billing-locked** (GitHub disabled
recurring card payments for India-based accounts), so the tag-triggered
`.github/workflows/release.yml` cannot run, and GitHub Pages' automated deploy is
tied to the same account. The repo, issues, and **GitHub Releases stay on GitHub**
(Releases are not billing-locked). Only the build and website-deploy **compute**
moves off GitHub:

- **Desktop installers** are built **locally** and uploaded to a GitHub Release.
- **The website** deploys to **Cloudflare Pages** (free tier, no card) instead of
  GitHub Pages.

Windows is deferred for now: Tauri cannot cross-compile Windows from macOS/Linux, so
it needs a Windows machine or a self-hosted Windows runner. Current releases ship
**macOS (universal)** and, optionally, **Linux**.

## One-time setup

- **macOS build host** (your Mac): `rustup`, the `aarch64-apple-darwin` and
  `x86_64-apple-darwin` targets (the script adds them), `cargo-tauri`, Node 20+.
- **Linux build** (optional): Docker Desktop running.
- **GitHub Releases**: `gh` authenticated with `repo` scope (already set up).
- **Cloudflare Pages**: create a free Cloudflare account, a Pages project named
  `wadi`, add the custom domain **wadi.house**, and point its DNS at Cloudflare
  (move the nameservers, or CNAME `wadi.house` → `wadi.pages.dev`). SSL is automatic.

## Cut a desktop release

```bash
# 1. Build the installers locally (macOS universal; add --linux for Linux via Docker)
scripts/release-desktop.sh            # or: scripts/release-desktop.sh --linux

# 2. Upload them to a DRAFT GitHub Release (nothing goes public until you Publish)
scripts/publish-release.sh v0.1.0
```

Then review the draft at <https://github.com/bijoor/wadi/releases> and click Publish.
The download links on the landing page go live once the release is public.

Bump the version in `src-tauri/tauri.conf.json` before building a new version; the
scripts read the version from there and name the tag/assets to match.

## Signed + notarized macOS builds

Without signing, macOS shows a Gatekeeper warning on first open. To remove it, sign
with an Apple Developer ID certificate and notarize:

1. One-time: create + install a **Developer ID Application** certificate (Keychain
   Access → Certificate Assistant → request a cert, create it on developer.apple.com
   using the **G2 Sub-CA**, download + double-click to install, then install the
   `DeveloperIDG2CA.cer` intermediate from apple.com/certificateauthority if the cert
   shows "not trusted"). Confirm with `security find-identity -v -p codesigning`.
2. Copy `scripts/.signing.env.example` to `scripts/.signing.env` (gitignored) and fill
   in `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` (an **app-specific**
   password from appleid.apple.com), and `APPLE_TEAM_ID`.
3. Check it: `scripts/check-signing.sh` prints whether signing + notarization are ready.
4. Build as usual: `scripts/release-desktop.sh` picks up the secrets and produces a
   fully clean DMG. tauri signs + notarizes + staples the `.app`; the script then also
   signs, **notarizes, and staples the DMG itself** (tauri does not notarize the DMG, and
   an un-notarized DMG still trips Gatekeeper on download). Unsigned builds still work
   when `.signing.env` is absent.

Two gotchas the script now handles:
- **Flaky timestamp server.** DMG signing needs a secure timestamp from
  `timestamp.apple.com` (HTTPS). On some networks that is intermittently blocked, and
  codesign fails with *"A timestamp was expected but was not found."* The script retries
  the DMG signing a few times; if it still fails, use a more reliable network (the
  notarization endpoint is separate and usually fine). Check with
  `curl -sI https://timestamp.apple.com/ts01`.
- **DMG notarization.** The script uploads the DMG to Apple and staples the ticket, so
  `spctl -a -t open ... Wadi_<v>_universal.dmg` reports **Notarized Developer ID**.

Once you ship a signed release, drop the macOS "first open" warning wording from the
release notes and the website, since it no longer applies.

## Deploy the website

```bash
scripts/deploy-site.sh          # wrangler pages deploy docs → Cloudflare Pages
```

`docs/` is pre-built static, so there is no build step. Rebuild the frontend first
only if you changed it (`npm --prefix editor run build`), then deploy.

## Reviving GitHub Actions later

If the billing lock is cleared, re-enable the tag trigger in
`.github/workflows/release.yml` (uncomment the `push:`/`tags:` block) and you get
the original all-platform (incl. Windows) automated draft releases back. The local
scripts remain as a fallback.

## Optional next step: Linux on GitLab CI (no card)

To avoid emulated local Docker for Linux, mirror the repo to GitLab and run the
Linux build on GitLab's **Free-tier Linux runners** (400 min/month, no payment
needed), then push the artifact to the GitHub Release via `gh`/the API. macOS still
builds on your Mac; the repo stays canonical on GitHub. Not set up yet — noted here
as the clean way to get Linux builds off this machine.
