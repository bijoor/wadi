# Konkan House

Procedurally generate a full construction package — floor plans, elevations, roof drawings, structural sections, a photoreal 3D render, and an interactive GLB — from a single declarative description of the house.

**Live site:** https://bijoor.github.io/konkan-house/
**Live editor:** https://bijoor.github.io/konkan-house/editor/

---

## What's in the box

From one file (`house_config.json`) the pipeline produces:

- **Per-floor plans** with room labels, wall thicknesses, openings, staircase, pillars, beams, dimensions
- **Elevations** (front / back / left / right) with pillars, walls, openings, roof profile
- **Roof plan** — one 145 KB master `roof_plan.svg` that lays out **13 panels** on a single canvas (top view, isometric perspective, two cross-sections, three slope roll-outs, framing detail, eave cross-section, truss elevation, materials takeoff, consolidated BOM, tile roofing). Each panel is *also* saved as its own cropped SVG, and a `roof_panels.json` manifest lets the web viewer and PDF stitcher iterate them without hard-coding the list
- **Pillar / slab structural sections** for each column and row
- **Interactive 3D model** (GLB) with per-layer visibility, orbit / dolly controls, and a split "exploded" variant
- **Photoreal perspective renders** from 7 angles (Cycles + PBR materials)
- **Combined multi-page PDF** stitching all of the above together

Everything is regenerated from the same JSON, so a schema change ripples through every artifact.

---

## Three environments, one source of truth

`house_config.json` at the repo root is the only file you edit. Three environments read it, each producing a different slice of the output:

```
                  ┌───────────────────────────────────────────────┐
                  │        house_config.json (source of truth)    │
                  └────────────────────┬──────────────────────────┘
                                       │
        ┌──────────────────────────────┼───────────────────────────────┐
        ▼                              ▼                               ▼
┌────────────────────┐   ┌────────────────────────┐   ┌───────────────────────────┐
│  Browser viewer    │   │  Browser editor        │   │  Blender (optional)       │
│  docs/index.html   │   │  docs/editor/          │   │  scripts/regenerate_*.sh  │
├────────────────────┤   ├────────────────────────┤   ├───────────────────────────┤
│ read-only, mobile- │   │ full edit UI with      │   │ produces the 7 photoreal  │
│  friendly, tabbed  │   │  live previews for     │   │  Cycles renders under     │
│ shows plans /      │   │  every 2D drawing +    │   │  docs/3d/perspectives/*   │
│  elevations /      │   │  3D scene              │   │                           │
│  roof / 3D scene   │   │ save / download JSON   │   │ NOT required to view or   │
│                    │   │                        │   │  edit the model           │
└────────────────────┘   └────────────────────────┘   └───────────────────────────┘

  Both browser apps build every 2D drawing and the 3D scene ENTIRELY
  IN MEMORY from house_config.json. No static SVGs, no static GLBs.
  Same TypeScript source under editor/src/ powers both.
```

**Sharing a model = sharing the JSON.** Anyone who opens `docs/index.html` (or the editor) loads whatever `house_config.json` sits next to it. To share a specific design with someone else, send them the JSON file — they load it in either app and see exactly what you see.

The viewer at `docs/index.html` and the editor at `docs/editor/` share every generator function, the same Three.js scene code, and the same schema validator. Two Vite entry points, one code base.

---

## Repo layout

