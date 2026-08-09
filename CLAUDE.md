# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Procedurally author, edit, and render houses: 3D models plus 2D floor plans,
elevations, and dimensioned SVGs. A house is authored either as a `.wdl` DSL file
or directly as a `.wadi` config, and rendered by a TypeScript + Three.js pipeline.
Output is published to `docs/` for GitHub Pages (an interactive viewer + the DSL
playground), and shipped as a Tauri desktop app and an MCP server.

**The TypeScript code in `editor/src` is the source of truth.** The old
Python/Blender pipeline is **retired** — `python/` and `archive/` are kept for
history only; do not import from them or treat them as live.

## How things run

- **The editor / viewer** (`editor/`) — a React + Three.js app. `editor/src` holds
  the whole pipeline: the Zod schema, the parametric resolver, geometry expansion,
  the 2D SVG engine, and the 3D renderer. Two Vite bundles are built from it: the
  **viewer** ("the app", source `editor/viewer.html` → `docs/app/`) and the editor
  SPA. `npm --prefix editor run build` builds both; `vite build` alone leaves the
  viewer stale (see the "two Vite bundles" gotcha).
- **The `.wdl` DSL** (`wadi-dsl/`) — a Langium grammar + generators. It compiles a
  `.wdl` to a `.wadi` HouseConfig through the REAL pipeline (`resolveParametric` +
  `expandRoomWalls` from `editor/src`), and decompiles `.wadi` back to `.wdl`. It
  ships a browser playground (published to `docs/dsl/`, the WDL editor) and an
  in-process Langium LSP.
- **The MCP server** (`wadi-mcp/`) — bundles the compiler, the reference docs, and a
  rasteriser so an agent can check / preview / reference `.wdl` without the repo. It
  is a self-contained esbuild bundle; `npm --prefix wadi-mcp publish` is a manual step.
- **The desktop app** (`src-tauri/`) — a Tauri shell around the viewer (`docs/app`),
  with native file-open, a live config-file watcher, and a templates folder.

## Architecture

Repo layout (top level):
```
editor/     — the TypeScript pipeline + React editor/viewer (SOURCE OF TRUTH)
wadi-dsl/   — the .wdl DSL: Langium grammar, generators, playground, LSP
wadi-mcp/   — MCP server (bundles the compiler + reference docs + rasteriser)
src-tauri/  — Tauri desktop app (wraps the viewer)
wadi-skill/ — the agent-neutral "architect" skill (SKILL.md + reference/ + scripts/)
documentation/ — narrative docs (concept, personas, extending the DSL, the method)
docs/       — GitHub Pages output: app/ (viewer), dsl/ (playground), templates/, GLBs
library/    — reusable parametric .wadi models
python/, archive/ — RETIRED Python/Blender pipeline; history only, do not import
```

Inside `editor/src` the key subsystems:
```
schema/        — the Zod HouseConfig schema (schema/houseConfig.ts = source of truth);
                 primitive `fields` under schema/fields generate schema + form + docs
registry/      — NodeDefinition per primitive (registry/nodes/*): one file owns a
                 primitive's whole surface (schema, form, 3D/2D render, expand,
                 facets, and per-primitive constraints). getNode/allNodes/facetsFor
param/         — parametric layer: variables/points/grid + formula resolver (resolve.ts)
svg2d/         — 2D SVG engine + geometry expansion (expand.ts = expandRoomWalls, the
                 per-renderer chokepoint that flattens rooms/stairs/components/openings)
three/         — 3D renderer (coords.ts = the world→Three coordinate mapping)
model/         — spatial query layer (geom.ts adapter over @flatten-js/core;
                 spatialModel.ts = buildSpatialModel + overlap/near/within/distance)
lint/          — structural conventions: a declarative per-constraint registry under
                 lint/constraints/ (C1-C10 + a spiral SP1); structural.ts is a thin loop
pipeline/, viewer/, forms/, io/, estimate/, templates/ — compositor, viewer shell,
                 property forms, file IO, quantity estimates, template catalog
```

