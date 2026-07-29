# Wadi grid convention — first-class parametric grids

Status: **design agreed, Phase 1 starting** (2026-07-29). This formalizes the
"grid-point convention" that was previously an informal recipe
(`wadi-skill/architect/reference/parametric-conventions.md`) + per-model
`build_*.mjs` generators. It supersedes the ad-hoc `points`-as-grid pattern in
atale / cottage / family_home.

## Decisions (owner-confirmed)

1. **Grid lines are wall CENTRELINES.** A grid is independent of wall thickness
   (walls straddle the line) → the same grid is reusable across wall sizes.
2. **The grid is the base; rooms derive from it.** A room's `x/y/width/length` are
   COMPUTED from grid lines, so room formulas never need editing. All design lives at
   house/grid level; rooms just name the lines they sit between.
3. **Grid is canonical and fixed; rooms follow the grid** (not absorber rooms→grid).
   Grids may be **irregularly spaced**. A canonical grid means rooms are always aligned
   → no wall-alignment checks. (How to *design* good grids we learn from more templates.)
4. **Grids are first-class entities**, top-level and **reusable across templates**.
   Existing templates get converted to formal grids.
5. **No manual wall-counting** (falls out of the tartan/centreline model below).
6. **A reusable build scaffolder** replaces the per-model `build_*.mjs`.

Research-informed refinements (owner-confirmed):

- **Axial naming (industry standard).** X-lines are **numbered** (`1,2,3…`), Y-lines are
  **lettered** (`A,B,C…`); a node is the intersection (`B2`, `C4`). Matches the atale
  drawing and the C1–C16 structural sheets.
- **Per-line wall thickness = the Tartan grid** (major bands = rooms, minor bands =
  wall/service zones). Each line carries a thickness (default = house `wall_thickness`);
  exterior lines can be thicker (your refs: 230 mm ext / 150 mm int). *Schema supports it
  from v1; differentiated ext/int rendering is a fast-follow — see "Deferred".*
- **One role-tagged grid now, extensible to two.** Real practice separates the
  **structural** grid (columns, load-bearing) from the **planning** grid (partitions).
  v1 uses ONE grid whose lines carry an optional `role` (`structural` | `planning`), so a
  second planning grid + module hierarchy can be added later without breaking v1. Fits
  Konkan RCC where columns are embedded in walls at grid intersections.

## The model

A **grid** is a named set of ordered centrelines on each axis:

```jsonc
"grids": {
  "main": {
    "x": [ {"name":"1","at":0}, {"name":"2","at":"=Kitchen.W"}, {"name":"3","at":"=House.W"} ],
    "y": [ {"name":"A","at":0}, {"name":"B","at":"=Bedroom.L"}, {"name":"C","at":"=House.L"} ]
  }
}
```

- `x` / `y`: ordered arrays of centrelines. `at` = position (number or `=formula` over
  `variables`/`points`). Irregular spacing allowed.
- Optional per line: `role` (`structural`|`planning`, default both) and `thickness`
  (number|formula; default = house `wall_thickness`). Thickness is the tartan minor band.

**Rooms bind to a cell by naming their bounding lines — zero coordinate formulas:**

```jsonc
{ "type":"room", "name":"Kitchen", "grid":"main", "cell": { "x":["1","2"], "y":["A","B"] } }
```

**Pillars sit at a node:**

```jsonc
{ "type":"pillar", "name":"B2", "grid":"main", "at": { "x":"2", "y":"B" } }
```

### Derivation (grid-expansion)

For a room cell `x:[x0,x1] y:[y0,y1]` with effective thickness `t` (v1: one house
`wall_thickness`; general: per-line):

```
x      = X[x0] − t/2
width  = (X[x1] − X[x0]) + t          // general: + t(x0)/2 + t(x1)/2
y      = Y[y0] − t/2
length = (Y[y1] − Y[y0]) + t
```

