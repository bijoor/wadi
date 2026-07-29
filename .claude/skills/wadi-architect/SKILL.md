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

Key files (read lazily, as SKILL.md directs):
- `wadi-skill/architect/reference/data-model.md` — complete `.wadi` schema (generated
  from `editor/src/schema/houseConfig.ts`).
- `wadi-skill/architect/reference/{coordinate-system,roof-v2-guide,parametric-conventions}.md`
- `wadi-skill/architect/examples/*.wadi` — validated houses to copy from (currently the
  `coastal_konkan` grid + centreline template).
- `wadi-skill/architect/scripts/validate.mjs` and `preview.sh` — validate + render.
