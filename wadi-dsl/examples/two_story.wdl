// Multi-floor, grid-driven: a Plinth floor, two occupied floors, and a hip roof.
// Everything is first-class now — ground, plinth, slab, staircase, and roof are
// real entities with parameters (no `raw`). Widen it by editing `point House`.
house TwoStory {
  convention center
  units feet_inches per_unit 10

  site { plot (500, 500) ref (0, 0) }
  defaults { floor_height 120 wall_height 108 slab_thickness 8 wall_thickness 8 }

  var wallT = 8
  point House { x = 352, y = 352 }
  grid main {
    x: 1 @ wallT / 2, 2 @ House.W / 2, 3 @ House.W - wallT / 2
    y: A @ wallT / 2, B @ House.L / 2, C @ House.L - wallT / 2
  }

  floor 0 "Plinth" {
    ground name "Ground" at (0, 0) size (500, 500) layer "ground"
    plinth name "Plinth"
      at (main.x1, main.yA) size (main.x3 - main.x1, main.yC - main.yA)
      height 40 layer "plinth"
  }

  floor 1 "Ground Floor" {
    slab at (main.x1, main.yA) size (main.x3 - main.x1, main.yC - main.yA)
    room Hall at (main.x1, main.yA) size (main.x3 - main.x1, main.yB - main.yA) {
      wall south { door Main at 120 size (36, 84) }
    }
    room Kitchen at (main.x1, main.yB) size (main.x2 - main.x1, main.yC - main.yB) {
      wall west { window KW at 40 size (45, 45) sill 40 }
    }
    room Bath at (main.x2, main.yB) size (main.x3 - main.x2, main.yC - main.yB) {
      wall east { window BW at 30 size (40, 40) sill 45 }
    }
  }

  floor 2 "First Floor" {
    slab at (main.x1, main.yA) size (main.x3 - main.x1, main.yC - main.yA)
    room Bedroom1 at (main.x1, main.yA) size (main.x2 - main.x1, main.yC - main.yA) {
      wall west { window B1 at 60 size (55, 50) sill 35 }
    }
    room Bedroom2 at (main.x2, main.yA) size (main.x3 - main.x2, main.yC - main.yA) {
      wall east { window B2 at 60 size (55, 50) sill 35 }
    }
    staircase name "Stair" at (300, 60) step (7, 10, 36) direction south
  }

  floor 3 "Loft Floor" {
    roof name "Hip Roof" pitched endpoint closed slope height 100 overhang 25 {
      segment "seg0" from (176, 0) to (176, 352) width 352 hip_setback (80, 80) tie_beams 3
      truss "seg0" fink at (80, 176, 272)
    }
  }
}
