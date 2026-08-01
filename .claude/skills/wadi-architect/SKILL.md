---
name: wadi-architect
description: >-
  Author and edit Wadi house designs (.wadi / house_config.json files) from a
  plain-English brief or an architect's sketch, while the Wadi desktop app
  live-previews the 3D model. Use whenever the user wants to create, modify, or
  reason about a Wadi house model — rooms, walls, roofs, floors, doors, windows,
  staircases, pillars, kitchen platforms, furniture — or mentions a .wadi file,
  house_config.json, or the Wadi designer/architect.
---

# Wadi architect (Claude Code adapter)

This is the Claude Code entrypoint for the **agent-neutral Wadi architect skill**.
The skill itself — instructions, the complete data model, coordinate/roof/parametric
references, examples, and the validate/preview scripts — lives in the repo at
`wadi-skill/architect/`.

**Do this:** read `wadi-skill/architect/SKILL.md` and follow it. It is the source of
truth for the workflow (the live edit→preview loop, brief→house vs drawings→house,
validation, and the pitfalls).

You author in the **Wadi DSL** (`.wdl`), not raw JSON — and you **never produce a
`.wadi`**. The Wadi app's DSL previewer compiles + renders the `.wdl` live (desktop
**⌘⇧D**, or `wadi.house/dsl`), so a single `.wdl` on disk is the **shared source you and
the human co-edit**. `reference/dsl.md` is the syntax reference; `scripts/check.sh`
validates a `.wdl` for feedback (against a throwaway temp — no `.wadi` written).

Key files (read lazily, as SKILL.md directs):
- `wadi-skill/architect/reference/dsl.md` — the **`.wdl` DSL syntax** (primary reference).
- `wadi-skill/architect/reference/data-model.md` — the underlying `.wadi` schema the DSL
  compiles to (generated from `editor/src/schema/houseConfig.ts`; also the `raw`-escape
  field reference).
- `wadi-skill/architect/reference/{coordinate-system,roof-v2-guide,parametric-conventions}.md`
- `wadi-dsl/examples/*.wdl` — validated `.wdl` houses to copy from (minimal, two_room,
  two_story, coastal, complete).
- `wadi-skill/architect/scripts/check.sh` (validate a `.wdl`, no `.wadi`) and `preview.sh`
  (render plans/elevations/roof PNGs from a `.wdl`). `validate.mjs` still checks a raw
  `.wadi` if you ever have one.
