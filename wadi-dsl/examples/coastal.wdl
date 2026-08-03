// A coastal Konkan cottage, authored entirely in the Wadi DSL.
// `tsx src/cli/main.ts examples/coastal.wdl` compiles it to a .wadi that the
// real Wadi pipeline validates + resolves + renders. This one file exercises
// the parametric core (var/point/grid/formula/configurator) and the domain
// vocabulary — every primitive is FIRST-CLASS (ground, plinth, slab, room,
// wall, opening, pillar, roof), no `raw` needed.

house CoastalCottage {
  convention center
  units feet_inches per_unit 10

  site { plot (600, 700) ref (0, 0) }
  defaults { floor_height 116 wall_height 108 slab_thickness 8 wall_thickness 8 }  // floor_height = wall_height + slab_thickness (C4)

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

  // --- Plinth floor: terrain + raised base ---
  floor 0 "Plinth" height 40 {                 // floor height == plinth height (C1)
    ground name "Ground" at (0, 0) size (600, 700) layer "ground"
    plinth name "Plinth"
      at (main.x1, main.yA) size (main.x3 - main.x1, main.yC - main.yA)
      height 40 layer "plinth"
  }

  // --- Ground floor: slab + grid-placed rooms + corner pillars ---
  floor 1 "Ground Floor" {
    slab at (main.x1, main.yA) size (main.x3 - main.x1, main.yC - main.yA)

    room Living
      at   (main.x1, main.yA)
      size (main.x2 - main.x1, main.yB - main.yA) {
        wall west                                     // exterior side (C2)
        wall north { window LivWinN at 55 size (55, 55) sill 35 }
        wall south { door  LivDoor  at 60 size (32, 80) }
      }

    room Kitchen
      at   (main.x2, main.yA)
      size (main.x3 - main.x2, main.yB - main.yA) {
        wall north                                    // exterior side (C2)
        wall east { window KitWinE at 40 size (45, 45) sill 40 }
      }

    room Bedroom
      at   (main.x1, main.yB)
      size (main.x3 - main.x1, main.yC - main.yB) {
        wall east                                     // exterior side (C2)
        wall west  { window BedWinW at 50 size (55, 55) sill 35 }
        wall south { door  BedDoor  at 70 size (32, 80) }
      }

    // A pillar's `at` is its TOP-LEFT corner — to centre a column on a grid node,
    // subtract half its width (perimeter columns also inset by pilInset).
    pillar C1 at (main.x1 + pilInset - pillarW/2, main.yA + pilInset - pillarW/2) size (pillarW, pillarW) height 116
    pillar C2 at (main.x3 - pillarW/2,            main.yA + pilInset - pillarW/2) size (pillarW, pillarW) height 116
  }

  // --- Loft floor: the hip roof (first-class — nested segments/slope/trusses) ---
  floor 2 "Loft Floor" {
    roof name "Hip Roof" pitched endpoint closed slope height 100 overhang 25 {
      segment "seg0" from (210, 0) to (210, 470) width 420 hip_setback (90, 90)
      truss "seg0" fink at (95, 235, 375)
    }
  }
}
