// konkan/base.wdl — a starter pack of reusable, goal-tagged Konkan house parts.
//
// A MODULE (no `house` body): import it and stamp its components onto a floor —
//   import "konkan/base" as kb
//   floor 1 "Ground" { use kb.Stairwell at (208, 64) with { rise: 116 } }
//
// Each component is authored in LOCAL coordinates (origin 0,0) and is flat
// (it does not `use` other components), so it stamps cleanly into any host.
// The `goal` line is the discovery key — `wadi_module "konkan/base"` (or a
// `wadi_modules` query) surfaces the component whose goal matches the intent.

// Climb one floor. A single straight run for a short rise; give `run` and the
// staircase auto-folds into switchback flights (max_run) when the rise is tall.
component Stairwell goal "climb to the next floor" {
  param rise = 116          // total height to the floor above (= floor_height)
  param run = 200           // max horizontal run before a switchback landing
  staircase name "Stair" at (0, 0) step (7, 11, 44) direction south total_height rise max_run run
}

// A shaded sit-out running along the front of the house — the room is open to
// the south (front) and enclosed on the other three sides. Add a roof + pillars
// in the host if you want it covered.
component Verandah goal "a shaded sit-out along the house front" {
  param across = 200        // span across the front
  param deep = 70           // how far it projects
  room Verandah at (0, 0) size (across, deep) {
    wall north east west    // open to the south
  }
}

// An otla — the traditional Konkan raised platform at the entrance where people
// sit. A low slab you place at the doorway (its thickness is the platform rise).
component Otla goal "a raised entrance platform to sit on (Konkan otla)" {
  param wide = 90
  param deep = 55
  param rise = 12           // platform height above grade
  slab name "Otla" at (0, 0) size (wide, deep) thickness rise
}

// A compact enclosed wet area (bathroom / WC): a small fully-walled room with a
// door on the front (south). Size it to the fixture you need.
component Bathroom goal "a compact enclosed wet area (bathroom / WC)" {
  param wide = 70
  param deep = 60
  room Bath at (0, 0) size (wide, deep) {
    wall north east west
    wall south { door BathDoor at 20 size (30, 78) }
  }
}

// A cooking area with an L-shaped masonry counter in the corner. Fixed size (the
// counter path can't be parametric), so the room exactly fits its counter.
component Kitchen goal "a cooking area with an L-shaped counter platform" {
  room Kitchen at (0, 0) size (150, 120) {
    wall north east south west
  }
  kitchen name "Counter" path ((8, 8), (130, 8), (130, 100)) side right depth 22 height 36
}

// A tulsi vrindavan — the raised masonry planter for the sacred basil that stands
// in a Konkan courtyard. A small square raised block; place it in the aangan.
component TulsiVrindavan goal "a raised courtyard planter for tulsi (sacred basil)" {
  param wide = 24           // square side
  param rise = 30           // planter height
  slab name "Tulsi" at (0, 0) size (wide, wide) thickness rise
}

// A parapet — a low wall enclosing a terrace edge (open at the top, no roof).
// Stamp it around a flat roof / terrace slab. (Per-side wall height is a fixed
// literal here — parametric per-side wall heights aren't supported yet.)
component Parapet goal "a low wall enclosing a terrace edge" {
  param wide = 200
  param deep = 200
  room Terrace at (0, 0) size (wide, deep) {
    wall north east south west height 36
  }
}