```
blender/                       (repo root)
├── house_config.json          ← THE ONE FILE YOU EDIT (symlink → docs/house_config.json)
├── python/                    core library (all *.py the pipeline imports)
│   ├── config.py              GLOBAL_CONFIG defaults (no bpy)
│   ├── house_config.py        loads HOUSE_CONFIG from ../house_config.json (→ docs/house_config.json)
│   ├── svg_2d.py              2D SVG generator (no bpy)
│   ├── svg_combined.py        combined-view helpers
│   ├── house_expand.py        room→wall/opening expansion
│   ├── roof_geometry.py       hip roof geometry derivation
│   ├── roof_frame.py          structural frame member list
│   ├── blender_3d.py          Blender geometry builder (requires bpy)
│   ├── konkan_house_lib.py    thin facade re-exporting the above
│   └── konkan_house_config.py Blender Alt+P entry point
├── editor/                    React + Three.js browser editor (TypeScript)
│   ├── src/                   (see editor/README.md for the full tour)
│   └── scripts/               parity + validation harnesses
├── scripts/                   thin runners + shell wrappers
│   ├── regen_svgs.sh                 → npm run dump-svgs (all 33 2D SVGs, TS-only)
│   ├── generate_3d_models.py         GLB (calls Blender headless)
│   ├── render_all_final.py           7 photoreal perspective renders
│   ├── auto_crop_perspectives.py     crops rendered PNGs
│   ├── generate_pdf.py               stitches PDF from renders
│   ├── extract_house_config_json.py  one-shot py→json converter
│   ├── regenerate_blender.sh         wrapper: renders + interactive 3D
│   ├── serve.sh                      python -m http.server on docs/
│   └── commit.sh                     stage + commit + push + Pages redeploy
├── docs/                      published to GitHub Pages
│   ├── index.html             tabbed viewer (3D, plans, elevations, roof, editor link)
│   ├── house_config.json      canonical location — auto-loaded by the editor
│   │                          (root's house_config.json is a symlink to this)
│   ├── 2d/                    per-type SVG output subfolders
│   │   ├── floor_plans/       per-floor + combined + PDF
│   │   ├── elevations/        per-side + combined
│   │   ├── pillar_elevations/ 4 structural elevations
│   │   ├── pillar_sections/   per-column and per-row sections
│   │   └── roof/              roof_plan.svg (master, 13 panels stitched)
│   │                          + 13 per-panel SVGs cropped from the master
│   │                          + roof_panels.json (manifest)
│   │                          + roof-cross-section.svg, roof-trusses.svg
│   │                            (hand-drawn refs the pipeline embeds as-is)
│   ├── 3d/                    GLB + perspective PNGs + layers.json
│   │   ├── konkan_house.glb
│   │   ├── konkan_house_exploded.glb
│   │   └── perspectives/      aerial + 6 named angles
│   └── editor/                built browser editor (vite output)
├── plans/                     planning docs kept for history
├── archive/                   legacy material/render experiments (do not import)
├── schema/                    JSON Schema for house_config
├── assets/, textures/         support data
├── house-model.blend          Blender scene (gitignored — rebuilt from Python)
├── README.md                  ← you are here
└── CLAUDE.md                  agent instructions / architecture cheat sheet
```

---

## Editing the model in the browser editor

The editor is the primary way to iterate on the design. It runs entirely in the browser — no server, no build step, no install.

### Open it

- **Hosted:** https://bijoor.github.io/konkan-house/editor/ (auto-loads the JSON from the same Pages site)
- **Local dev:** `cd editor && npm install && npm run dev` → http://localhost:5173

### Typical edit loop

1. **Pick a floor** in the sidebar (Ground / First / Loft / Roof).
2. **Click an object** in the object tree — rooms, walls, doors, windows, pillars, beams, slabs, staircase, roof.
3. **Edit fields** in the right-hand property panel. Everything updates live:
   - **Summary** tab — text summary of the current object
   - **Plans** tab — 2D floor plans (per floor + combined)
   - **Elevations** tab — front / back / left / right
   - **Pillars** tab — 4 outer pillar elevations + N internal row/column sections
   - **Roof** tab — master plan + 13 individual panels (top view, sections, slopes, framing, BOM, tile)
   - **3D** tab — Three.js scene with CSG openings, hip roof, staircase, section cutter, per-layer toggles, camera presets
4. **Undo / redo** with ⌘/Ctrl+Z / ⇧⌘/Ctrl+Z.
5. **Save** with ⌘/Ctrl+S or the Download button — writes to your Downloads folder.
6. **Drop the downloaded file** into `docs/house_config.json` (or overwrite via the root's `house_config.json` symlink — it's the same file). Every pipeline reads from this single physical location; no copy step, no drift.

The editor never touches your filesystem directly — it uses the browser's file picker for load and the download API for save. That's what lets it be a static single-page app on GitHub Pages.

### Room forms vs. object types

