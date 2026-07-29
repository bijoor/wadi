# Verify visually — read the render, don't author blind

The user sees the live 3D model; you don't. Close the loop by rendering the
config to images and **Read**ing them, so you catch layout/size/roof mistakes
yourself instead of shipping them.

## How

```bash
wadi-skill/architect/scripts/preview.sh <ABS_PATH_TO_config.json> [out_dir]
```

Produces (and prints paths to):
- **`plans.png`** — all floor plans: room names, positions, sizes (labelled in
  **feet**), walls, doors/windows, staircase. The single most useful view.
- **`elevations.png`** — front / back / left / right elevations: wall/floor
  heights and the **roof profile** (a 2D view of the built model).
- **`roof.png`** — roof top view (segments/hips/valleys).
- All SVGs under `<out_dir>/2d/` (per-floor plans, each elevation, roof, pillars)
  if you need a specific one.

Then use the **Read** tool on the PNG paths to actually look at them.

## When to render

- After creating a house from scratch, before saying it's done.
- After any non-trivial edit (moved/resized/added rooms, roof changes).
- Whenever the user says "that doesn't look right" — render and compare to what
  they describe.

## What to check on the plan

- Rooms are **where the brief says** (remember **Y is DOWN**: north rooms sit at
  the TOP of the plan / smaller Y).
- Rooms **don't overlap** and sit **inside the plinth**.
- Sizes match the request (the labels are in feet; your config values are ft×10).
- Doors/windows are on the intended walls, within the wall length.
- Wet areas line up vertically across floors (compare the floor panels).

## What to check on the elevations / roof

- Overall height/proportions look right; floors stack sensibly.
- The **roof covers the whole footprint**, correct hip/gable ends, sensible pitch.
- No gaps between roof and walls; overhang looks intentional.

## If it's wrong

Fix the config, re-run `preview.sh`, Read again. Only tell the user it's ready
once the render matches the intent. This render is byte-identical to the app's
Plans/Elevations/Roof tabs, so if it looks right here it looks right there.

> Note: `preview.sh` renders the **2D drawings** (from the app's own generators).
> It does not produce a 3D perspective screenshot — that needs the live app or a
> headless-browser capture. The plans + elevations are usually enough to verify
> correctness; ask the user to glance at the live 3D for the final look.
