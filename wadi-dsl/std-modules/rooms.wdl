// Furniture layout pack for the floor-planner's prebuilt room modules.
//
// Each `room <type>_<variant>` is a fully-furnished layout: contents only (walls stay
// graph-owned in the planner). A build step (floor-planner/scripts/build-room-layouts.mjs)
// compiles this to floor-planner/src/export/roomLayouts.json; the planner tries every
// layout of a room's type and keeps the one whose furniture conflicts least with the
// doors on that room. Add a layout by writing another `room <type>_<v> { … }`.
//
// The room size/position below is nominal — furniture is ANCHORED (no x/y), so it reflows
// to the real room. `anchor` picks the wall/corner (top=north, bottom=south, left=west,
// right=east); `gap (x, y)` is the inset from the wall; `rotation` yaws the piece.

import "std-furniture" as f

house RoomLayouts {
  units feet_inches per_unit 10
  site { plot (1400, 120) }

  floor 1 "Layouts" {
    // --- Bedroom ---
    room bedroom_a at (0, 0) size (100, 100) {
      item f."bed_double" anchor top-center gap (0, 8)
      item f."wardrobe" anchor center-left gap (6, 0) rotation 90
      item f."bedside_table" anchor top-left gap (6, 8)
    }
    room bedroom_b at (110, 0) size (100, 100) {
      item f."bed_double" anchor center-right gap (8, 0) rotation 90
      item f."wardrobe" anchor bottom-center gap (0, 6) rotation 180
      item f."bedside_table" anchor top-right gap (8, 8)
    }

    // --- Living ---
    room living_a at (220, 0) size (100, 100) {
      item f."sofa" anchor bottom-center gap (0, 8) rotation 180
      item f."coffee_table" anchor center gap (0, 6)
      item f."tv_unit" anchor top-center gap (0, 6)
    }
    room living_b at (330, 0) size (100, 100) {
      item f."sofa" anchor center-left gap (8, 0) rotation 90
      item f."coffee_table" anchor center gap (6, 0)
      item f."tv_unit" anchor center-right gap (6, 0) rotation 270
    }

    // --- Dining ---
    room dining_a at (440, 0) size (100, 100) {
      item f."dining_table" anchor center
    }

    // --- Kitchen ---
    room kitchen_a at (550, 0) size (100, 100) {
      item f."kitchen_cabinet" anchor top-left gap (4, 4)
      item f."stove" anchor top-center gap (0, 4)
      item f."kitchen_sink" anchor top-right gap (4, 4)
      item f."fridge" anchor center-right gap (4, 0)
    }
    room kitchen_b at (660, 0) size (100, 100) {
      item f."kitchen_cabinet" anchor top-right gap (4, 4)
      item f."stove" anchor center-right gap (4, 0)
      item f."kitchen_sink" anchor bottom-right gap (4, 4)
      item f."fridge" anchor bottom-left gap (4, 4)
    }

    // --- Bathroom ---
    room bath_a at (770, 0) size (100, 100) {
      item f."toilet" anchor bottom-left gap (4, 4)
      item f."bathroom_sink" anchor top-left gap (4, 4)
      item f."shower" anchor bottom-right gap (4, 4)
    }
    room bath_b at (880, 0) size (100, 100) {
      item f."toilet" anchor bottom-right gap (4, 4)
      item f."bathroom_sink" anchor top-right gap (4, 4)
      item f."shower" anchor bottom-left gap (4, 4)
    }

    // --- Study ---
    room study_a at (990, 0) size (100, 100) {
      item f."desk" anchor top-center gap (0, 6)
    }
    room study_b at (1100, 0) size (100, 100) {
      item f."desk" anchor center-right gap (6, 0) rotation 270
    }
  }
}
