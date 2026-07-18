# Claude Skill: Author `house_config.json` from architect sketches

## Goal

Let a user drop an architect's sketch (photo, PDF, freehand drawing, or CAD
export) into Claude — chat, Cowork, claude.ai — and iteratively produce or
update a valid `house_config.json` that the Konkan-house editor can render.
Claude does the reading + translation; the user validates in the editor at
`localhost:8000/editor/`.

## Why a Skill (and not "just prompting")

Claude Skills are the packaging format Anthropic exposes for pinned domain
knowledge: `SKILL.md` + bundled files that get injected into the context
whenever the skill is invoked. Compared to ad-hoc prompting:

- **Schema is pinned** — Claude always knows the exact shape of
  `house_config.json`, avoiding hallucinated fields.
- **Conventions are pinned** — coordinate frame (Inkscape X-right / Y-down),
  units (10 project units = 1 ft), roof v2 semantics, floor stack rules.
- **Reusable across users** — anyone with the skill installed gets the same
  translation quality; no re-teaching.
- **Composable with images** — Claude Chat + Cowork accept image attachments,
  and the skill tells Claude how to interpret sketch conventions.
- **Discoverable** — skills appear in the "/" menu (Chat) or the skill panel
  (Cowork), so an architect finds it without re-reading a long system prompt.

## Deliverables

Three artifacts, built in phases.

### Phase 1 — Skill bundle (MVP)

A folder `skills/wadi-config/` in this repo:

```
skills/wadi-config/
├── SKILL.md                        # entry point — bootstraps Claude
├── reference/
│   ├── schema.md                   # human-readable schema doc (from Zod)
│   ├── coordinate-system.md        # X, Y, Z conventions + unit conversion
│   ├── roof-v2-guide.md            # segments, joints, endpoints, trusses
│   ├── floor-stack-rules.md        # plinth + floor_heights only; independent dims
│   └── kitchen-platform-guide.md   # polyline + side + depth + height
├── examples/
│   ├── two_story_wadi.json       # symlinked/copied from public/templates/
│   ├── courtyard_home.json
│   ├── verandah_cottage.json
│   ├── modern_flat.json
│   └── l_shape_villa.json
└── prompts/
    ├── sketch-to-config.md         # step-by-step for interpreting sketches
    ├── update-existing.md          # iterating on a loaded config
    └── validation-loop.md          # what to do when the editor flags errors
```

**`SKILL.md`** is the entrypoint. It should:

1. State the goal in one sentence.
2. Tell Claude which reference files to read when (lazy — don't dump
   everything into context up front; direct Claude to open specific
   files as the conversation narrows).
3. Give the standard workflow: read the sketch → propose a config →
   ask the user to load it in the editor → iterate on feedback.
4. Enumerate common pitfalls (Y-down not Y-up, room dimensions in
   project units not feet, roof widths must match plinth footprint,
   etc.).

**`reference/schema.md`** — generated from `editor/src/schema/houseConfig.ts`.
Not the raw Zod code (too much noise). Instead: field-by-field with type,
optional/required, valid range, cross-references, and an example value.
Section per object type (`floor_slab`, `pillar`, `room`, `wall`, `door`,
`window`, `staircase`, `kitchen_platform`, `roof`).

**`reference/roof-v2-guide.md`** — the tricky one. Cover:
- Segment = ridge polyline; width = perpendicular span; `default_endpoint`
  = closed (hip) / open (gable).
- Multi-segment joints (L, U, closed rectangle) — endpoints must be
  coincident to auto-resolve as joints.
- Trusses per segment (`fink` for pitched, `mono_pitch` for shed).
- Framing overrides.
- Common shapes with example configs: single hip, gable, L, courtyard.

**`examples/`** — the existing templates verbatim. Claude uses them as
few-shot references when producing a new config.

### Phase 2 — Validation feedback loop

Add a small CLI script the user runs BETWEEN Claude turns:

```
skills/wadi-config/scripts/
├── validate.mjs        # node script: reads JSON from stdin/arg, runs Zod validate + computeMergedV2Spec, prints structured errors
└── preview.mjs         # optional: emits a top-view PNG/SVG of the current config so user can screenshot back to Claude
```

Workflow:
1. Claude proposes a config → writes to `/tmp/proposed.json`.
2. User runs `npx skills/wadi-config/scripts/validate.mjs /tmp/proposed.json` — prints "OK" or a numbered error list.
3. User pastes the error list back to Claude — Claude fixes.
4. Loop until OK; user loads in the editor.

