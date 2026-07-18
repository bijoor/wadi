# Claude Skill: Author `house_config.json` live, with the Tauri app as the viewer

## Goal

Let a user work with Claude as if Claude were the editor: Claude reads an
architect's sketch (photo, PDF, freehand, CAD export) or a plain-English
request, edits `house_config.json`, and the **Wadi Tauri app updates the 3D
model live** — no manual download / reload. The user watches the model change
in real time and steers with follow-up messages.

Two Claude surfaces are in scope, built in order:

1. **Local (Claude Code)** — Claude runs on the user's machine and writes
   `house_config.json` directly. Simplest; proves the live loop end to end.
   **Build and test this first.**
2. **Cloud (Cowork / Chat)** — Claude runs in Anthropic's cloud and reaches
   the local file through an MCP bridge. **Build this after the local loop
   works.**

The live viewer is the same in both cases: the Wadi Tauri app.

## Why a Skill (and not "just prompting")

Claude Skills are the packaging format for pinned domain knowledge: `SKILL.md`
+ bundled files injected into context when the skill is invoked. Compared to
ad-hoc prompting:

- **Schema is pinned** — Claude always knows the exact shape of
  `house_config.json`, avoiding hallucinated fields.
- **Conventions are pinned** — coordinate frame (Inkscape X-right / Y-down),
  units (10 project units = 1 ft), roof v2 semantics, floor stack rules.
- **Reusable across users** — anyone with the skill installed gets the same
  translation quality; no re-teaching.
- **Composable with images** — Chat + Cowork accept image attachments, and the
  skill tells Claude how to interpret sketch conventions.
- **Discoverable** — skills appear in the "/" menu (Chat) or the skill panel
  (Cowork), and are available to Claude Code locally.

## Live-preview architecture (the core of this rewrite)

The live loop has **two independent halves**. Half 1 is identical for both
surfaces; Half 2 is what differs between local and cloud.

### Half 1 — The Tauri app re-renders when the config file changes

Facts about the app today (verified against the repo):

- The Tauri app loads `docs/index.html` (the **viewer shell**, per
  `frontendDist: "../docs"`). That shell is a **live in-browser Three.js
  render** of the config: `editor/src/viewer/main.ts` does
  `fetch("house_config.json")` **once on load** and builds the model from the
  TS geometry port. **This is the live surface — no Blender, no GLB.** The
  Blender GLB pipeline stays a separate, slow export and is explicitly *not*
  part of the live loop.
- `src-tauri` already enables `tauri-plugin-fs` and `tauri-plugin-dialog`, and
  `editor/src/io/fileIO.ts` already reads/writes via the fs plugin when
  `isTauri()`. The fs capability scope is `**` (any path).
- **The gap:** the app fetches config exactly once and never watches for
  changes.

Work to close the gap — add a watcher that re-fetches + rebuilds the model when
the config file changes. Two implementations, pick one:

- **(A) Frontend mtime polling** — the fs plugin is already enabled, so a small
  amount of TS in the viewer shell polls the loaded file's mtime every ~500 ms
  and re-fetches + rebuilds on change. Zero Rust. Fastest to ship; start here.
- **(B) Rust file-watcher** — the `notify` crate watches the path and emits a
  `config-changed` Tauri event; the frontend `listen()`s and re-fetches.
  Event-driven, no polling, slightly more work. Upgrade to this if polling
  feels laggy.

### The file-path contract (important — installed vs dev differ)

- The real config file is `docs/house_config.json`. The repo-root
  `house_config.json` is a **symlink** to it. Editing either touches the same
  inode.
- In **`cargo tauri dev`**, the frontend is served from `docs/` (via
  `scripts/tauri-dev-serve.py`), so `fetch("house_config.json")` resolves to
  `docs/house_config.json` — the live repo file. Local test loop works
  immediately against this path.
- In the **installed / DMG app**, `docs/` is baked read-only inside the `.app`.
  `fetch("house_config.json")` reads a frozen copy, **not** the repo file. So
  the installed app must load the working config from an **external, writable
  absolute path**.

**Resolution:** the watcher targets the **currently-loaded file's absolute
path** (`state.filePath`, which `fileIO.ts` already records from the Tauri open
dialog), falling back to the bundled default only when nothing external is
open. Contract:

1. User opens their working `house_config.json` once via the app (Tauri open
   dialog → absolute path recorded in `state.filePath`).
2. The app watches **that** absolute path.
3. Claude (Code or MCP) writes **that same** absolute path.
4. Watcher fires → re-fetch → rebuild → live update.

This single contract works in both dev and the installed app.

### Half 2 — Getting Claude's edits onto that file

- **Local (Claude Code):** Claude writes the working file directly with its
  Edit/Write tools. **No bridge needed.** The moment Half 1 exists, the live
  loop works.
- **Cloud (Cowork / Chat):** Claude has no local filesystem. It reaches the
  file through a local **MCP server** (see Phase 4) exposing read/write/validate
  operations, connected to the cloud client as a connector. The Tauri watcher
  (Half 1) is unchanged.

