#!/usr/bin/env bash
# Build the Wadi desktop installers LOCALLY, off GitHub Actions.
#
# Why local: the GitHub account's Actions compute is billing-locked (GitHub
# disabled recurring card payments for India-based accounts), so the tag-triggered
# release.yml can't run. GitHub *Releases* themselves are not billing-locked, so we
# build here and publish the artifacts to a GitHub Release with scripts/publish-release.sh.
#
# Produces:
#   - macOS universal .dmg  (Apple Silicon + Intel)          [always, needs a Mac]
#   - Linux .deb            (x86_64, via Docker)             [with --linux, needs Docker]
#
# Windows is deferred for now (Tauri can't cross-compile Windows from macOS/Linux;
# it needs a Windows machine or a self-hosted Windows runner).
#
# Usage:
#   scripts/release-desktop.sh            # macOS universal only
#   scripts/release-desktop.sh --linux    # also build Linux in a Docker container
#
# Prereqs (macOS): rustup with aarch64-apple-darwin + x86_64-apple-darwin targets,
# cargo-tauri (tauri-cli), Node 20+. The script adds the missing rust target itself.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

# Optional Apple signing/notarization secrets (gitignored). When present, the macOS
# `cargo tauri build` below auto-signs + notarizes from these env vars. Absent → the
# build is unsigned (still works; users clear Gatekeeper manually). See
# scripts/.signing.env.example and scripts/check-signing.sh.
[ -f "$REPO/scripts/.signing.env" ] && { set -a; . "$REPO/scripts/.signing.env"; set +a; }

DO_LINUX=0; DO_MAC=1
case "${1:-}" in
  --linux)       DO_LINUX=1 ;;                 # macOS + Linux
  --linux-only)  DO_LINUX=1; DO_MAC=0 ;;       # Linux only (macOS already built)
  "" )           ;;                             # macOS only
  * ) echo "usage: release-desktop.sh [--linux | --linux-only]" >&2; exit 2 ;;
esac

VERSION="$(node -p "require('./src-tauri/tauri.conf.json').version")"
echo "▶ Wadi desktop release build — v${VERSION}"

