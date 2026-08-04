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