## Deliverables & phases (build in this order)

### Phase 1 — Skill bundle (MVP)

A folder `skills/wadi-config/` in this repo:

```
skills/wadi-config/
├── SKILL.md                        # entry point — bootstraps Claude
├── reference/
│   ├── schema.md                   # human-readable schema doc (from Zod)
│   ├── coordinate-system.md        # X, Y, Z conventions + unit conversion
│   ├── roof-v2-guide.md            # segments, joints, endpoints, trusses
│   ├── floor-stack-rules.md        # plinth + floor_heights; independent dims
│   ├── kitchen-platform-guide.md   # polyline + side + depth + height
│   └── live-workflow.md            # how the live Tauri loop works (this doc, distilled)
├── examples/                       # copied from editor/public/templates/ (real names)
│   ├── two_story_konkan.json
│   ├── courtyard_home.json
│   ├── verandah_cottage.json
│   ├── modern_flat.json
│   ├── l_shape_villa.json
│   └── blank.json
└── prompts/
    ├── sketch-to-config.md         # step-by-step for interpreting sketches
    ├── update-existing.md          # iterating on a loaded config (minimal patches)
    └── validation-loop.md          # what to do when validation flags errors
```

**`SKILL.md`** — the entrypoint. It should:

1. State the goal in one sentence.
2. Explain the **live loop**: the user has the Wadi Tauri app open with their
   working `house_config.json`; Claude edits that file; the app re-renders
   automatically. Claude should tell the user which file it is editing and
   remind them to keep the app open.
3. Tell Claude which reference files to read when (lazy — direct Claude to open
   specific files as the conversation narrows; don't dump everything up front).
4. Give the standard workflow: read the sketch/request → edit the working file
   → the app updates live → iterate on the user's spoken feedback (and on
   validation output).
5. Enumerate common pitfalls (Y-down not Y-up, room dimensions in project units
   not feet, roof widths must match plinth footprint, minimal patches to keep
   diffs reviewable).

**`reference/schema.md`** — generated from `editor/src/schema/houseConfig.ts`.
Not raw Zod (too noisy). Field-by-field: type, optional/required, valid range,
cross-references, example value. One section per object type (`floor_slab`,
`pillar`, `room`, `wall`, `door`, `window`, `staircase`, `kitchen_platform`,
`roof`).

**`reference/roof-v2-guide.md`** — the tricky one. Cover:
- Segment = ridge polyline; width = perpendicular span; `default_endpoint`
  = closed (hip) / open (gable).
- Multi-segment joints (L, U, closed rectangle) — endpoints must be coincident
  to auto-resolve as joints.
- Trusses per segment (`fink` for pitched, `mono_pitch` for shed).
- Framing overrides.
- Common shapes with example configs: single hip, gable, L, courtyard.

**`examples/`** — the existing templates verbatim, under their **real
filenames** (`two_story_konkan.json`, etc. — note these keep pre-rebrand
"konkan" names; the editor's `editor/public/templates/` is the source of
truth). Claude uses them as few-shot references.

### Phase 2 — Local live loop (Claude Code + Tauri watcher) — build & test first

This is the new heart of the plan. Steps:

1. **Add the watcher (Half 1, implementation A)** to the viewer shell so the
   model re-renders on config change, targeting `state.filePath`. Edit the
   source in `editor/` (never `docs/index.html` directly — it is clobbered by
   the viewer Vite build). Rebuild with `npm run build` (both bundles).
2. **Wire the file-path contract**: on Tauri open, record the absolute path and
   point the watcher at it.
3. **Test loop:** run `cargo tauri dev` (TaskStop any prior dev first), open the
   working `house_config.json`, then have Claude Code make edits and confirm the
   model updates live within ~1 s. Test a rename, a room resize, an added
   window, and a roof change.
4. **Skill guidance:** `prompts/*` and `SKILL.md` describe this loop so Claude
   Code edits the right file and narrates what it changed.

Exit criteria: Claude Code edits the working file, the Tauri app reflects the
change with no user action, across at least the four edit types above.

### Phase 3 — Validation (folded into the loop)

A Node script that reuses the editor's own schema + pipeline so Claude catches
the same failures the app would:

```
skills/wadi-config/scripts/
├── validate.mjs   # reads JSON (arg/stdin), runs Zod validate + roof v2 compute, prints structured errors
└── preview.mjs    # optional: emit a top-view SVG/PNG of the config for a quick sanity screenshot
```

`validate.mjs` must import `editor/src/schema/houseConfig.ts` +
`editor/src/svg2d/roof/v2/computeFromHouse.ts` so it catches BOTH schema errors
AND pipeline errors (zero-length segment, shed missing slope, etc.).

In the **local** loop Claude Code can run `validate.mjs` **itself** as a Bash
tool call before/after writing — no user copy/paste. In the **cloud** loop this
becomes an MCP tool (Phase 4). Document both in `prompts/validation-loop.md`.

