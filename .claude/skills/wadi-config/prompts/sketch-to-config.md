# Build a house from a drawing — GUIDED DIALOG (the user interprets, you construct)

**Do NOT try to read the architect's drawing yourself.** Dimensions, scale, and
symbols on technical drawings are unreliable to read off a PDF/photo, and guessing
them builds the wrong house. Instead run a **step-by-step dialog**: the USER reads
their drawing and tells you each piece; YOU do all the coordinate / scale /
convention work and show them the result at each step so they can correct it.

You may glance at the drawing for orientation, but treat **every** dimension and
position as something to **confirm with the user**, never to read off yourself.

## Division of labour (this is the whole point)

- **You handle silently — never ask the user for these:** coordinates (`x`/`y`),
  the **Y-DOWN** frame, the **ft × 10** conversion, the **outer-wall-face**
  convention, placing a room relative to its neighbours, roof placement + Z,
  validation and rendering.
- **You ask the user — they read it off the drawing:** names, sizes in **feet**,
  where things are in **plain spatial terms**, which walls have doors/windows.

Ask **spatially, not numerically**: "How big is the bedroom, in feet?" and "Where
is it — which corner, or next to which room?" — **not** "What's its x, y?" The user
should never have to think in the coordinate system. That's your job.

## The dialog

### 0. Frame first
Ask, then build site + plinth + one `floor_slab` per floor:
- Plot size (in feet)? Units on the drawing (ft or m)?
- Which way is **north** on the drawing?
- How many floors? Name for each.

Render (`preview.sh`) or point them at the live app; confirm the outline/size.

### 1. Rooms — one at a time, per floor
For each room, ask:
- Name?
- Size — **width × length in feet**?
- **Where is it?** (a corner, or "north of the kitchen", "sharing the east wall of
  the hall")
- Which walls have doors/windows, and roughly where along each wall?

Then YOU: convert ft × 10, compute `x`/`y` from the described position (anchor to
rooms already placed), treat the size as the **outer** wall footprint, add the
openings. **Render and ask "does this match your drawing?"** Fix from their answer
**before** starting the next room.

Start with a corner room; anchor every later room to ones already placed, so the
user only ever gives you relative positions.

### 2. Other objects
Staircase, verandah / balcony, pillars, kitchen platform — same ask → place →
render → confirm loop.

### 3. Roof (last)
Ask: hip / gable / flat / shed? Pitch/steepness? Over which parts of the house?
Place it on its **own top floor** (see `roof-v2-guide.md`); show the elevations;
confirm.

## Rules for the dialog

- **One piece at a time, render and confirm each.** Never construct the whole house
  from one big answer — it's impossible for either of you to QC.
- **If an answer is ambiguous, ask a follow-up — don't guess.** ("Is the bathroom
  inside the master bedroom, or off the hallway?")
- **Keep the user in plain language.** If they volunteer coordinates, fine, but
  never require them.
- **Keep a short running brief** (see `design-brief.md`) of what they've told you,
  so later changes re-derive cleanly and you don't re-ask.
- Validate (`validate.mjs`) and do a final render pass before calling it done.
