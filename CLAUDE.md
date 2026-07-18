# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Procedurally generate 3D house models (Blender) plus 2D floor plans, elevations, and dimensioned SVGs from a single Python configuration. Output is published to `docs/` for GitHub Pages (interactive GLB viewer + SVGs).

## How things run

Two very different execution environments share the same library code — this shapes every design decision in the repo:

- **Inside Blender**: `wadi_config.py` is loaded into Blender's Text Editor and run with Alt+P. It imports `blender_3d.py` (which requires `bpy`) and drives the full pipeline: clear scene → build geometry → generate SVGs → `export_to_web()` writing `docs/wadi.glb`.
- **Standalone (no Blender)**: SVG-only helpers like `generate_floor_plans.py` and `regenerate_combined_svgs.py` import only `config.py` + `svg_2d.py` and `exec()` the `HOUSE_CONFIG` dict out of `house_config.py` while stripping the `wadi_lib` import. This avoids pulling in `bpy`. If you add bpy usage, keep it in `blender_3d.py` — never in `svg_2d.py` or `config.py`.
- **Blender CLI** (headless): `Blender <file> --python <script>` — the pattern used by earlier material/texture experiments now archived under `archive/`. If you resurrect one, note it will `exec(open('wadi_config.py').read())` to build the model, then mutate the scene.
- **Browser editor** (`editor/`, published to `docs/editor/`): a React + Three.js SPA that reads and writes `house_config.json`, ports `svg_2d.py` / `house_expand.py` / `roof_geometry.py` to TypeScript for byte-identical live SVG previews, and renders a live 3D preview with CSG openings. `house_config.py` is now a thin loader that reads `house_config.json` — JSON is the source of truth for both Python and the browser. See `editor/README.md` for the workflow.

Because scripts are typically pasted into Blender's editor across sessions, `wadi_config.py` and `wadi_lib.py` aggressively `importlib.reload()` their dependencies. When editing library modules, preserve the reload order (`config` → `svg_2d` → `blender_3d` → `wadi_lib` → `house_config`) or stale code will run.

## Architecture

Repo layout (only the top level shown):
```
python/     — core library (all *.py the pipeline imports)
scripts/    — thin helper scripts + shell wrappers (regenerate_*, generate_*, serve.sh…)
editor/     — React + Three.js browser editor (TS port + parity harness)
docs/       — GitHub Pages output (2d/, 3d/, editor/, GLBs)
archive/    — legacy render/material experiments; do NOT import from here
plans/      — planning docs (retained for history)
schema/, assets/, textures/  — support data
house_config.json           — single source of truth (Python + editor both read this)
```

Inside `python/` the module graph is:
```
config.py  ──────────────┐  (GLOBAL_CONFIG defaults; no bpy)
                         ├──▶ wadi_lib.py  (facade that re-exports everything)
blender_3d.py  (bpy) ────┤           ▲
svg_2d.py  (no bpy) ─────┘           │
                                     │
house_config.py  ────────────────────┤  (loads HOUSE_CONFIG from ../house_config.json)
                                     │
wadi_config.py  ─────────────┘  (entry point: build_house, generate_*, export_to_web)
```

- `wadi_lib.py` is a thin facade — no logic, just re-exports. Add new public functions to `blender_3d.py` or `svg_2d.py`, then extend the `__all__` list and `from … import …` block here.
- `house_config.py` is the user-editable house description. It overrides `GLOBAL_CONFIG` at import time, so any change to keys like `floor_heights`, `wall_thickness`, `plinth_height` takes effect only if the config is re-imported (hence the reloads).
- `wadi_config.py::build_floor()` dispatches on the `'type'` field of each object in `floors[i]['objects']` (`floor_slab`, `beam`, `room`, `wall`, `staircase`, `pillar`, `door`, `window`, `gable_roof`). Adding a new object type requires a branch here plus a `create_*` function in `blender_3d.py` and a `svg_draw_*` in `svg_2d.py` for plan/elevation rendering.
- After all objects on a floor are placed, `apply_openings_to_walls(floor_num)` runs boolean-subtract modifiers for doors/windows. Door/window objects are created hidden and carry a `target_wall` custom property set from `room + direction` (e.g. `Verandah_North`). `export_to_web()` later applies all booleans and deletes the hidden cutters before exporting GLB — so post-export the scene is destructive.

## Coordinate system & units (important — easy to get wrong)

- **Input is Inkscape-style**: origin top-left, X right, Y *down*. SVG floor plans use these coordinates directly.
- **Blender conversion** (`inkscape_to_blender`): flips Y and recenters at plinth center (`set_model_origin_from_plinth` sets `model_origin_offset_x/y` before building). SVG output does *not* apply the centering — it keeps raw coordinates.
- **Units are ambiguous by design.** `house_config.py` sets `units_to_meters_ratio: 0.1` (1 unit = 0.1 m), while dimension display uses `unit_conversion: 10.0` (10 units = 1 foot). Comments in configs saying "feet" usually mean "the display value after dividing by 10" — e.g. `plot_length: 450` renders as "45'" but is 45 m in Blender. Don't "fix" this without understanding both paths; SVG dimensioning and 3D geometry pull from different constants.
- Sloping walls: supply `height_end` in addition to `height` on a `wall` object. Gable geometry uses the dedicated `gable_roof` type.

## Common commands

```bash
# Regenerate combined SVGs without Blender (fast iteration on 2D output).
# All helper scripts live under scripts/ but must be invoked from repo root
# so their internal chdir/sys.path setup resolves — the wrappers already
# handle both.
python scripts/regenerate_combined_svgs.py
python scripts/generate_floor_plans.py

# Generic Blender CLI invocation pattern (headless)
/Applications/Blender.app/Contents/MacOS/Blender house-model.blend --python scripts/<script>.py
```

For the full 3D build + GLB export, open `wadi_config.py` in Blender's Text Editor and press Alt+P. The bottom of that file toggles which outputs are produced (`generate_all_floor_plans`, `generate_all_elevations`, `generate_combined_*`, `export_to_web`) — comment lines to skip stages.

## Output / deployment

`docs/` is the GitHub Pages root. `index.html` (checked in) is the viewer; it loads `wadi.glb` (gitignored — regenerate via `export_to_web()`). SVG floor plans, elevations, and combined views are committed. `objects_debug_*.json` are diagnostic dumps from elevation generation and are gitignored.

## Gotchas

- `house-model.blend` is gitignored; the source of truth is the Python config, not the .blend file. Material edits done in the Blender UI are lost when the script rebuilds the scene (`init_scene()` → `clear_scene()`).
- Anything under `archive/` (including the legacy `konkan_house_lib_old.py` monolith and the material/texture render experiments) is kept for reference only — do not import from there.
- `build_floor()` still has a backward-compat branch for an older schema with `floor_slab`/`rooms`/`walls` keys. New configs should always use the unified `objects: [...]` list.
- The `sys.path.insert(0, '/Users/ashutoshbijoor/…/blender')` lines in several scripts are absolute paths for this machine. If the repo is moved, update those paths or replace with `os.path.dirname(__file__)`.