### Phase 4 — MCP server (cloud Cowork / Chat surface)

Once the local loop is proven, expose the same operations over MCP so a
cloud Claude can drive the local app without copy/paste:

- `read_config()` → current working JSON.
- `write_config(json)` → validates, writes the working file (triggers the Tauri
  watcher → live update).
- `validate_config(json)` → `{ ok, errors: [...] }` (reuses `validate.mjs`).
- `render_preview(json, view: "top" | "front" | "iso")` → base64 SVG/PNG.
- `load_template(name)` / `list_object_types()`.

The server writes the **same working file path** the Tauri watcher targets, so
the live-reload half is unchanged from Phase 2. Requires the user to run the
MCP server locally and point their Claude client at it as a connector.

## Sketch interpretation strategy

`prompts/sketch-to-config.md` walks Claude through:

1. **Establish orientation** — where is north? (Standard drafting = up.)
   Confirm if unclear.
2. **Identify plot / plinth** — outer rectangle dimensions. The config's Y-axis
   points DOWN (Inkscape frame), so a north-up drawing gets its Y flipped when
   transcribed.
3. **Extract rooms** — each labeled room → one `room` with `x, y, width,
   length`. Openings go inside `walls: { <side>: { openings: [...] } }`.
4. **Extract standalone walls** — any non-enclosing wall → a `wall` object with
   `start_x, start_y, end_x, end_y`.
5. **Pillars, staircases, kitchen platforms** — each its own object.
6. **Roof** — read the roof plan separately; ridge lines → segments; hip vs
   gable → `default_endpoint`; L/U wings → multi-segment with coincident
   endpoints.
7. **Cross-check** — total plot dims, roof footprint = plinth footprint, floor
   count = sketch's floor-plan count.

## Iterative update flow

For updating an already-loaded config (the common live case):

1. User speaks a change ("make the bathroom bigger", "add a window on the north
   wall of Bedroom_2", "extend the kitchen platform south by 3 ft"), optionally
   with a screenshot of the current app state.
2. Claude reads the current working file, applies a **minimal patch**
   (unchanged objects preserved verbatim so diffs stay reviewable), writes it
   back.
3. The Tauri app updates live; the user reacts and the loop continues.

`prompts/update-existing.md` stresses minimal patches.

## Rollout plan

**Milestone 1 — Local live loop (Phases 1–2).**
- Extract `schema.md` from Zod; write `SKILL.md` + reference docs.
- Copy templates into `examples/` under real names.
- Add the Tauri watcher + file-path contract; test the four edit types with
  Claude Code via `cargo tauri dev`.

**Milestone 2 — Validation (Phase 3).**
- `validate.mjs` reusing editor code; Claude Code runs it inline.
- Update `prompts/validation-loop.md`.

**Milestone 3 — Cloud surface (Phase 4).**
- MCP server writing the same working file; connect a cloud Claude; pilot with
  1–2 architects.

## Distribution

- **Repo**: skill lives at `skills/wadi-config/` so it version-tracks the schema.
- **Claude Code**: available locally as a project skill.
- **Chat / Cowork**: upload the skill folder via the Skills UI; re-upload on
  schema change. Pair with the MCP connector for the live loop.
- **MCP**: document a one-line command that starts the server against the repo's
  schema and the user's working file path.

## Open questions

- **Installed-app watcher UX**: should the app remember the last-opened working
  file and auto-watch it on launch, so the user doesn't re-open every session?
- **Debounce**: Claude may write partial/successive edits; the watcher should
  debounce (~200–300 ms) and ignore invalid intermediate states rather than
  flashing a broken model.
- **Multi-conversation persistence**: MCP `read_config` lets a cloud Claude pick
  up state across conversations; local Claude Code reads the file directly.
- **Multimodal**: does Cowork/Chat accept PDF attachments, or only images?
  (Affects whether architects pre-convert CAD exports.)
- Should the skill fold in `editor/scripts/migrate-templates.ts` to convert
  legacy `hip_roof` / `gable_roof` blocks?

## Risks

- **Schema drift**: if the editor schema changes and the skill isn't rebuilt,
  Claude produces invalid configs. Mitigation: a post-commit hook that
  regenerates `skills/wadi-config/reference/schema.md` from the Zod source.
- **Installed vs dev path confusion**: the bundled `docs/` is read-only; the
  live file must be an external absolute path. The file-path contract above is
  the mitigation — get it wrong and edits silently hit a frozen copy.
- **Coordinate confusion**: Y-down is unusual; hammer it in every reference file.
- **Roof v2 complexity**: the unified segment model, joint resolution, and
  framing overrides are dense. Expect several iterations on the roof-v2 doc.
- **GLB vs live render divergence**: the live loop renders via the TS geometry
  port, while final GLB comes from Blender. Keep the TS port and Blender in
  sync, or the live preview will mislead. (Pre-existing risk, not new here.)
