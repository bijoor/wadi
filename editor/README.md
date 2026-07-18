# Wadi Editor

A standalone browser-based editor for `house_config.json` — the JSON that
drives both the Blender 3D pipeline and the SVG floor plan / elevation
generators in the parent repo. Ships to `docs/editor/` on the same
GitHub Pages site as the model viewer.

## What it does

- **Load / edit / download** `house_config.json` entirely in the browser
- **Live SVG previews** of floor plans and elevations, byte-identical to
  the Python `svg_2d.py` output (42/42 parity checks pass)
- **Live 3D preview** (React Three Fiber) with CSG openings, hip roof,
  staircase, section cutter, layer toggles, camera presets, and
  postprocessing (SSAO + ACES tone mapping + SMAA)
- **Form-based property editor** with undo/redo (⌘/Ctrl+Z), validation,
  duplicate/delete, and keyboard shortcuts

## Workflow

The editor never touches disk directly — it uses the browser's file
picker to load and the download API to save. To iterate on a design:

1. **Open** `docs/editor/` (or the GitHub Pages URL). On first load it
   auto-fetches `../house_config.json` from the same Pages site, so
   there's usually no manual load step.
2. **Edit** — click any object in the left sidebar tree, tweak fields
   in the right panel, watch the SVG and 3D previews update live.
3. **Download** — ⌘/Ctrl+S or the top-bar button saves the JSON.
4. **Drop it into the repo** — replace `blender/house_config.json` with
   the downloaded file.
5. **Regenerate outputs**:
   - `python3 regenerate_combined_svgs.py` for SVG floor plans /
     elevations (no Blender needed)
   - Open `wadi_config.py` in Blender's Text Editor and press
     Alt+P for the full GLB + material build

## Local development

```bash
cd editor
npm install
npm run dev        # Vite dev server (usually http://localhost:5173)
npm run build      # Production build → ../docs/editor/ + copies
                   # ../house_config.json to ../docs/house_config.json
```

### Parity harnesses (verify TS ports match Python)

```bash
npm run parity-primitives   # 34 shape / dimension / expand checks
npm run parity-floorplans   # 3 whole-SVG byte diffs
npm run parity-elevations   # 5 whole-SVG byte diffs
npm run parity-all          # all of the above
```

Each byte-diff compares the TS `svg2d/` output against the Python
output already sitting in `../docs/`. If the Python output is stale,
regenerate it first with `python3 ../regenerate_combined_svgs.py`.

### Schema validation

```bash
npm run smoke-validate      # Zod schema check on ../house_config.json
```

## Deployment

The editor deploys as a subpath of the same GitHub Pages site as the
model viewer. `vite.config.ts` sets `base: './'` for path-agnostic
asset URLs and points `build.outDir` at `../docs/editor/`. A build
plugin copies `../house_config.json` to `../docs/house_config.json` so
the auto-load fetch on first visit works.

To publish: run `npm run build`, commit `docs/editor/` and
`docs/house_config.json`, and push. GitHub Pages serves from `docs/`.

## Architecture