# 1. Build BOTH frontend surfaces that live under docs/ (the app bundles docs/).
#    build:tauri rebuilds docs/app (the viewer); build:playground rebuilds docs/dsl.
#    emptyOutDir is false on both, so they don't wipe each other or the templates.
#    This runs on the HOST so the Linux container can reuse the built docs/ as-is
#    (it must NOT rebuild the frontend — the host's editor/node_modules holds
#    macOS-native binaries that fail to load under Linux).
if [ "$DO_MAC" = "1" ]; then
  echo "▶ [1/3] Building frontend (viewer + DSL playground) into docs/…"
  npm --prefix editor run build:tauri
  npm --prefix wadi-dsl run build:playground

  # 2. macOS universal bundle.
  #    Ensure both apple-darwin targets exist (universal needs Intel + Apple Silicon).
  #    We build the frontend ourselves above and pass an EMPTY beforeBuildCommand, because
  #    `cargo tauri build`'s hook can run from the wrong cwd (a known repo gotcha).
  echo "▶ [2/3] Building macOS universal .app + .dmg…"
  # Signing/notarization status (tauri reads the APPLE_* env vars during the bundle step).
  if [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
    echo "  signing as: ${APPLE_SIGNING_IDENTITY}"
    if [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_PASSWORD:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ]; then
      echo "  notarizing:  yes (Apple ID ${APPLE_ID}, team ${APPLE_TEAM_ID}) — this adds a few minutes"
    else
      echo "  notarizing:  NO — set APPLE_ID + APPLE_PASSWORD + APPLE_TEAM_ID to notarize"
    fi
  else
    echo "  signing:     none (unsigned build; fill scripts/.signing.env to sign — see check-signing.sh)"
  fi
  rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null 2>&1 || true
  cargo tauri build --target universal-apple-darwin \
    --config '{"build":{"beforeBuildCommand":""}}'

  DMG_MAC="src-tauri/target/universal-apple-darwin/release/bundle/dmg/Wadi_${VERSION}_universal.dmg"
  if [ -f "$DMG_MAC" ]; then
    echo "  ✓ $DMG_MAC ($(du -h "$DMG_MAC" | cut -f1))"
  else
    echo "  ✗ expected DMG not found at $DMG_MAC" >&2
    exit 1
  fi
else
  echo "▶ [1-2/3] Skipping macOS (--linux-only); reusing the docs/ built by a prior run."
fi

# 3. Linux (optional) — Tauri needs Linux system libs, so build in a container.
#    On Apple Silicon this runs x86_64 under emulation (slow but works); drop the
#    --platform line to produce an arm64 Linux build instead.
#
#    Key points learned the hard way:
#    - The container does NOT rebuild the frontend. docs/ is already built on the host,
#      and reusing the host's editor/node_modules (macOS-native binaries) fails under
#      Linux. So node/npm are not installed here — we just bundle the existing docs/.
#    - CARGO_TARGET_DIR points at a container-local path (NOT the mounted target/), so
#      Linux object files never mix with the host's macOS build and nothing is left in
#      the repo except the finished installers we copy back.
if [ "$DO_LINUX" = "1" ]; then
  echo "▶ [3/3] Building Linux .deb in Docker (ubuntu 22.04, no frontend rebuild)…"
  if ! docker info >/dev/null 2>&1; then
    echo "  ✗ Docker daemon not running — start Docker Desktop and retry" >&2
    exit 1
  fi
  # Clear any stale bundles from a previous run so we only publish fresh ones.
  rm -rf src-tauri/target/release/bundle/appimage src-tauri/target/release/bundle/deb
  # Named volumes persist the Rust toolchain, the cargo registry, and the build
  # cache across runs, so a re-build (e.g. after a source fix) is fast instead of
  # recompiling every dependency from scratch under emulation.
  docker run --rm --platform linux/amd64 -v "$REPO":/w \
    -v wadi-lxcargo:/root/.cargo -v wadi-lxrustup:/root/.rustup -v wadi-lxtarget:/tmp/lxtarget \
    -w /w ubuntu:22.04 bash -euo pipefail -c '
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq curl build-essential libwebkit2gtk-4.1-dev \
      libappindicator3-dev librsvg2-dev patchelf libssl-dev file >/dev/null
    [ -x "$HOME/.cargo/bin/rustc" ] || curl -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal >/dev/null 2>&1
    . "$HOME/.cargo/env"
    [ -x "$HOME/.cargo/bin/cargo-tauri" ] || cargo install tauri-cli --version "^2" --locked
    export CARGO_TARGET_DIR=/tmp/lxtarget
    # docs/ is already built on the host; empty beforeBuildCommand → just bundle it.
    # We build ONLY the .deb: AppImage bundling needs linuxdeploy, which does not run
    # reliably in an emulated x86_64 container (FUSE), and .deb already covers
    # Debian/Ubuntu/Mint/Pop. AppImage can be added later on a native Linux runner.
    cargo tauri build --bundles deb --config "{\"build\":{\"beforeBuildCommand\":\"\"}}"
    # Copy the finished .deb back into the repo where publish-release.sh looks.
    if compgen -G "/tmp/lxtarget/release/bundle/deb/*.deb" >/dev/null; then
      mkdir -p /w/src-tauri/target/release/bundle/deb
      cp -f /tmp/lxtarget/release/bundle/deb/*.deb /w/src-tauri/target/release/bundle/deb/
    fi
  '
  ls src-tauri/target/release/bundle/deb/*.deb 2>/dev/null \
    | sed "s/^/  ✓ /" || echo "  ⚠ no Linux .deb was produced (see output above)"
else
  echo "▶ [3/3] Skipping Linux (pass --linux to build it in Docker)."
fi

echo ""
echo "✓ Done. Publish to a GitHub Release with:"
echo "    scripts/publish-release.sh v${VERSION}"
