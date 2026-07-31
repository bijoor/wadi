// Multi-floor, grid-driven: a Plinth floor, two occupied floors, and a hip roof.
// Shows floors stacking (array order = vertical stack) + a staircase and roof via
// the `raw` escape. Widen it by editing `point House`.
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
    raw "ground" { "name": "Ground", "layer": "ground", "x": 0, "y": 0, "width": 500, "length": 500 }
    raw "plinth" {
      "name": "Plinth", "layer": "plinth", "x": 4, "y": 4, "width": 352, "length": 352, "height": 40,
      "formulas": { "x": "= main.x1", "y": "= main.yA", "width": "= main.x3 - main.x1", "length": "= main.yC - main.yA" }
    }
  }

  floor 1 "Ground Floor" {
    raw "floor_slab" {
      "x": 4, "y": 4, "width": 352, "length": 352,
      "formulas": { "x": "= main.x1", "y": "= main.yA", "width": "= main.x3 - main.x1", "length": "= main.yC - main.yA" }
    }
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
    raw "floor_slab" {
      "x": 4, "y": 4, "width": 352, "length": 352,
      "formulas": { "x": "= main.x1", "y": "= main.yA", "width": "= main.x3 - main.x1", "length": "= main.yC - main.yA" }
    }
    room Bedroom1 at (main.x1, main.yA) size (main.x2 - main.x1, main.yC - main.yA) {
      wall west { window B1 at 60 size (55, 50) sill 35 }
    }
    room Bedroom2 at (main.x2, main.yA) size (main.x3 - main.x2, main.yC - main.yA) {
      wall east { window B2 at 60 size (55, 50) sill 35 }
    }
    raw "staircase" {
      "name": "Stair", "start_x": 300, "start_y": 60,
      "step_rise": 7, "step_tread": 10, "step_width": 36, "direction": "south"
    }
  }

  floor 3 "Loft Floor" {
    raw "roof" {
      "roof_type": "pitched", "default_endpoint": "closed", "min_overhang": 25,
      "slope": { "by": "height", "ridge_h": 100 },
      "segments": [ { "id": "seg0", "start": [176, 0], "end": [176, 352], "width": 352, "hip_setback_start": 80, "hip_setback_end": 80 } ],
      "trusses": [ { "segment_id": "seg0", "type": "fink", "positions_along": [80, 176, 272] } ]
    }
  }
}
