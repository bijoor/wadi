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
#   - Linux .AppImage/.deb  (x86_64, via Docker)             [with --linux, needs Docker]
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

DO_LINUX=0
[ "${1:-}" = "--linux" ] && DO_LINUX=1

VERSION="$(node -p "require('./src-tauri/tauri.conf.json').version")"
echo "▶ Wadi desktop release build — v${VERSION}"

# 1. Build BOTH frontend surfaces that live under docs/ (the app bundles docs/).
#    build:tauri rebuilds docs/app (the viewer); build:playground rebuilds docs/dsl.
#    emptyOutDir is false on both, so they don't wipe each other or the templates.
echo "▶ [1/3] Building frontend (viewer + DSL playground) into docs/…"
npm --prefix editor run build:tauri
npm --prefix wadi-dsl run build:playground

# 2. macOS universal bundle.
#    Ensure both apple-darwin targets exist (universal needs Intel + Apple Silicon).
#    We build the frontend ourselves above and pass an EMPTY beforeBuildCommand, because
#    `cargo tauri build`'s hook can run from the wrong cwd (a known repo gotcha).
echo "▶ [2/3] Building macOS universal .app + .dmg…"
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

# 3. Linux (optional) — Tauri needs Linux system libs, so build in a container.
#    On Apple Silicon this runs x86_64 under emulation (slow but works); drop the
#    --platform line to produce an arm64 Linux build instead.
if [ "$DO_LINUX" = "1" ]; then
  echo "▶ [3/3] Building Linux .AppImage/.deb in Docker (ubuntu 22.04)…"
  if ! docker info >/dev/null 2>&1; then
    echo "  ✗ Docker daemon not running — start Docker Desktop and retry with --linux" >&2
    exit 1
  fi
  docker run --rm --platform linux/amd64 -v "$REPO":/w -w /w ubuntu:22.04 bash -euo pipefail -c '
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq curl build-essential libwebkit2gtk-4.1-dev \
      libappindicator3-dev librsvg2-dev patchelf libssl-dev file
    curl -fsSL https://sh.rustup.rs | sh -s -- -y >/dev/null
    . "$HOME/.cargo/env"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
    apt-get install -y -qq nodejs
    cargo install tauri-cli --version "^2" --locked >/dev/null 2>&1 || cargo install tauri-cli --locked
    npm --prefix editor run build:tauri
    npm --prefix wadi-dsl run build:playground
    cargo tauri build --config "{\"build\":{\"beforeBuildCommand\":\"\"}}"
  '
  echo "  ✓ Linux bundles under src-tauri/target/release/bundle/{appimage,deb}/"
else
  echo "▶ [3/3] Skipping Linux (pass --linux to build it in Docker)."
fi

echo ""
echo "✓ Done. Publish to a GitHub Release with:"
echo "    scripts/publish-release.sh v${VERSION}"