Rooms are the main authoring primitive — a room definition holds its own per-side walls plus any doors and windows on each side. Walls, pillars, beams, slabs, staircases, and the roof are top-level objects. See `editor/README.md` for the full form breakdown.

---

## Regenerating outputs

All commands below run from the repo root.

### 2D drawings + 3D scene — nothing to regenerate

Every 2D SVG (floor plans, elevations, pillar elevations + sections, roof panels) and the interactive 3D model are built **in the browser** from `house_config.json` on every visit. There are no cached files under `docs/2d/**` or `docs/3d/*.glb` any more — those artifacts don't exist as files, so there's nothing to regenerate.

Change the JSON, refresh, done. That's it.

### Optional: dump the SVGs to disk

If you need SVGs on disk for external use (import into Inkscape, hand off to a printer), the same generators can be run from Node:

```bash
./scripts/regen_svgs.sh                # → docs/2d/**   (33 files)
./scripts/regen_svgs.sh --in path/to/other_config.json --out /tmp/out
```

Wrapper calls `npm run dump-svgs` inside `editor/` (auto-installs deps on first run). Nothing else in the pipeline consumes those files — the browser apps compute them on the fly.

### 3D photoreal renders (only remaining Blender use)

Blender is now **only** needed for the 7 Cycles-rendered perspective PNGs. Everything else is TS. If you don't have Blender installed, the site still works — you just don't get the photoreal images.

```bash
./scripts/regenerate_blender.sh        # → docs/3d/perspectives/*.png
```

The script runs Blender headless via `render_all_final.py`, then crops whitespace with `auto_crop_perspectives.py`. Requires `/Applications/Blender.app` on macOS (or edit the `BLENDER=` line).

### Multi-page construction PDF

```bash
python3 scripts/generate_pdf.py
```

Stitches everything under `docs/` into a single browsable PDF at `docs/konkan_house.pdf`.

---

## Viewing the results

### Locally

```bash
./scripts/serve.sh              # python -m http.server on docs/, port 8000
```

Open http://localhost:8000 for the tabbed viewer (3D + all 2D drawings), or http://localhost:8000/editor/ for the editor.

### Published

The `docs/` folder is the GitHub Pages root. Pushing to `main` triggers a rebuild.

---

## Deploying to GitHub Pages

### One-time setup

1. Push the repo to GitHub.
2. **Settings → Pages** → *Deploy from a branch* → branch `main`, folder `/docs`, Save.
3. Wait ~1 minute for the first build.

### Every subsequent update

```bash
./scripts/commit.sh "Short commit message"
```

The wrapper stages everything, creates a commit, pushes to `main`, and reminds you that Pages will rebuild in ~1–2 minutes.

Note that `konkan_house.glb`, `house-model.blend`, `house-model.blend1`, and the debug `*_debug_*.json` files are `.gitignore`d — they're all regenerated locally. Only the SVGs, PNGs, editor build, and `docs/index.html` land in the repo.

---

## Development

### Editor parity harness

The editor's TypeScript port of `svg_2d.py` is verified byte-identical against the Python output on every commit-worthy change:

```bash
cd editor
npm run parity-all              # runs all 5 harnesses
# or individually:
npm run parity-primitives       # 34 shape / dimension / expand checks
npm run parity-floorplans       # 3 whole-SVG byte diffs
npm run parity-elevations       # 5 whole-SVG byte diffs
npm run parity-roof             # 15 roof output byte diffs
npm run parity-pillars          # 10 pillar output byte diffs (4 elevations + 6 sections)
```

The whole-SVG harnesses compare TS output against the checked-in reference files in `docs/2d/`. If you ever change `svg2d/` and want to regenerate the Python-side reference first, re-run the archived generators:

```bash
python3 archive/regenerate_combined_svgs.py    # floor plans + elevations + roof
python3 archive/generate_pillar_elevations.py  # 4 elevations + N sections
```

The primitives harness spawns `python3` inline and diffs the results character-by-character. If Python and TS ever drift, the harness prints the exact character index of divergence.

### Editor build

```bash
cd editor
npm run build                   # → ../docs/editor/
```

Vite outputs a hashed JS/CSS pair under `docs/editor/assets/`, so cache-busting is automatic on the CDN.

