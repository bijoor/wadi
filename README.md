# Wadi

Design a house in 3D from a single file. Pick a ready-made home or describe what you
want, tweak it live, and get an interactive 3D model plus dimensioned floor plans,
elevations, and roof drawings — all generated from one `.wadi` document.

**Web app:** <https://wadi.house/app> · **Home page:** <https://wadi.house> · **Editor:** <https://wadi.house/editor>

---

## What Wadi is

A house is a single JSON document — a **`.wadi` file**. From it, Wadi renders (entirely
in the browser, live as you edit):

- an **interactive 3D model** — rooms, walls, a real roof, doors/windows cut with CSG,
  staircases, columns, furniture; per-layer visibility and camera presets;
- **2D floor plans** per floor plus a filtered composite sheet, with dimensions,
  openings, and the structural grid;
- **elevations** (front / back / left / right) and **roof** views;
- a **quantities** estimate (wall areas, net of openings).

One TypeScript codebase under `editor/src` powers every surface, and the **Zod schema**
at `editor/src/schema/houseConfig.ts` is the single source of truth for the file format.

Houses are **parametric**: a template defines a structural grid and formulas, so
resizing the plot re-flows every room instead of breaking the design (see
[Grid & centreline conventions](#coordinates--units)).

> The original Blender/Python generator has been **retired** — everything now runs in
> TypeScript. The `python/` and `archive/` folders are kept for history only; don't use
> them.

---

## Three ways to use it

### 1. The web app — nothing to install (start here)

Open **<https://wadi.house/app>**. It has two personas:

- **Homeowner** (`?mode=owner`) — a "Choose your home" gallery; pick a template, then a
  friendly configurator (plot size, roof style, …) with the 3D model updating live.
- **Architect / studio** (`?mode=studio`) — the full object tree and property panels for
  every object, layer toggles, the 2D tabs, and preview capture.
- `?panels=off` hides the side panels for a clean, embeddable view.

**Share a design** with the Share button: it packs the whole house into the URL
(`#w1=…`) — no backend, no account. Whoever opens the link sees your exact design. Links
made by a newer build still open on an older one (unknown options are skipped with a
notice) and vice-versa.

### 2. The desktop app — live file editing

A [Tauri](https://tauri.app) build wraps the same app and **watches a `.wadi` file on
disk**: edit the file in any tool and the 3D model re-renders within ~1 s of each save.
It also registers the `.wadi` file type, so you can double-click a design to open it.
Build it yourself — see [Develop locally](#run--develop-locally).

### 3. Design by chatting — the AI architect skill

Describe a house in plain English (or from a sketch) and let an AI coding agent author
the `.wadi` for you while the desktop app live-previews it. The instructions ship in the
repo as an **agent-neutral skill** that works in any coding agent — see
[the skill section below](#designing-houses-by-chatting--the-ai-architect-skill).

---

## The `.wadi` file

- A house is one JSON document — `.wadi` (or `house_config.json`). The repo's default
  design is `docs/house_config.json` (the root `house_config.json` is a symlink to it)
  and auto-loads in the app.
- The format is defined and validated by the **Zod schema**
  (`editor/src/schema/houseConfig.ts`). The complete, always-current field reference is
  **`wadi-skill/architect/reference/data-model.md`**, generated from that schema so it
  can't drift.

### Object types

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

### Coordinates & units

- **Inkscape frame:** origin top-left, X → east, Y → **down** (south). Z is up.
- **10 project units = 1 ft** by default (an optional `units` block relabels the display
  without touching geometry).
- **Centreline convention** (`"coord_convention": "center"`): a rect object's
  `x/y/width/length` are wall **centrelines**, so adjacent rooms simply **abut** on the
  shared line (no overlap, no wall math), and a pillar's `x/y` is its **centre**.
- **Grids:** a parametric template defines named grid lines whose positions are formulas
  of the plot size; rooms and columns reference them (`"= main.x1"`), so the whole plan
  re-flows when you resize.

Full details: `wadi-skill/architect/reference/coordinate-system.md` and
`parametric-conventions.md`.

---

## Designing houses by chatting — the AI architect skill

The skill is checked into the repo as an **agent-neutral core** plus thin per-agent
adapters, so the same content drives any coding agent:

```
wadi-skill/architect/            the skill — instructions, references, examples, scripts
.claude/skills/wadi-architect/   Claude Code adapter   → points at the skill
AGENTS.md                        vendor-neutral entrypoint (Antigravity, Cursor, …) → the skill
```

### Prerequisites (once)

```bash
git clone https://github.com/bijoor/wadi.git
cd wadi
npm --prefix editor install      # the skill's validate/preview scripts reuse the app's TypeScript
```

Optional but recommended for the **live loop**: keep your `.wadi` open in the Wadi
desktop app (the Tauri build — see below) so the 3D model updates as the agent saves.
Without it you can still author, validate, and render preview images from the scripts.

### Claude Code

The skill lives in `.claude/skills/`, so Claude Code **auto-discovers it** when run from
inside the repo — no install step.

1. `cd wadi && claude` (or open the repo in the Claude Code IDE extension / desktop app).
2. Invoke it by asking naturally ("design a 3-bed L-shaped bungalow, hip roof, ~1500 sq
   ft") or explicitly with `/wadi-architect`.
3. To use it in **every** project, copy the adapter into your user skills dir (it still
   points back at this repo's files, so keep the repo checked out):
   ```bash
   cp -R .claude/skills/wadi-architect ~/.claude/skills/
   ```

### Google Antigravity (and other AGENTS.md-aware agents: Cursor, …)

These agents read **`AGENTS.md`** at the repo root automatically.

1. Open the `wadi` repo as your workspace in Antigravity.
2. Ask it to create or edit a house ("make a coastal Konkan cottage with a verandah"). It
   follows `AGENTS.md` → `wadi-skill/architect/SKILL.md` and writes the `.wadi`.
3. If your agent doesn't pick up `AGENTS.md` on its own, give it the one-liner:
   > Follow the instructions in `wadi-skill/architect/SKILL.md` to author this `.wadi`.

### Verify the skill's tooling

Both scripts reuse the app's own generators, so they match the app byte-for-byte:

```bash
# Validate a config (schema + wall/roof pipeline)
cd editor && npx tsx ../wadi-skill/architect/scripts/validate.mjs <ABS_PATH_TO.wadi>

# Render floor plans / elevations / roof to PNGs the agent can read
wadi-skill/architect/scripts/preview.sh <ABS_PATH_TO.wadi>
```

---

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

### Desktop app (Tauri)

Requires Rust and the Tauri CLI (`cargo install tauri-cli`). From the repo root:

```bash
npm --prefix editor run build          # refresh docs/ (the app bundles it as its frontend)
cargo tauri build --bundles app        # → src-tauri/target/release/bundle/macos/Wadi.app
```

`src-tauri/tauri.conf.json` bundles `docs/` as the frontend and associates the `.wadi`
file type (so double-clicking a design opens it, and the app live-watches it).

---

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

---

## Deployment & hosting

- **Site + app:** `docs/` is the GitHub Pages root on the custom domain **`wadi.house`**.
  Run `npm --prefix editor run build` so `docs/app` and `docs/editor` are current, then
  push `main` — Pages rebuilds in ~1–2 min.
- **Templates & furniture:** hosted on **Cloudflare R2** so new ones ship without
  redeploying the site or app. Publish with `scripts/publish-templates.sh` /
  `scripts/publish-furniture.sh` (needs a gitignored `.env.r2` — see
  **`TEMPLATE_HOSTING.md`**).

---

## References

- **`wadi-skill/architect/`** — the AI skill: `SKILL.md` + `reference/{data-model,
  coordinate-system,parametric-conventions,roof-v2-guide}.md` + validated `examples/`.
  The reference docs are the authoritative, current description of the model.
- **`editor/README.md`** — editor internals and architecture.
- **`TEMPLATE_HOSTING.md`** — R2 bucket + CORS setup for templates/furniture.

---

## License / attribution

Personal project for the Aatley Home Construction site. The app scaffolding
(TypeScript / React / Three.js / Tauri) is MIT-style — reuse freely, no warranty. The
house designs themselves are not licensed for reuse.