Pillar node `x:xi,y:yj` (square `pillarT`): `x = X[xi] − pillarT/2`,
`y = Y[yj] − pillarT/2`, `width = length = pillarT`.

**Why it's self-consistent with the renderer** (which insets each room's walls *inward*
by `t`): the wall then lands **centred on its grid line** `[X[k]−t/2, X[k]+t/2]`. Two
rooms sharing line `X[k]` each produce a wall on that exact band → **one shared wall,
overlap automatic, thickness-independent** (change `t` → walls stay centred on the same
grid). Delivers decisions 1/2/3/5 directly. The building outline (and `plinth` /
`floor_slab`) = the extreme lines ± `t/2`.

## Schema additions (additive-optional; `.strict()` still passes)

- Top-level `grids: Record<string, GridDef>` (like `components`). `GridDef = { x:
  GridLine[], y: GridLine[] }`; `GridLine = { name, at, role?, thickness? }`.
- Room (and floor_slab): optional `grid: string` + `cell: { x:[string,string],
  y:[string,string] }`.
- Pillar: optional `grid: string` + `at: { x:string, y:string }`.
- `x/y/width/length` stay required literals (schema unchanged) — the scaffolder writes
  valid positive placeholders that grid-expansion overwrites, exactly like today's
  formula two-step. So no schema-strictness fight.

## Resolution / expansion

New **grid-expansion** step in `editor/src/param/resolve.ts` (`resolveParametric`),
AFTER variables/points resolve (grid `at` formulas reference them) and BEFORE the
existing per-object formula pass:

1. Resolve every grid line `at` (and `thickness`) to a number.
2. For each object carrying `grid`+`cell`/`at`, compute `x/y/width/length` and write them
   onto the object (overwriting placeholder literals).
3. Everything downstream (`expandRoomWalls`, all renderers) is unchanged — they see plain
   numbers. (Same "expand at resolve time" pattern as components/staircase/room-items.)

## v1 scope

- Schema: `grids` + room/slab `cell` + pillar `at` (with `role`/`thickness` fields present).
- Resolver grid-expansion (uniform house `wall_thickness`).
- Tests (grid resolves; cell→coords; overlap correctness; scale sweep).
- Convert **`coastal_konkan`** to a formal grid and verify identical/correct render.

## Deferred (schema is forward-compatible with these)

- **Differentiated ext/int wall thickness in rendering** — needs per-wall thickness in
  the renderer (today a room draws all walls at one thickness). Per-line `thickness` is
  stored now; wiring it visually is a fast-follow (possibly via an explicit-`wall`
  emission from the grid).
- **Second (planning) grid + module hierarchy** (§ research 1, 4.3) — enabled by the
  `role` tag.
- **Tartan-band variant** (rooms sized to the exact module, walls *between* bays) — for
  modern/modular templates where on-module room sizes matter.
- **Grid-anchored openings** (e.g. entrance flanks / their pillars keyed to a node).
- **Cross-file grid reuse** (a shared grid library imported by many templates) — v1 grids
  are in-file.
- **Editor UI** for grids — v1 authors via JSON + the scaffolder.

## Phasing

1. **Schema + resolver grid-expansion + tests.** ← start here
2. **Convert `coastal_konkan`** to a formal grid; verify (preview + geometry-issues).
3. **Reusable scaffolder** (`{variables, grid, rooms→cells, pillars, openings}` → resolved
   `.wadi`), replacing `build_*.mjs`.
4. **Convert cottage / family_home / atale.**
5. **Rewrite `parametric-conventions.md`** around the formal grid; update examples.

## Verification (every phase)

- `npx tsc -b` clean; `npx vitest run` green (+ new grid tests).
- `resolveParametric` → 0 warnings; `HouseConfig.safeParse` ok.
- Rooms fill the plot exactly; every opening fits; `expandRoomWalls` throws nothing.
- **Scale sweep** — resolve+expand at small / large / off-aspect plots.
- Live: preview.sh / app "Geometry issues" says none.