`validate.mjs` should reuse the existing `editor/src/schema/houseConfig.ts`
+ `editor/src/svg2d/roof/v2/computeFromHouse.ts` so it catches BOTH schema
errors AND pipeline errors (e.g. "segment has zero length", "shed missing
slope"). Same failure modes Claude would see if it just guessed.

### Phase 3 — MCP server (optional, if Phase 2 is too manual)

Expose the same operations as an MCP server:

- `validate_config(json)` → `{ ok: bool, errors: [...] }`
- `render_preview(json, view: "top" | "front" | "iso")` → returns a
  base64 SVG/PNG Claude can view.
- `load_template(name)` → returns the JSON to start from.
- `list_object_types()` → the current addable types with schema hints.

With MCP, Claude can call these tools directly in one conversation — no
copy/paste. Requires the user to run an MCP server locally (Node/Python)
and point their Claude client at it. This is the cleanest UX but the
heaviest to set up.

## Sketch interpretation strategy

For an architect's sketch, the skill's `prompts/sketch-to-config.md`
should walk Claude through:

1. **Establish orientation** — Where is north? (Standard drafting = up.)
   Confirm with the user if unclear.
2. **Identify the plot / plinth** — Read the outer rectangle dimensions.
   Note that the config's Y-axis points DOWN (Inkscape frame), so a
   drawing with north-up gets its Y flipped when transcribed.
3. **Extract rooms** — Each labeled room → one `room` object with
   `x, y, width, length`. Wall openings (doors/windows) go inside
   `walls: { <side>: { openings: [...] } }`.
4. **Extract standalone walls** — Any wall not enclosing a room becomes
   a `wall` object with `start_x, start_y, end_x, end_y`.
5. **Pillars, staircases, kitchen platforms** — each as its own object.
6. **Roof** — Read the roof plan sketch separately (usually a
   separate view). Convert ridge lines → segments; hip vs gable →
   `default_endpoint`; multi-wing L/U → multi-segment with coincident
   endpoints.
7. **Cross-check** — Total plot dimensions, roof footprint = plinth
   footprint, floor count = sketch's floor plan count.

## Iterative update flow

For updating an already-loaded config:

1. User attaches a screenshot of the current state from the editor.
2. User describes the change ("make the bathroom bigger", "add a
   window on the north wall of Bedroom_2", "extend the kitchen
   platform south by 3 ft").
3. Claude reads the current config (either pasted, or from the
   skill's `read_current_config` MCP tool), applies a minimal patch,
   returns the updated JSON.
4. User validates + loads.

The skill's `prompts/update-existing.md` should stress **minimal
patches** — Claude should preserve unchanged objects verbatim so
diffs stay reviewable.

## Rollout plan

**Week 1**: Phase 1 skill bundle.
- Extract `schema.md` from Zod.
- Write `SKILL.md` + reference docs.
- Copy existing templates into `examples/`.
- Test with a hand-drawn sketch → validate manually.

**Week 2**: Phase 2 validation script.
- `validate.mjs` reusing editor code.
- Update workflow docs.
- Onboard 1-2 architects for pilot use.

**Week 3+**: Phase 3 MCP server if pilot friction warrants it.

## Distribution

- **Repo**: Skill lives at `skills/wadi-config/` in this repo
  so it version-tracks with the schema.
- **Claude Chat / Cowork**: Upload the skill folder via the Skills UI.
  Re-upload when schema changes.
- **claude.ai**: If Anthropic exposes a public skill registry, publish
  under the user's account.
- **Local**: For MCP, document a one-line `npx` command that starts
  the server against the repo's schema.

## Open questions

- Do we need to support the user editing across MULTIPLE conversations
  (persistent config state)? MCP tools would help; without them, the
  user carries the JSON around manually.
- Should the skill include the `editor/scripts/migrate-templates.ts`
  logic so it can convert legacy `hip_roof` / `gable_roof` blocks the
  user might have?
- Multimodal: does Claude Chat / Cowork accept PDF attachments? Or
  only images? (Affects whether architects need to pre-convert their
  CAD exports.)

## Risks

- **Schema drift**: If the editor schema changes and the skill isn't
  rebuilt, Claude produces invalid configs. Mitigation: add a
  post-commit hook that regenerates `skills/wadi-config/reference/schema.md`
  from the Zod source.
- **Coordinate confusion**: Y-down is unusual; Claude will drift to
  Y-up unless the skill hammers this in every reference file.
- **Roof v2 complexity**: The unified segment model, joint resolution,
  and framing overrides are dense. Expect several iterations on the
  roof-v2 reference doc based on pilot feedback.
