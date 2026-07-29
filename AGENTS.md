# AGENTS.md — guidance for coding agents in the Wadi repo

Vendor-neutral entrypoint for AI coding agents (Google Antigravity, Cursor, Claude
Code, …). Claude Code users also have `CLAUDE.md` (repo build/architecture notes) and
the `.claude/skills/` adapters, which point at the same skills described here.

## Wadi in one line

Wadi procedurally designs parametric houses. A house is a single JSON document (a
`.wadi` file / `house_config.json`) that the editor + desktop app render to a live 3D
model, 2D floor plans, elevations, and roof views. The schema is defined in
`editor/src/schema/houseConfig.ts` (Zod) — the single source of truth.

## Skill: author a house design (`.wadi`)

When the user wants to **create, edit, or reason about a house model** — rooms, walls,
roofs, floors, doors, windows, staircases, pillars, kitchen platforms, furniture — use
the **Wadi architect skill** at:

```
wadi-skill/architect/SKILL.md
```

Read that file and follow it. It covers the live edit→preview loop, deriving a house
from a brief vs. recreating one from a drawing, and the pitfalls. Supporting files:

- `wadi-skill/architect/reference/data-model.md` — the **complete `.wadi` schema**,
  generated from the Zod source so it never drifts. Regenerate after a schema change:
  `node wadi-skill/architect/scripts/gen-schema-doc.mjs editor/src/schema/houseConfig.ts wadi-skill/architect/reference/data-model.md`
- `wadi-skill/architect/reference/{coordinate-system,roof-v2-guide,parametric-conventions}.md`
- `wadi-skill/architect/examples/*.json` — six valid houses to copy from.

## Running the skill's tooling

Both scripts reuse the app's own TypeScript, so they need the editor deps installed
once (`npm --prefix editor install`) and are run from inside this repo:

- **Validate** a config (schema + wall/roof geometry pipeline):
  `cd editor && npx tsx ../wadi-skill/architect/scripts/validate.mjs <ABS_PATH.wadi>`
- **Preview** to PNGs you can open/read (floor plans, elevations, roof):
  `wadi-skill/architect/scripts/preview.sh <ABS_PATH.wadi>`

The **live 3D** loop additionally needs the Wadi desktop app installed and watching the
file you edit; without it you can still author, validate, and render preview images.

## Capabilities assumed

File read/write + shell + Node. Nothing agent-specific — any agent with those can run
this skill.
