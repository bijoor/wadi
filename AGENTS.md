# AGENTS.md — guidance for coding agents in the Wadi repo

Vendor-neutral entrypoint for AI coding agents (Google Antigravity, Cursor, Claude
Code, …). Claude Code users also have `CLAUDE.md` (repo build/architecture notes) and
the `.claude/skills/` adapters, which point at the same skills described here.

## Wadi in one line

Wadi procedurally designs parametric houses. A house is a single JSON document (a
`.wadi` file / `house_config.json`) that the editor + desktop app render to a live 3D
model, 2D floor plans, elevations, and roof views. The schema is defined in
`editor/src/schema/houseConfig.ts` (Zod) — the single source of truth.

## Skill: author a house design (`.wdl` → `.wadi`)

When the user wants to **create, edit, or reason about a house model** — rooms, walls,
roofs, floors, doors, windows, staircases, pillars, kitchen platforms, furniture — use
the **Wadi architect skill** at:

```
wadi-skill/architect/SKILL.md
```

You author in the **Wadi DSL** (`.wdl`) and compile it to the `.wadi` the app renders —
the DSL is complete (every object type is first-class) and the compiler catches errors
with `line:col`. Read the SKILL.md and follow it: it covers the live edit→compile→preview
loop, deriving a house from a brief vs. recreating one from a drawing, and the pitfalls.
Supporting files:

- `wadi-skill/architect/reference/dsl.md` — the **`.wdl` DSL syntax** (primary reference).
- `wadi-skill/architect/reference/data-model.md` — the underlying **`.wadi` schema** the
  DSL compiles to, generated from the Zod source so it never drifts. Regenerate after a
  schema change:
  `node wadi-skill/architect/scripts/gen-schema-doc.mjs editor/src/schema/houseConfig.ts wadi-skill/architect/reference/data-model.md`
- `wadi-skill/architect/reference/{coordinate-system,roof-v2-guide,parametric-conventions}.md`
- `wadi-dsl/examples/*.wdl` — validated `.wdl` houses to copy from (minimal, two_room,
  two_story, coastal, complete).

## Running the skill's tooling

The scripts reuse the app's own TypeScript, so install deps once
(`npm --prefix editor install` and `npm --prefix wadi-dsl install`) and run from inside
this repo:

- **Compile** a `.wdl` → validated `.wadi` (parse + resolve + schema/geometry check):
  `wadi-skill/architect/scripts/compile.sh <ABS>.wdl <ABS>.wadi`
- **Preview** the compiled `.wadi` to PNGs you can open/read (floor plans, elevations,
  roof): `wadi-skill/architect/scripts/preview.sh <ABS>.wadi`
- **Validate** a raw `.wadi` directly (hand-made JSON):
  `cd editor && npx tsx ../wadi-skill/architect/scripts/validate.mjs <ABS>.wadi`

The **live 3D** loop additionally needs the Wadi desktop app installed and watching the
compiled `.wadi`; without it you can still author, compile, and render preview images.

## Capabilities assumed

File read/write + shell + Node. Nothing agent-specific — any agent with those can run
this skill.