### Sanity-check the schema

```bash
cd editor
npm run smoke-validate          # Zod schema check on ../house_config.json
```

---

## House schema at a glance

The full schema lives in `schema/house_config.schema.json`. In broad strokes, a house config looks like:

```jsonc
{
  "plot": { "width": 800, "length": 1200 },
  "plinth": { "x": 100, "y": 100, "width": 600, "length": 1000, "height": 30 },
  "floors": [
    {
      "floor_number": 0,
      "name": "Ground_Floor",
      "objects": [
        { "type": "floor_slab", "x": 0, "y": 0, "width": 600, "length": 1000 },
        {
          "type": "room",
          "name": "Living",
          "x": 20, "y": 20, "width": 280, "length": 350,
          "walls": {
            "north": { "openings": [{ "type": "door", "position": 100, "width": 30, "height": 80 }] },
            "east":  { "openings": [{ "type": "window", "position": 150, "width": 40, "height": 40, "sill_height": 30 }] }
          }
        },
        { "type": "pillar", "x": 100, "y": 100, "width": 8, "length": 8, "height": 100 },
        { "type": "beam", "x": 0, "y": 100, "width": 600, "length": 8, "z_offset_ft": 9.8, "height": 8 },
        { "type": "staircase", "start_x": 400, "start_y": 200, "num_steps": 16, "step_width": 40, "step_tread": 12, "step_rise": 7, "direction": "east" }
      ]
    },
    { "floor_number": 1, "name": "First_Floor", "objects": [ /* ... */ ] },
    {
      "floor_number": 2, "name": "Roof",
      "objects": [
        {
          "type": "hip_roof",
          "ridge_h_ft": 7.0,
          "min_overhang_ft": 2.5,
          "trusses": { "positions": [86.225, 200, 296], "chord_size_in": [2, 4], "web_size_in": [2, 2] },
          "framing": {
            "house_footprint_ft": [27, 45],
            "rafter_size_in": [2, 4], "rafter_spacing_in": 36,
            "purlin_size_in": [2, 1], "purlin_spacing_in": 12,
            "ridge_size_in": [6, 3],
            "ring_beam": { "size_in": [4, 2] },
            "hip_end_beam": { "count_per_end": 3, "size_in": [4, 2], "extend_between_trusses": true },
            "pani_patti": { "height_in": 6, "thickness_mm": 1.2 }
          }
        }
      ]
    }
  ]
}
```

Supported object types:

| Type | Purpose |
| --- | --- |
| `floor_slab` | Concrete floor slab under a floor |
| `room` | Room with per-side walls + doors + windows |
| `wall` | Standalone wall (used for gables, boundary walls, slopes) |
| `door`, `window` | Openings — usually nested inside a room's wall definition |
| `pillar` | Square column running one or more floor heights |
| `beam` | Horizontal beam (`z_offset_ft` controls elevation) |
| `staircase` | Cube-per-step staircase with configurable direction |
| `hip_roof` | Full hip roof with truss / rafter / purlin / ring beam / pani patti |
| `gable_roof` | Simpler gable roof |

---

## Coordinate system & units

- Plan-view coordinates use **Inkscape convention**: origin top-left, X → east, Y → *south* (down on the page).
- Vertical Z is up (world Z, three.js Y).
- **Base unit = 0.1 m = ~1.31 inches.** Configs use `10 units = 1 foot` in most fields — e.g. a 27' × 45' footprint reads as `[270, 450]`.
- Inch-denominated sections (rafter `[2, 4]` etc.) are converted internally via `IN_PER_UNIT = 12 / 10 = 1.2`.
- Blender re-centers geometry around the plinth centre before export so the GLB opens with the model at the world origin.

---

## Two useful references

- `CLAUDE.md` — architecture cheat sheet with the module graph and the coordinate-system gotchas. Written for an AI agent but it's the fastest read for a new human contributor too.
- `editor/README.md` — deep dive on the TypeScript port and the parity strategy.

---

## License / attribution

Personal project for the Aatley Home Construction site. The Blender / Python / TS / React scaffolding is MIT-style — reuse freely, no warranty. The house design itself is not licensed for reuse.
