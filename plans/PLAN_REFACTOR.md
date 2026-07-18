# Refactoring Plan: Consolidate around the editor as source of truth

**Status**: Planned, not yet started · Locked decisions dated 2026-07-13
**Owner**: bijoor
**Estimated total effort**: ~13 hours (up from 11 in the original draft — the docs-subfolder restructure adds ~2 h of viewer-reference updates)

## Motivation

Every SVG-generation change currently requires editing two codebases (Python `svg_2d.py` + TypeScript `editor/src/svg2d/`) and re-running byte-diff parity harnesses. That's the pain point. We also have 20+ Python files and 4 shell scripts sitting at the repo root alongside the editor, config, docs, and textures — hard to see what's what.

## Target end state

- **Editor is authoritative for**: all SVG generation, all interactive editing, live 3D preview, form-based schema authoring.
- **Python is authoritative for**: Blender geometry construction, GLB export, Cycles photorealistic renders, BlenderKit material application.
- **Shared, tiny, JSON-driven layer**: `house_config.json` + `schema/` + a handful of pure-Python helpers (`house_expand.py`, `roof_geometry.py`) the Blender pipeline needs.
- **One place per concern**: SVG generation lives only in TS. Blender geometry lives only in `blender_3d.py`. Config schema lives only in JSON Schema; Zod is derived.
- **Clean folder layout**: Python in `pipeline/`, docs assets grouped by dimension (2D / 3D) with view-type subfolders, planning docs in `docs-internal/`.

## Locked decisions (from user 2026-07-13)

1. **Keep the entire `svg_2d.py` as reference** — 8,560 lines stay checked in as the canonical reference implementation. Parity harnesses continue to diff against it. Not called from the Blender build path anymore, but callable directly for regression checks and for the Python-only SVG regen script that some users may still prefer.
2. **Full folder reshuffle** — Python into `pipeline/`, editor unchanged, docs regrouped, planning docs moved.
3. **`docs/` subfolders for 3D and 2D assets**, with per-view-type subfolders under 2D. See target layout below.
4. **Move planning docs to `docs-internal/`** — keeps `README.md` at repo root but everything else (`CLAUDE.md`, `PLAN_*.md`) moves.

## Target folder layout