- **Adding an object type** = one file under `editor/src/registry/nodes/` exporting a
  `NodeDefinition` (schema, `fields`, render hooks, `expand`, `facets`, optional
  `constraints`), registered in `registry/registry.ts`. `item`, `model`, and
  `spiral_staircase` are fully registry-driven. Legacy types still dispatch through
  `svg2d`/`three` with a registry-consult-first fallback.
- **The `.wdl` DSL is the authored source**; it compiles to a `.wadi` HouseConfig.
  `house_config.json` (and any `.wadi`) is a config INSTANCE, not the schema.

## Coordinate system & units (important — easy to get wrong)

- **Input is Inkscape-style**: origin top-left, X right, Y *down*. SVG output uses
  these coordinates directly.
- **3D conversion** lives in `editor/src/three/coords.ts`: it maps world (X east,
  Y south, Z up) to Three.js and recenters the model at the plot midpoint.
- **Units are ambiguous by design.** A config sets `units` (`system` + `per_unit`,
  e.g. `feet_inches` with `per_unit 10` = 10 units per foot). Dimension display and
  metric conversions pull from different constants; do not "fix" one path without
  understanding both.
- Sloping walls: supply `height_end` alongside `height` on a `wall`. Roofs use the
  unified `roof` object (segments + slope + endpoint style); the old `gable_roof`
  type is gone.

## Common commands

```bash
# Fast TS iteration (no build): typecheck + tests + the geometry parity gate
npx --prefix editor tsc --noEmit
npm --prefix editor run test -- run
npm --prefix editor run parity-render         # 6 configs must stay byte-identical

# Regenerate the .wdl parser after a grammar change (generated files are gitignored)
npm --prefix wadi-dsl run langium:generate
npm --prefix wadi-dsl test

# Generated reference docs (do NOT hand-edit the outputs)
node wadi-skill/architect/scripts/gen-schema-doc.mjs editor/src/schema/houseConfig.ts \
  wadi-skill/architect/reference/data-model.md      # data-model.md from the Zod schema
npm --prefix editor run gen-conventions-doc         # conventions.md from lint/constraints/*

# Check / preview a .wdl (the architect skill's CLI)
wadi-skill/architect/scripts/check.sh house.wdl
wadi-skill/architect/scripts/preview.sh house.wdl

# Build the viewer + desktop app (see the Tauri-release-build notes in memory)
npm --prefix editor run build                       # editor + viewer bundles
```

## Output / deployment

`docs/` is the GitHub Pages root. `docs/app/` is the built viewer ("the app"), source
`editor/viewer.html`; `docs/dsl/` is the WDL playground; `docs/index.html` is the
hand-authored marketing landing page (edit directly). GLBs and diagnostic dumps are
gitignored.

## Gotchas

- **Generated docs — never hand-edit the output.** `reference/data-model.md` is
  generated from the Zod schema; `reference/conventions.md` is generated from the
  constraint modules + `conventions.preamble.md`. Edit the source + regenerate.
- **Parity gate.** `npm --prefix editor run parity-render` must stay 6/6 byte-identical;
  regenerate the golden only for an intentional geometry change
  (`npx tsx scripts/parity-render.mjs --update`).
- **Two Vite bundles.** The editor and the viewer are separate bundles; use
  `npm run build`, not a bare `vite build`, or the viewer at `docs/app` goes stale.
- **Templates** live in `editor/public/templates/` (source) with build-output mirrors
  under `docs/templates/` and `docs/editor/templates/`; edit the source.
- **Do not import from `python/` or `archive/`** — the Python/Blender pipeline is
  retired; those are history only.
- **`build_floor`/`bpy` are gone.** If a doc or script still references them, it is
  stale and should be updated to the TS registry / `expandRoomWalls` path.
