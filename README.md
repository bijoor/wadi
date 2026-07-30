# Wadi

Design a house in 3D from a single file. Pick a ready-made home or build one room by
room, tweak it live, and get an interactive 3D model plus dimensioned floor plans,
elevations, and roof drawings — all from one design.

**Web app:** <https://wadi.house/app> · **Home page:** <https://wadi.house>

---

## What Wadi is

Wadi turns a house into a single design you can see and shape in 3D. Choose a ready-made
home and personalize it, or author one in full detail. Change anything and the 3D model,
floor plans, elevations, and roof update **live** — every drawing is generated from the
same underlying design.

It's built for two people:

- a **homeowner** who wants to picture and personalize their future home, and
- an **architect** who designs and details it.

Here's how each uses the app. (Everything past that is for developers — see
[Technical details](#technical-details).)

---

## For homeowners

Everything runs in your browser — nothing to install, and it works on a phone.

1. **Open the app** → **<https://wadi.house/app>** (Homeowner view).
2. **Choose your home.** Browse the gallery of ready-made designs — Konkan cottages,
   family homes, and more — each with 3D previews and a floor plan. Pick the one closest
   to what you want.
3. **Make it yours.** A simple set of controls — plot size, roof style, room options —
   reshapes the house, and the **3D model updates as you go**. Orbit, zoom, and look
   around it.
4. **See the plans.** Switch to the floor-plan view for room sizes and layout at a
   glance.
5. **Share it.** The **Share** button copies a link that contains your whole design —
   send it to family or to your architect and they see exactly what you see. No account,
   nothing uploaded.

---

## For architects

The same app has a full studio for authoring and detailing a design.

1. **Open the studio** → **<https://wadi.house/app?mode=studio>** (or the editor at
   <https://wadi.house/editor>).
2. **Build the model.** Add and edit every element through the object tree and property
   panels — rooms (with per-side walls, doors, and windows), free-standing walls, a roof
   (hip / gable / shed / flat), columns, beams, slabs, staircases, kitchen platforms, and
   furniture. Openings are cut into the walls live.
3. **Work in 2D and 3D together.** Tabs give per-floor plans, a filtered composite sheet,
   elevations (front / back / left / right), roof views, and a quantities estimate (wall
   areas) — all dimensioned, all updating as you edit.
4. **Control the presentation.** Toggle layers, switch camera presets, and capture
   preview images for a design.
5. **Make it parametric.** Define a house on a structural **grid** with formulas so it
   stays valid when the plot is resized — the basis for the reusable templates in the
   homeowner gallery.

Architects can work three ways:

- **In the browser** (studio mode) — direct manipulation, as above.
- **On the desktop** — the Wadi desktop app live-watches a `.wadi` file on disk, so you
  can edit it in any tool and see the 3D model update within about a second.
- **By chatting** — describe a house to an AI coding agent (Claude Code, Google
  Antigravity) and it writes the `.wadi` for you while the desktop app previews it.

The desktop app and the AI skill need a one-time setup — see
[Technical details](#technical-details).

---

# Technical details

Everything below is for running, extending, or deploying Wadi. A house is a single JSON
document (a `.wadi` file); one TypeScript codebase under `editor/src` renders every
surface, and the **Zod schema** at `editor/src/schema/houseConfig.ts` is the single
source of truth for the format.

## The `.wadi` file & schema

- A house is one JSON document — `.wadi` (or `house_config.json`). The repo's default
  design is `docs/house_config.json` (the root `house_config.json` is a symlink to it)
  and auto-loads in the app.
- The format is defined and validated by the Zod schema (`editor/src/schema/houseConfig.ts`).
  The complete, always-current field reference is
  **`wadi-skill/architect/reference/data-model.md`**, generated from that schema so it
  can't drift.

Each floor holds an `objects` list; every object has a `type`:

| Type | Purpose |
| --- | --- |
| `room` | A room with per-side walls and nested `door` / `window` openings |
| `wall` | A free-standing wall (boundary, gable) |
| `floor_slab` | RCC slab under a floor |
| `plinth` / `ground` | Raised base + ground plane (on the Plinth floor) |
| `beam` | Horizontal beam |
| `pillar` | Column (centre-placed under the centreline convention) |
| `staircase` | Multi-flight staircase (auto switchback flights) |
| `kitchen_platform` | Polyline kitchen counter |
| `roof` | Unified roof — hip / gable / shed / flat, per segment |
| `item` | A GLB furniture piece |
| `component` | An instance of an in-file reusable component |

## Coordinates, units & conventions

- **Inkscape frame:** origin top-left, X → east, Y → **down** (south). Z is up.
- **10 project units = 1 ft** by default (an optional `units` block relabels the display
  without changing geometry).
- **Centreline convention** (`"coord_convention": "center"`): a rect object's
  `x/y/width/length` are wall **centrelines**, so adjacent rooms simply **abut** on the
  shared line (no overlap, no wall math), and a pillar's `x/y` is its **centre**.
- **Grids:** a parametric template defines named grid lines whose positions are formulas
  of the plot size; rooms and columns reference them (`"= main.x1"`), so the whole plan
  re-flows when you resize.

Full details: `wadi-skill/architect/reference/coordinate-system.md` and
`parametric-conventions.md`.

## The AI architect skill — setup

The skill ships as an **agent-neutral core** plus thin per-agent adapters, so the same
content drives any coding agent:

```
wadi-skill/architect/            the skill — instructions, references, examples, scripts
.claude/skills/wadi-architect/   Claude Code adapter   → points at the skill
AGENTS.md                        vendor-neutral entrypoint (Antigravity, Cursor, …) → the skill
```

**Prerequisites (once):**

```bash
git clone https://github.com/bijoor/wadi.git
cd wadi
npm --prefix editor install      # the skill's validate/preview scripts reuse the app's TypeScript
```

Optional but recommended for the live loop: keep your `.wadi` open in the Wadi desktop
app (below) so the 3D model updates as the agent saves.

**Claude Code** — the skill lives in `.claude/skills/`, so Claude Code auto-discovers it
when run from inside the repo:

1. `cd wadi && claude` (or open the repo in the Claude Code IDE extension / desktop app).
2. Invoke it by asking naturally ("design a 3-bed L-shaped bungalow, hip roof, ~1500 sq
   ft") or explicitly with `/wadi-architect`.
3. To use it in every project, copy the adapter into your user skills dir (it still
   points back at this repo's files, so keep the repo checked out):
   `cp -R .claude/skills/wadi-architect ~/.claude/skills/`

**Google Antigravity (and other `AGENTS.md`-aware agents: Cursor, …)** — these read
`AGENTS.md` at the repo root automatically:

1. Open the `wadi` repo as your workspace.
2. Ask it to create or edit a house ("make a coastal Konkan cottage with a verandah"). It
   follows `AGENTS.md` → `wadi-skill/architect/SKILL.md` and writes the `.wadi`.
3. If your agent doesn't pick up `AGENTS.md` on its own, tell it:
   *"Follow the instructions in `wadi-skill/architect/SKILL.md` to author this `.wadi`."*

**Verify the tooling** — both scripts reuse the app's own generators, so they match the
app byte-for-byte:

```bash
# Validate a config (schema + wall/roof pipeline)
cd editor && npx tsx ../wadi-skill/architect/scripts/validate.mjs <ABS_PATH_TO.wadi>
# Render floor plans / elevations / roof to PNGs the agent can read
wadi-skill/architect/scripts/preview.sh <ABS_PATH_TO.wadi>
```

## Run & develop locally

```bash
git clone https://github.com/bijoor/wadi.git
cd wadi
npm --prefix editor install
```

All app code lives under `editor/`:

| Task | Command |
| --- | --- |
| Dev server (hot reload) | `npm --prefix editor run dev` |
| Run tests (Vitest) | `npm --prefix editor test` |
| Typecheck | `cd editor && npx tsc -b` |
| Build the deployed bundles | `npm --prefix editor run build` |
| Schema smoke-check the default config | `npm --prefix editor run smoke-validate` |
| Dump SVGs to disk (print / Inkscape) | `npm --prefix editor run dump-svgs` |

`npm run build` runs `tsc` then two Vite builds — the **editor SPA** → `docs/editor/` and
the **app / viewer** → `docs/app/`. Both read the same `editor/src`.

## Desktop app (Tauri)

Requires Rust and the Tauri CLI (`cargo install tauri-cli`). From the repo root:

```bash
npm --prefix editor run build          # refresh docs/ (the app bundles it as its frontend)
cargo tauri build --bundles app        # → src-tauri/target/release/bundle/macos/Wadi.app
```

`src-tauri/tauri.conf.json` bundles `docs/` as the frontend and associates the `.wadi`
file type, so double-clicking a design opens it and the app live-watches it.

## Repo layout

```
editor/                    React + Three.js + Zod app — THE source of truth
  src/schema/houseConfig.ts   the .wadi schema (Zod)
  src/{svg2d,three,param}/    2D drawings, 3D scene, parametric engine
  src/registry/               object-type registry (one file per new type)
docs/                      GitHub Pages root, served at wadi.house
  index.html               landing page  → /app
  app/                     the 3D home designer (homeowner + architect modes)
  editor/                  the editor SPA
  templates/               bundled starter templates + index.json
  house_config.json        default design (root house_config.json → symlink)
src-tauri/                 desktop app (Tauri) wrapping docs/
wadi-skill/architect/      agent-neutral AI skill (Claude Code, Antigravity, …)
.claude/skills/            Claude Code skill adapters
AGENTS.md                  vendor-neutral entrypoint for coding agents
library/                   reference parametric .wadi models
scripts/                   publish-templates.sh / publish-furniture.sh (Cloudflare R2)
schema/                    legacy JSON Schema (superseded by the Zod schema)
python/  archive/          RETIRED Blender/Python pipeline — history only, do not use
```

> The original Blender/Python generator has been **retired** — everything now runs in
> TypeScript. `python/` and `archive/` are kept for history only.

## Deployment & hosting

- **Site + app:** `docs/` is the GitHub Pages root on the custom domain **`wadi.house`**.
  Run `npm --prefix editor run build` so `docs/app` and `docs/editor` are current, then
  push `main` — Pages rebuilds in ~1–2 min.
- **Templates & furniture:** hosted on **Cloudflare R2** so new ones ship without
  redeploying the site or app. Publish with `scripts/publish-templates.sh` /
  `scripts/publish-furniture.sh` (needs a gitignored `.env.r2` — see
  **`TEMPLATE_HOSTING.md`**).

## References

- **`wadi-skill/architect/`** — the AI skill: `SKILL.md` + `reference/{data-model,
  coordinate-system,parametric-conventions,roof-v2-guide}.md` + validated `examples/`.
  The reference docs are the authoritative, current description of the model.
- **`editor/README.md`** — editor internals and architecture.
- **`TEMPLATE_HOSTING.md`** — R2 bucket + CORS setup for templates / furniture.

## License / attribution

Personal project for the Aatley Home Construction site. The app scaffolding
(TypeScript / React / Three.js / Tauri) is MIT-style — reuse freely, no warranty. The
house designs themselves are not licensed for reuse.