```
editor/src/
├── App.tsx                     shell + auto-load bootstrap
├── components/
│   ├── TopBar.tsx              load / download / validate / undo / redo
│   ├── Sidebar.tsx             floor tabs + object tree
│   ├── PropertyPanel.tsx       dispatcher → per-type editor
│   └── PreviewArea.tsx         tabs: Summary | Plans | Elevations | 3D
├── forms/                      per-object-type editors
│   ├── RoomForm.tsx            nested per-side walls + openings
│   ├── WallForm.tsx            standalone walls
│   ├── simpleForms.tsx         pillar / beam / slab / staircase / roof
│   └── fields.tsx              NumberField / TextField / SelectField
├── io/fileIO.ts                pickAndLoadConfig / downloadConfig
├── schema/houseConfig.ts       Zod schema (mirrors JSON Schema)
├── state/configStore.ts        Zustand + zundo undo/redo
├── svg2d/                      TypeScript port of svg_2d.py
│   ├── expand.ts               house_expand.py port
│   ├── format.ts               f() / fFloat() numeric helpers
│   ├── shapes.ts               svg_draw_wall / room / door / …
│   ├── edges.ts                edge extraction + dimension levels
│   ├── dimensions.ts           svg_draw_dimension_line etc.
│   ├── floorPlan.ts            generate_floor_plan_svg
│   ├── floorPlansAll.ts        generate_all_floor_plans
│   ├── floorPlansCombined.ts   generate_combined_floor_plans
│   ├── elevationView.ts        generate_elevation_view (1176 LOC port)
│   ├── elevationsAll.ts        generate_all_elevations
│   ├── elevationsCombined.ts   generate_combined_elevations
│   ├── roofGeometry.ts         roof_geometry.py port
│   └── config.ts               GLOBAL_CONFIG defaults / dimensions
├── three/                      3D preview
│   ├── ThreePreview.tsx        Canvas + lights + orbit + postFX +
│   │                           camera presets + section cutter
│   ├── House3D.tsx             config → box primitives per layer
│   ├── boxes.tsx               simple wrappers around <boxGeometry>
│   ├── wallCSG.tsx             three-bvh-csg wall + opening subtraction
│   ├── roof.tsx                hip roof mesh + ridge line + vent ext
│   ├── staircase.tsx           per-step stacked-box staircase
│   ├── coords.ts               world → Three transforms
│   └── layers.ts               layer definitions + visibility store
└── scripts/                    parity + validation runners
    ├── parity-primitives.mjs
    ├── parity-floorplans.mjs
    ├── parity-elevations.mjs
    └── smoke-validate.ts
```

## Numeric formatting convention

The parity harnesses require byte-identical output vs. Python. Python
distinguishes `int` (`"110"`) from `float` (`"110.0"`); JavaScript has
one `Number` type. `svg2d/format.ts` provides two formatters used
throughout the port:

- `f(n)` — bare rendering (`"110"` for whole numbers)
- `fFloat(n)` — Python-float rendering (`"110.0"` for whole numbers)

The trick when porting is to identify which side of the int/float
divide each Python expression lands on. Any expression touched by `/`
in Python 3 is float; anything derived from an integer-only chain is
int. When a function receives a value that could be either, the port
threads a boolean flag (see `offsetIsFloat` / `x1IsFloat` on
`svgDrawDimensionLine`, or the shadowed-`width` quirk in
`floorPlan.ts`).

## Authoring v2 roofs

The v2 unified roof (`type: "roof"`) replaces the four legacy roof
types (`hip_roof` / `gable_roof` / `flat_roof` / `shed_roof`) with a
single segment-based model that also supports multi-segment shapes
(L, U, courtyard, dutch gable, mixed styles).

### Segments and endpoints

A v2 roof consists of one or more **segments**. Each segment is a
directed centreline with a **width** perpendicular to it. For pitched
roofs the centreline IS the ridge; for shed it's the along-axis; for
flat it's the middle of the slab.

![Segment endpoints and rectangle](../docs/v2-roof/segment-endpoints.svg)

The **endpoints** (`seg.start` and `seg.end`) are where the
centreline terminates. Two segments that share an endpoint form a
**joint** — that endpoint is auto-resolved by the joint solver (see
below). Endpoints that aren't shared are called **leaves**.

**Endpoints sit at the MIDPOINT of the end wall, not the wall
corner.** The walls extend by ±width/2 perpendicular to the segment.

![Endpoints vs wall corners](../docs/v2-roof/segment-vs-walls.svg)

### Endpoint styles (pitched roofs only)

Each **leaf** endpoint on a pitched roof carries a style — either
**open** (gable) or **closed** (hip):

![Open (gable) vs closed (hip)](../docs/v2-roof/endpoint-styles.svg)

- **open (gable)** → a vertical triangular wall closes the end. The
  ridge (and eaves) extend past the wall by `gable_overhang` (default
  = `min_overhang`). Set `gable_overhang: 0` to disable the overhang.
