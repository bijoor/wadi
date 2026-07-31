// A coastal Konkan cottage, authored entirely in the Wadi DSL.
// `tsx src/cli/main.ts examples/coastal.wdl` compiles it to a .wadi that the
// real Wadi pipeline validates + resolves + renders. This one file exercises
// every construct: the parametric core (var/point/grid/formula/configurator) and
// the domain vocabulary (floor/room/wall/opening/pillar), plus the `raw` escape
// for slab / plinth / ground / roof.

house CoastalCottage {
  convention center
  units feet_inches per_unit 10

  site { plot (600, 700) ref (0, 0) }
  defaults { floor_height 120 wall_height 108 slab_thickness 8 wall_thickness 8 }

  // --- Parametric core: the degrees of freedom + the grid scaffold ---
  var wallT     = 8
  var pillarW   = 10
  var pilInset  = (pillarW - wallT) / 2
  var roof_style = 3

  point House { x = 420, y = 470 }

  grid main {
    x: 1 @ wallT / 2  role structural,
       2 @ House.W / 2,
       3 @ House.W - wallT / 2  role structural
    y: A @ wallT / 2  role structural,
       B @ House.L / 2,
       C @ House.L - wallT / 2  role structural
  }

  // --- Control knobs a homeowner turns (a curated projection of the vars) ---
  configurator {
    slider pillarW    "Column size" ft [8 .. 14 step 1]
    select roof_style "Roof style" { Flat = 0, Shed = 1, Gable = 2, Hip = 3 }
  }

  // --- Plinth floor: base + terrain via the raw escape ---
  floor 0 "Plinth" {
    raw "ground" { "name": "Ground", "layer": "ground", "x": 0, "y": 0, "width": 600, "length": 700 }
    raw "plinth" {
      "name": "Plinth", "layer": "plinth", "x": 4, "y": 4, "width": 412, "length": 462, "height": 40,
      "formulas": { "x": "= main.x1", "y": "= main.yA", "width": "= main.x3 - main.x1", "length": "= main.yC - main.yA" }
    }
  }

  // --- Ground floor: slab + grid-placed rooms + corner pillars ---
  floor 1 "Ground Floor" {
    raw "floor_slab" {
      "x": 4, "y": 4, "width": 412, "length": 462,
      "formulas": { "x": "= main.x1", "y": "= main.yA", "width": "= main.x3 - main.x1", "length": "= main.yC - main.yA" }
    }

    room Living
      at   (main.x1, main.yA)
      size (main.x2 - main.x1, main.yB - main.yA) {
        wall north { window LivWinN at 55 size (55, 55) sill 35 }
        wall south { door  LivDoor  at 60 size (32, 80) }
      }

    room Kitchen
      at   (main.x2, main.yA)
      size (main.x3 - main.x2, main.yB - main.yA) {
        wall east { window KitWinE at 40 size (45, 45) sill 40 }
      }

    room Bedroom
      at   (main.x1, main.yB)
      size (main.x3 - main.x1, main.yC - main.yB) {
        wall west  { window BedWinW at 50 size (55, 55) sill 35 }
        wall south { door  BedDoor  at 70 size (32, 80) }
      }

    pillar C1 at (main.x1 + pilInset, main.yA + pilInset) size (pillarW, pillarW) height 116
    pillar C2 at (main.x3 - pilInset, main.yA + pilInset) size (pillarW, pillarW) height 116
  }

  // --- Loft floor: the hip roof (raw — nested segments/slope/trusses) ---
  floor 2 "Loft Floor" {
    raw "roof" {
      "roof_type": "pitched", "default_endpoint": "closed", "min_overhang": 25,
      "slope": { "by": "height", "ridge_h": 100 },
      "segments": [
        { "id": "seg0", "start": [210, 0], "end": [210, 470], "width": 420, "hip_setback_start": 90, "hip_setback_end": 90 }
      ],
      "trusses": [ { "segment_id": "seg0", "type": "fink", "positions_along": [95, 235, 375] } ]
    }
  }
}