```
wadi/                         (repo root — rename optional)
├── README.md                         short pointer to docs-internal/
├── house_config.json                 canonical source of truth
├── config/
│   ├── schema/
│   │   └── house_config.schema.json  JSON Schema draft 2020-12
│   └── global_defaults.py            was config.py's GLOBAL_CONFIG
├── editor/                           React SPA — unchanged internal layout
│   ├── src/
│   ├── scripts/
│   └── ...
├── pipeline/                         Python — Blender build + render
│   ├── loader/                       JSON hydration (no bpy)
│   │   ├── config_loader.py          was house_config.py
│   │   ├── house_expand.py
│   │   └── roof_geometry.py
│   ├── blender/                      requires bpy
│   │   ├── build.py                  was wadi_config.py
│   │   ├── geometry.py               was blender_3d.py
│   │   ├── facade.py                 was wadi_lib.py
│   │   └── export_glb.py             extracted from build_house
│   ├── render/                       Cycles + BlenderKit
│   │   ├── apply_materials.py
│   │   ├── apply_realistic_materials.py
│   │   ├── render_perspectives.py
│   │   ├── render_final_textures.py
│   │   ├── render_with_blenderkit.py
│   │   ├── render_with_procedural.py
│   │   ├── render_with_textures.py
│   │   ├── render_all_perspectives_with_textures.py
│   │   ├── render_realistic_perspectives.py
│   │   └── build_and_render_realistic.py
│   ├── reference/                    NOT called from build; kept as parity reference
│   │   ├── svg_2d.py                 full 8,560 lines
│   │   ├── regenerate_combined_svgs.py
│   │   ├── generate_floor_plans.py
│   │   └── generate_pillar_elevations.py
│   └── test/                         diagnostic scripts (opt-in)
│       ├── test_crop_debug.py
│       └── test_texture_scale.py
├── scripts/                          user-invocable entry points
│   ├── build.sh                      Blender headless: build + GLB export
│   ├── render.sh                     apply materials + render perspectives
│   ├── regen_svgs.sh                 run editor TS SVG generator → docs/2d/
│   ├── regen_svgs_python.sh          run svg_2d.py reference generator
│   ├── parity.sh                     run all editor parity harnesses
│   └── dev.sh                        start editor dev server
├── docs/                             GH Pages root
│   ├── index.html                    model viewer (updated for new paths)
│   ├── house_config.json             copied at editor build time
│   ├── editor/                       Vite build output
│   ├── 3d/
│   │   ├── wadi.glb
│   │   ├── realistic_render.png
│   │   └── perspectives/             was realistic_perspectives/
│   │       ├── aerial.png
│   │       ├── eye_level_front.png
│   │       ├── eye_level_back.png
│   │       ├── front_left_corner.png
│   │       ├── front_right_corner.png
│   │       ├── back_left_corner.png
│   │       └── back_right_corner.png
│   └── 2d/
│       ├── floor_plans/
│       │   ├── floor_plan_0_Ground_Floor.svg
│       │   ├── floor_plan_1_First_Floor.svg
│       │   ├── floor_plans_combined.svg
│       │   └── pdf/
│       │       └── floor_plan_0_Ground_Floor.pdf
│       ├── elevations/
│       │   ├── elevation_front.svg
│       │   ├── elevation_back.svg
│       │   ├── elevation_left.svg
│       │   ├── elevation_right.svg
│       │   └── elevations_combined.svg
│       ├── pillar_elevations/
│       │   ├── pillar_elevation_front.svg
│       │   ├── pillar_elevation_back.svg
│       │   ├── pillar_elevation_left.svg
│       │   └── pillar_elevation_right.svg
│       └── pillar_sections/
│           ├── pillar_section_col_2.svg
│           ├── pillar_section_col_3.svg
│           ├── pillar_section_col_4.svg
│           ├── pillar_section_row_b.svg
│           ├── pillar_section_row_c.svg
│           └── pillar_section_row_d.svg
├── docs-internal/                    project docs (not on Pages)
│   ├── CLAUDE.md
│   ├── PLAN_WEB_EDITOR.md
│   ├── PLAN_REFACTOR.md              this doc
│   ├── BLENDERKIT_INSTRUCTIONS.md
│   └── TEXTURE_DOWNLOAD_INSTRUCTIONS.md
├── textures/                         unchanged
└── (deleted): konkan_house_lib_old.py, per-run objects_debug_*.json
```

## Migration phases

Each phase is independently useful and reversible. Ship them serially with commits between.

### Phase R1 — Cut SVG generation out of the Blender build path (~2 h)

- `wadi_config.py::build_house` currently calls `generate_all_floor_plans` / `generate_all_elevations` / `generate_combined_*`. **Remove those calls.**
- Blender build now only produces GLB; SVGs come from the editor.
- Nothing physically moves yet — this is a wiring change only.
- Add a placeholder `scripts/regen_svgs.sh` that shells out to the current `regenerate_combined_svgs.py` (Phase R2 will replace it).

**Verification**: Blender Alt+P still produces a working GLB; the SVGs in `docs/` are unchanged (nothing regenerates them until you run the script).

### Phase R2 — Add a TS "SVG dump" CLI in the editor (~4 h)

- Extend `editor/scripts/` with `dump-svgs.mjs` that reads `house_config.json`, calls the editor's `generateAllFloorPlans` / `generateAllElevations` / `generateCombined*` functions, and writes files to a caller-specified directory.
- `scripts/regen_svgs.sh` becomes: `cd editor && npx tsx scripts/dump-svgs.mjs --out ../docs/2d/`.
- Parity harnesses (`parity-*.mjs`) continue to compare TS output vs. Python reference (which now lives at `pipeline/reference/svg_2d.py`).

**Verification**: `scripts/regen_svgs.sh` produces byte-identical SVGs to what the current `regenerate_combined_svgs.py` produces (compared via `scripts/parity.sh`).

### Phase R3 — Docs asset reorg + viewer update (~2 h)

- Create `docs/2d/` and `docs/3d/` subfolders with the per-type nested structure shown above.
- `git mv` existing SVGs / GLB / renders into the new locations.
- Update `docs/index.html` to reference the new paths (the tabbed model viewer hardcodes filenames like `elevation_front.svg` → now `2d/elevations/elevation_front.svg`).
- Update the editor's default-load paths (currently `../house_config.json` — stays where it is; only the SVG output locations change).
- Update `.gitignore` — `docs/*.glb` becomes `docs/3d/*.glb`; add `docs/objects_debug_*.json` explicitly.