- **closed (hip)** → a sloped triangular roof face closes the end.
  The ridge is trimmed inward by `hip_setback` (default = width/2 =
  equal-pitch pyramid). Two "hip diagonals" connect the ridge apex
  down to the eave corners.

Set each per **leaf** endpoint independently via the segment form —
this is what enables **dutch gable** (one end open, one end closed)
and every asymmetric variant.

### Multi-segment: leaves + joints

Multiple segments that share endpoints form an L, U, courtyard or
more complex polygon. Each unique endpoint is either a **leaf** (per-
segment style picker applies) or a **joint** (shared between two
segments, auto-resolved to a valley/hip).

![Multi-segment L-shape with leaves + joints](../docs/v2-roof/lshape-joint.svg)

In the L-shape above:
- `A.start = (220, 70)` → **leaf**. Style: your choice (open/closed).
- `A.end = B.start = (220, 325)` → **joint** (both segments' ridges
  meet here). Style ignored; the joint solver emits a valley member
  from the joint apex down to the inside corner `(340, 240)`.
- `B.end = (540, 325)` → **leaf**. Style: your choice (open/closed).

The two leaves live on **different segments**, so to set them
independently you use each segment's per-endpoint picker.

### In the editor

`+ Add object…` → **Roof (v2)** creates a default single-segment
pitched hip. Select the roof to open the property form:

- **Roof type** dropdown — flat / shed / pitched
- **Slope** — by height (ridge_h in project units) or by angle (deg)
- **Min overhang** — side eave overhang, project units
- **Default endpoint style** (pitched only) — applied to every leaf
  endpoint that doesn't have a per-segment override
- **Segments** section — add / remove / edit each segment. Every
  segment editor shows:
  - `id`, `start`, `end`, `width`
  - Per-endpoint controls, **shown only for LEAF endpoints**. Joint
    endpoints display a "joint · auto" badge instead — no picker,
    because the joint solver handles them.
  - For each open leaf → `gable_overhang` field
  - For each closed leaf → `hip_setback` field
- **Trusses** section (pitched only) — per-segment truss lists. Each
  entry's `positions_along` is measured from that segment's `start`.

### Layers in the 3D scene

v2 roofs contribute to two layers (matching the legacy convention):
- **Roof shell** (`loft`) — slope + hip_face + gable_wall + flat_slab
  planes as solid meshes.
- **Ridges & trusses** (`frame_spine`) — Fink truss members (top
  chords, bottom chord, king post, web diagonals + verticals) as
  dark grey cylinders.

Toggle either layer independently from the layer panel.

### BOM contributions

Every v2 roof adds rows to:
- **Frame BOM** — Central ridge, Hip ridges, Valleys, Ring beam,
  Rafters, Purlins, plus truss members (Truss top chord, Truss
  bottom chord, Truss webs) when trusses are configured.
- **Metal BOM by spec** — aggregated by material spec (H×W × wall
  thickness × material). Merges with legacy rows sharing the same
  spec, then computes pieces-to-order using stock length + waste %.
- **Roof material BOM** — v2 slope area (via 3D polygon area of
  slope + hip_face planes) + v2 ridge length feed the tile /
  ridge-tile procurement calculation.

## Known limitations

- Legacy roof forms (hip_roof / gable_roof / flat_roof / shed_roof)
  still use their own dedicated form editors; the v2 unified form
  (`Roof (v2)`) is the recommended path for new configs.
- Standalone walls with diagonal geometry render with a bounding-box
  approximation in the 3D preview (axis-aligned walls are exact).
- The `GLOBAL_CONFIG.update({...})` block in `house_config.py`
  (materials palette, layer definitions, floor heights) is hard-coded
  in `svg2d/config.ts` — if you change it in Python, update
  `config.ts` in lockstep.
- The Blender / Python pipeline does not yet know about the v2 roof
  type — GLB export and Blender rendering only handle legacy roofs.
