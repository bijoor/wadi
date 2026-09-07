// Furniture layout pack for the floor-planner's prebuilt room modules.
//
// Each `room <type>_<variant>` is a fully-furnished layout: contents only (walls stay
// graph-owned in the planner). A build step (floor-planner/scripts/build-room-layouts.mjs,
// `npm run build-layouts`) compiles this to floor-planner/src/export/roomLayouts.json.
//
// SIZE BANDS. The authored room `size (w, h)` is the layout's TARGET: the smallest room it
// was designed to fit without furniture overlapping. The planner reads the real room's size
// and picks the LARGEST layout of that type that still fits, then breaks ties by which
// arrangement conflicts least with the room's doors. So author several sizes per type — a
// small set for a tight room, a fuller set for a big one. All layouts here are verified
// overlap-free and in-bounds by floor-planner/scripts/check-room-layouts.mjs (the same C7
// footprint math the app uses). Units: per_unit 10, so 10 units = 1 foot (100 = 10 ft).
//
// Furniture is ANCHORED (no x/y), so it reflows to the real room. `anchor` picks the
// wall/corner (top=north, bottom=south, left=west, right=east); a `center` anchor floats the
// piece and its `gap (x, y)` is then a SIGNED offset from the room centre (+x east, +y
// south, negatives allowed) — that is how the "set" clusters (dining chairs around a table,
// a sofa group) hold their shape regardless of room size. For an edge/corner anchor, +gap
// pushes the piece inward off that wall. `rotation` yaws the piece (degrees).

import "std-furniture" as f

house RoomLayouts {
  units feet_inches per_unit 10
  site { plot (1800, 320) }

  floor 1 "Layouts" {
    // ===== Bedroom =====
    // Small: bed + wardrobe (11 x 12 ft).
    room bedroom_s at (0, 0) size (110, 120) {
      item f."bed_double" anchor top-center gap (0, 4)
      item f."wardrobe" anchor bottom-right gap (4, 4)
    }
    // Large: bed + a bedside table each side + wardrobe (13 x 13 ft). Bed on the NORTH wall.
    room bedroom_l at (0, 140) size (130, 130) {
      item f."bed_double" anchor top-center gap (0, 4)
      item f."bedside_table" anchor top-left gap (2, 4)
      item f."bedside_table" anchor top-right gap (2, 4)
      item f."wardrobe" anchor bottom-center gap (0, 4)
    }
    // Large, bed on the SOUTH wall — the picker takes this when a door sits on the north.
    room bedroom_lb at (140, 140) size (130, 130) {
      item f."bed_double" anchor bottom-center gap (0, 4) rotation 180
      item f."bedside_table" anchor bottom-left gap (2, 4)
      item f."bedside_table" anchor bottom-right gap (2, 4)
      item f."wardrobe" anchor top-center gap (0, 4)
    }

    // Extra-small: bed only, for a tight bedroom (a bed + wardrobe needs more room).
    room bedroom_xs at (1340, 0) size (90, 95) {
      item f."bed_double" anchor top-center gap (0, 4)
    }

    // ===== Dining =====
    // Small: table + two chairs, north/south (10 x 10 ft).
    room dining_s at (290, 0) size (100, 100) {
      item f."dining_table" anchor center
      item f."chair" anchor center gap (0, -30)
      item f."chair" anchor center gap (0, 30) rotation 180
    }
    // Large: table + a chair on each side (12 x 12 ft).
    room dining_l at (290, 140) size (120, 120) {
      item f."dining_table" anchor center
      item f."chair" anchor center gap (0, -30)
      item f."chair" anchor center gap (0, 30) rotation 180
      item f."chair" anchor center gap (-38, 0) rotation 90
      item f."chair" anchor center gap (38, 0) rotation 270
    }

    // ===== Living =====
    // Extra-small: sofa + tv only (10 x 10 ft).
    room living_xs at (1450, 0) size (100, 100) {
      item f."sofa" anchor bottom-center gap (0, 6) rotation 180
      item f."tv_unit" anchor top-center gap (0, 6)
    }
    // Small: sofa + coffee table + tv unit (12 x 12 ft).
    room living_s at (430, 0) size (120, 120) {
      item f."sofa" anchor bottom-center gap (0, 6) rotation 180
      item f."coffee_table" anchor center gap (0, 4)
      item f."tv_unit" anchor top-center gap (0, 6)
    }
    // Large: sofa + coffee table + two armchairs + tv unit (15 x 14 ft).
    room living_l at (430, 140) size (150, 140) {
      item f."sofa" anchor bottom-center gap (0, 6) rotation 180
      item f."coffee_table" anchor center gap (0, 8)
      item f."armchair" anchor center gap (-42, 0) rotation 30
      item f."armchair" anchor center gap (42, 0) rotation 330
      item f."tv_unit" anchor top-center gap (0, 6)
    }

    // ===== Study: desk with chair (10 x 10 ft) =====
    room study_a at (600, 0) size (100, 100) {
      item f."desk" anchor top-center gap (0, 6)
      item f."chair" anchor top-center gap (0, 28)
    }
    // Desk on the west wall — taken when a door sits on the north.
    room study_b at (600, 140) size (100, 100) {
      item f."desk" anchor center-left gap (6, 0) rotation 90
      item f."chair" anchor center
    }

    // ===== Kitchen: counter run + fridge (10 x 10 ft) =====
    room kitchen_a at (720, 0) size (100, 100) {
      item f."kitchen_cabinet" anchor top-left gap (4, 4)
      item f."stove" anchor top-center gap (0, 4)
      item f."kitchen_sink" anchor top-right gap (4, 4)
      item f."fridge" anchor center-right gap (4, 0)
    }
    room kitchen_b at (720, 140) size (100, 100) {
      item f."kitchen_cabinet" anchor top-right gap (4, 4)
      item f."stove" anchor center-right gap (4, 0)
      item f."kitchen_sink" anchor bottom-right gap (4, 4)
      item f."fridge" anchor bottom-left gap (4, 4)
    }

    // ===== Bathroom: basin, toilet, shower (10 x 10 ft) =====
    room bath_a at (840, 0) size (100, 100) {
      item f."bathroom_sink" anchor top-left gap (4, 4)
      item f."toilet" anchor bottom-left gap (4, 4)
      item f."shower" anchor bottom-right gap (4, 4)
    }
    room bath_b at (840, 140) size (100, 100) {
      item f."bathroom_sink" anchor top-right gap (4, 4)
      item f."toilet" anchor bottom-right gap (4, 4)
      item f."shower" anchor bottom-left gap (4, 4)
    }

    // ===== Balcony / terrace =====
    // These carry a low ROOM-LEVEL wall height, nothing else special. On export every room
    // walls all its sides at its own height, so the balcony's outward walls come out at this
    // parapet height while the room it opens off keeps the shared wall full height. Change the
    // height, or add more open-room types, right here — no code, no keyword.
    room balcony_a at (960, 0) size (140, 70) height 35 {
      item f."chair" anchor center gap (-20, 0)
      item f."chair" anchor center gap (20, 0) rotation 180
    }
    room terrace_a at (1120, 0) size (200, 200) height 30
  }
}