**Verification**: Open the GH Pages site (or serve `docs/` locally) — every tab in `docs/index.html` still renders its intended asset.

### Phase R4 — Python folder reshuffle (~3 h)

- `git mv` all Python files into their `pipeline/` subfolders per the target layout.
- Rename `config.py` → `config/global_defaults.py`, `house_config.py` → `pipeline/loader/config_loader.py`.
- Update every import statement. The scary one: `wadi_config.py`'s importlib.reload chain that assumes `config → svg_2d → blender_3d → wadi_lib → house_config`. New chain: `global_defaults → geometry → facade → config_loader`.
- Update the absolute path hard-coded in several scripts (`sys.path.insert(0, '/Users/…/blender')`) to resolve relative to `__file__`.
- Update `editor/vite.config.ts`'s copy-plugin src path (`../house_config.json` may stay if we keep it at repo root; otherwise update to the new location).
- Delete `konkan_house_lib_old.py` (already marked legacy).

**Verification**: Blender Alt+P still works end-to-end from the new `pipeline/blender/build.py`; every `scripts/*.sh` still works.

### Phase R5 — Consolidate shell scripts + planning docs (~1 h)

- Move `apply_materials.sh` into `scripts/` as `scripts/render.sh` (or split into `scripts/apply_materials.sh` + `scripts/render.sh`).
- Create the other `scripts/*.sh` entry points listed in the target layout.
- `git mv` `CLAUDE.md`, `PLAN_*.md`, `BLENDERKIT_INSTRUCTIONS.md`, `TEXTURE_DOWNLOAD_INSTRUCTIONS.md` → `docs-internal/`.
- Add a short `README.md` at repo root pointing to `docs-internal/README.md` (or embed a summary).
- Update `CLAUDE.md` to describe the new folder layout.

**Verification**: `README.md` renders correctly on GitHub; `scripts/*.sh` all work.

### Phase R6 — Cleanup + final docs pass (~1 h)

- Add a `pipeline/README.md` explaining what stays on the Python side vs. what moved to the editor.
- Update `editor/README.md` to reflect the new asset paths.
- Remove any dead code discovered along the way (`objects_debug_*.json`, orphaned imports).
- Verify the ignore rules cover the new directory layout.

**Verification**: A fresh clone + following the top-level README works end-to-end for build, render, and SVG regeneration.

## Open items to resolve at implementation time

- **Loft floor SVG**: currently, Python's `generate_all_floor_plans` returns `''` for the loft (only object is `hip_roof`) and skips writing the file, so `docs/floor_plan_2_Loft_Floor.svg` (3.3 KB, stale from July 9) never gets refreshed. After the move, decide whether to delete it or add a legitimate loft-floor 2D generator.
- **`generate_pillar_elevations.py`** produces `pillar_elevation_*.svg` / `pillar_section_*.svg` — the editor doesn't have a TS port for these. Either (a) port pillar section generators to TS in a later phase, or (b) keep `generate_pillar_elevations.py` alive and have `scripts/regen_svgs.sh` call both the TS dump AND this Python script.
- **BlenderKit paths** in `pipeline/render/*.py` may hard-code `textures/blenderkit/` — verify these still resolve after the file moves.
- **`docs/pdf/`** folder exists; contents are pillar-related. Fold under `docs/2d/pillar_sections/pdf/` or drop.

## Risks

1. **Blender importlib.reload chain breaks silently on file renames.** Must audit `wadi_config.py` (new: `pipeline/blender/build.py`) and update the reload order after every rename in R4.
2. **`docs/index.html` viewer** links to specific SVG filenames. If R3 goes ahead without updating the viewer references, every tab breaks. Must be done atomically.
3. **BlenderKit and texture paths** — Python render scripts may resolve textures relative to their own `__file__`; after moving into `pipeline/render/`, those paths shift. Test at least one render before wrapping.
4. **`sys.path.insert` absolute paths** — several scripts hard-code `/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender`. Must be replaced with `pathlib.Path(__file__).resolve().parent.parent.parent` or similar during R4.

## Safety plan

Before starting the refactor, commit the current working version to GitHub as a safety snapshot. Then work through phases R1 → R6 with a commit after each. If any phase breaks something, `git revert` gets us back to a known-good state within that phase.
