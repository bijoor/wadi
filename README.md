# Wadi

Wadi is a parametric home designer, and an example of an AI-native product: it is
designed to be used with an AI coding assistant. You describe a house to the assistant;
it writes the design in Wadi's design language (a `.wdl` file); Wadi compiles and
renders it live as a 3D model plus dimensioned floor plans, elevations, and roof
drawings. An architect can co-edit the same file, and a home-owner can personalize a
finished design through a set of controls.

**Web app:** <https://wadi.house/app> · **Home page:** <https://wadi.house>

---

## What Wadi is

Wadi turns a house into a single design you can see and shape in 3D. Every output (the
3D model, floor plans, elevations, roof drawings) is generated from the same design, so
one change updates all of them.

The design is written in Wadi's design language, and it is built to be authored by an AI
assistant. An architect describes the house, the assistant writes the `.wdl`, and both
refine it while Wadi renders it live. The assistant also checks its own work: it runs an
automated check after edits and renders previews it can read (see
[Designing with an AI assistant](#designing-with-an-ai-assistant)). The architect can
edit the file by hand, and a home-owner works at a higher level, picking a ready-made
design and adjusting a set of controls.

Wadi is also built to extend. Each object type is declared once in a registry file, and
the schema, the documentation, the `.wdl` language syntax, and the decompiler all read
from that one declaration, so adding a new type is a single self-contained file. The
[`documentation/`](documentation/) folder explains the concepts, the personas, and the
architecture. Start there if you are new.

---

## Designing with an AI assistant

The primary way to create a design is to describe it to an AI coding assistant, which
writes and checks the `.wdl` while Wadi renders it. You state what you want, the
assistant writes the file, and you steer in chat and co-edit as needed. The assistant
writes the language, not the compiled config, because Wadi's compiler does that. After
each edit it runs an automated check (parse, resolve, schema, wall and roof geometry,
structural conventions) and renders preview images it can read. Most functional testing
today is visual; more automatic functional tests are planned.

Setup, the skill, and the tooling are under [Technical details](#technical-details),
section "The AI architect skill".

---

## For architects (by hand)

An architect can also work without the assistant. The `.wdl` is the edit surface; the
form-based object editor is retired. Both routes drive the same model.

- In the WDL editor built into the app, writing `.wdl` directly (browser: the WDL tab at
  <https://wadi.house/app>; or the desktop app, ⌘⇧D). It compiles live and shows the 3D
  model, per-floor plans, a filtered composite sheet, elevations, roof views, and a
  wall-area estimate, all dimensioned, with parse errors surfaced inline. The 🧩 Modules
  panel manages the reusable component files a design imports. The
  [Wadi DSL Author's Guide](documentation/03-authoring.md) is the walkthrough, from your
  first room to grids, reusable components, libraries, and the owner-facing configurator.
  It is part of the guided [`documentation/`](documentation/) folder.
- On the desktop, editing a file. The Wadi desktop app watches a `.wdl` or `.wadi` file
  on disk, so you can edit it in any tool and see the 3D model update within about a
  second. Opening a `.wdl` auto-loads its sibling component modules.

To make a design reusable, define it on a structural grid with formulas so it stays
valid when the plot is resized, then expose a configurator. That is the basis for the
templates in the home-owner gallery.

The desktop app and the AI skill need a one-time setup. See
[Technical details](#technical-details).

---

## For home-owners

Everything runs in the browser. There is nothing to install, and it works on a phone.

1. Open the app at <https://wadi.house/app> (Home-owner view).
2. Choose your home. Browse the gallery of ready-made designs (Konkan cottages, family
   homes, and more), each with 3D previews and a floor plan. Pick the one closest to
   what you want.
3. Make it yours. A set of controls (plot size, roof style, room options) reshapes the
   house, and the 3D model updates as you change them. Orbit, zoom, and look around.
4. See the plans. Switch to the floor-plan view for room sizes and layout.
5. Share it. The Share button copies a link that contains your whole design. Send it to
   family or to your architect and they see what you see. No account, nothing uploaded.

---

# Technical details

Everything below is for running, extending, or deploying Wadi. A house is authored as a
`.wdl` (the Wadi Design Language) and saved as a `.wadi` bundle. One TypeScript codebase
under `editor/src` renders every surface, and the Zod schema at
`editor/src/schema/houseConfig.ts` is the single source of truth for the compiled config.

## The `.wadi` bundle & schema

- A `.wadi` is a **zip bundle** that carries a design and its dependencies together:
  - `wadi.json` — the compiled `HouseConfig` (what every renderer reads).
  - `model.wdl` — the authored DSL source, so the design round-trips back to editable
    `.wdl`.
  - `thumbnails/` — gallery preview images.
  - `modules/` — the imported component `.wdl` files, one per import ref, mapped in the
    manifest, so a design that reuses custom components stays self-contained (see
    [components & libraries](documentation/04-components-and-libraries.md)).
- A plain-JSON `.wadi` or `house_config.json` still loads (the loader sniffs the magic
  bytes: a zip vs. a `{` document vs. `.wdl` text), so older single-document designs keep
  working. The repo's default design is `docs/house_config.json` (the root
  `house_config.json` is a symlink to it) and auto-loads in the app.
- The compiled config is defined and validated by the Zod schema
  (`editor/src/schema/houseConfig.ts`). The complete, always-current field reference is
  **`wadi-skill/architect/reference/data-model.md`**, generated from that schema so it
  cannot drift.

Each floor holds an `objects` list; every object has a `type`:

| Type | Purpose |
| --- | --- |
| `room` | A room with per-side walls and nested `door` / `window` openings |
| `wall` | A free-standing wall (boundary, gable) |
| `floor_slab` | RCC slab under a floor |
| `plinth` / `ground` | Raised base + ground plane (on the Plinth floor) |
| `beam` | Horizontal beam |
| `pillar` | Column (`x/y` = top-left corner) |
| `staircase` | Multi-flight staircase (auto switchback flights; `climb up/down`) |
| `spiral_staircase` | A helical stair around a central pole |
| `kitchen_platform` | Polyline kitchen counter |
| `roof` | Unified roof: hip / gable / shed / flat, per segment |
| `item` | A GLB furniture piece |
| `model` | A GLB at real scale, posed by a named-node `rig` |
| `component` | An instance of an in-file reusable component |

## Coordinates, units & conventions

- **Inkscape frame:** origin top-left, X to the east, Y **down** (south). Z is up.
- **10 project units = 1 ft** by default (an optional `units` block relabels the display
  without changing geometry).
- **Centreline convention** (`"coord_convention": "center"`): a rect object's
  `x/y/width/length` are wall **centrelines**, so adjacent rooms simply **abut** on the
  shared line (no overlap, no wall math). (A pillar's `x/y` is its **top-left corner**,
  like a room's — centre a column on a node by subtracting half its width.)
- **Grids:** a parametric template defines named grid lines whose positions are formulas
  of the plot size; rooms and columns reference them (`"= main.x1"`), so the whole plan
  re-flows when you resize.

Full details: `wadi-skill/architect/reference/coordinate-system.md` and
`parametric-conventions.md`.

## The AI architect skill: setup & use

Describe a house to a coding agent and it authors the design in the **Wadi DSL**, a
small formal language saved as a **`.wdl`** file, while the Wadi **WDL editor** compiles
and renders it live. The `.wdl` is a single file you and the agent **co-edit**; the
agent never hand-writes the compiled config, because the compiler does that conversion.

The skill ships as an **agent-neutral core** plus thin per-agent adapters, so the same
content drives any coding agent:

```
wadi-skill/architect/            the skill: instructions, references, examples, scripts
.claude/skills/wadi-architect/   Claude Code adapter        → points at the skill
AGENTS.md                        vendor-neutral entrypoint (Antigravity, Cursor, …) → the skill
```

### 1. Install (once)

```bash
git clone https://github.com/bijoor/wadi.git
cd wadi
npm --prefix editor   install    # the skill's check/preview scripts reuse the app's TypeScript
npm --prefix wadi-dsl install    # the DSL compiler (its `prepare` hook builds the parser)
```

### 2. Open the WDL editor for the live preview (recommended)

Keep your `.wdl` open in the Wadi WDL editor so the 3D model + plans update as the agent
saves (and it watches the file, so your own edits show too):

- **Desktop:** the Wadi app → **⌘⇧D → Open** your `.wdl` (see [Desktop app](#desktop-app-tauri)).
- **Browser:** the **WDL** tab in the app at **<https://wadi.house/app>**, paste or open
  a `.wdl`.

### 3. Ask the agent to design

- **Claude Code** auto-discovers the skill from `.claude/skills/` when run inside the
  repo: `cd wadi && claude`, then ask naturally or invoke `/wadi-architect`. It creates a
  `.wdl`, tells you the path, and runs `check.sh` after every edit. To use it in *every*
  project, copy the adapter to your user skills dir (it still points back at this repo, so
  keep it checked out): `cp -R .claude/skills/wadi-architect ~/.claude/skills/`.
- **Antigravity / Cursor / other `AGENTS.md`-aware agents** read the repo-root `AGENTS.md`,
  which routes to `wadi-skill/architect/SKILL.md`. If yours doesn't pick it up, tell it to
  follow that file.

### 4. The tooling the agent runs (you can too)

Both scripts reuse the app's own generators, so they match the app byte-for-byte. Pass an
**absolute** path to the `.wdl`:

```bash
wadi-skill/architect/scripts/check.sh   <ABS_PATH_TO.wdl>   # parse + resolve + schema/geometry + conventions
wadi-skill/architect/scripts/preview.sh <ABS_PATH_TO.wdl>   # render plans / elevations / roof to PNGs
```

`check.sh` also enforces the **structural conventions** (plinth match, exterior walls,
no-slab floors, and more), failing on errors and printing warnings. The full workflow,
the conventions, and the per-agent setup are in
[Designing with an AI assistant](documentation/07-ai-assistants.md).

### Repo-free: run it as an MCP server

Everything above needs the repo checked out (the scripts reuse the app's TypeScript). To
use the skill **without a clone**, run **`wadi-mcp/`**, an MCP server that bundles the
whole pipeline (DSL compiler + schema + geometry + conventions + 2D renderers) and the
examples/reference docs into one self-contained file. It exposes agent-native tools:

| Tool | Replaces |
| --- | --- |
| `wadi_check` | `check.sh`: parse + resolve + schema/geometry + structural conventions |
| `wadi_preview` | `preview.sh`: renders plans / elevations / roof to **PNG images** the agent reads |
| `wadi_scope` | resolve the design's variables, points, and grid lines to actual values |
| `wadi_examples` | the `examples/*.wdl` (embedded) |
| `wadi_reference` | the reference docs (embedded: guide, dsl, conventions, …) |
| `wadi_modules` / `wadi_module` | discover and inspect the bundled component / furniture libraries |
| `wadi_glb_inspect` | inspect a GLB's node rig (for `model` primitives) |
| `wadi_view_3d` / `wadi_capture_3d` | *(needs the desktop app open)* load a design into the app's live 3D view, or get a real 3D image back, via a localhost bridge the app serves |

Agents can also register reusable `component` modules so they bundle into the `.wadi`;
see [components & libraries](documentation/04-components-and-libraries.md).

Register it with any MCP client (Claude Code, Cursor, Claude Desktop, …). Published to npm,
it needs no install:

```json
{ "mcpServers": { "wadi": { "command": "npx", "args": ["-y", "wadi-mcp"] } } }
```

Or from a local build (`cd wadi-mcp && npm install && npm run build` → `dist/server.mjs`,
only `@resvg/resvg-js` external), point at the bundle by path:

```json
{ "mcpServers": { "wadi": { "command": "node", "args": ["/abs/path/to/wadi-mcp/dist/server.mjs"] } } }
```

Then the agent authors a `.wdl` using `wadi_reference` / `wadi_examples` and verifies with
`wadi_check` / `wadi_preview`, with no repo and no desktop app. (The live 3D preview still
comes from the WDL editor if you want it.) See **`wadi-mcp/README.md`**.

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

`npm run build` runs `tsc` then a Vite build of the **app** → `docs/app/`
(`vite.viewer.config.ts`). `npm run dev` / Vitest use `vite.config.ts`. Both read the
same `editor/src`.

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
editor/                    React + Three.js + Zod app: THE source of truth
  src/schema/houseConfig.ts   the .wadi schema (Zod)
  src/{svg2d,three,param}/    2D drawings, 3D scene, parametric engine
  src/registry/               object-type registry (one file per new type)
docs/                      GitHub Pages root, served at wadi.house
  index.html               landing page  → /app
  app/                     the app (viewer): 3D model + plans + WDL editor + configurator
  templates/               bundled starter templates (self-describing; the folder is the catalog)
  house_config.json        default design (root house_config.json → symlink)
src-tauri/                 desktop app (Tauri) wrapping docs/
wadi-dsl/                  the Wadi DSL (.wdl): Langium grammar, compiler, decompiler
  examples/*.wdl              validated sample houses the skill copies from
wadi-skill/architect/      agent-neutral AI skill (Claude Code, Antigravity, …)
wadi-mcp/                  MCP server: the skill's tooling, repo-free (check/preview/examples)
.claude/skills/            Claude Code skill adapters
AGENTS.md                  vendor-neutral entrypoint for coding agents
library/                   reference parametric .wadi models
scripts/                   publish-templates.sh / publish-furniture.sh (Cloudflare R2)
schema/                    legacy JSON Schema (superseded by the Zod schema)
python/  archive/          RETIRED Blender/Python pipeline: history only, do not use
```

> The original Blender/Python generator has been **retired**. Everything now runs in
> TypeScript. `python/` and `archive/` are kept for history only.

## Deployment & hosting

- **Site + app:** `docs/` is the GitHub Pages root on the custom domain **`wadi.house`**.
  Run `npm --prefix editor run build` so `docs/app` is current, then push `main`. Pages
  rebuilds in about 1 to 2 minutes.
- **Templates & furniture:** hosted on **Cloudflare R2** so new ones ship without
  redeploying the site or app. Publish with `scripts/publish-templates.sh` /
  `scripts/publish-furniture.sh` (needs a gitignored `.env.r2`; see
  **`TEMPLATE_HOSTING.md`**).

## References

- **[`documentation/`](documentation/)**: the guided documentation. **Start at
  [`documentation/README.md`](documentation/README.md)**. It walks a newcomer from the
  [concept](documentation/01-concept.md) and the [personas](documentation/02-personas.md)
  (AI coding assistant, architect, home-owner, developer) through the
  [authoring guide](documentation/03-authoring.md) and
  [components & libraries](documentation/04-components-and-libraries.md), to the advanced
  [extending-the-DSL](documentation/05-extending-the-dsl.md) and
  [generalizable-method](documentation/06-the-method.md) chapters.
- **`wadi-skill/architect/`**: the AI skill. `SKILL.md` (the step-by-step authoring
  loop) + `reference/{dsl,data-model,coordinate-system,parametric-conventions,conventions,
  roof-v2-guide}.md` + validated `examples/`. The reference docs are the authoritative,
  current description of the DSL, the model, and the structural conventions.
- **`wadi-dsl/README.md`**: the Wadi DSL (`.wdl`): grammar, compiler, and decompiler.
- **`editor/README.md`**: editor internals and architecture.
- **`TEMPLATE_HOSTING.md`**: R2 bucket + CORS setup for templates / furniture.

## License / attribution

Personal project for the Aatley Home Construction site. The app scaffolding
(TypeScript / React / Three.js / Tauri) is MIT-style: reuse freely, no warranty. The
house designs themselves are not licensed for reuse.
