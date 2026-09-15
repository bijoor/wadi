// Furniture layout pack for the floor-planner's prebuilt room modules.
//
// Each `room <type>_<variant>` is a fully-furnished layout: contents only (walls stay
// graph-owned in the planner). The app compiles this pack in the browser
// (editor/src/furniture/loadRoomLayouts.ts -> configToLayouts) into the placement
// engine's Layout[]; the LARGEST layout of a room's `type` that still fits is chosen.
//
// ROOM TYPE. Every template declares its category with an explicit `type <type>` (the
// native room keyword). The loader keys layouts on that type and matches it against a
// room's own `type` (or a `furniture auto type <type>`) by exact string. The id
// convention `<type>_<variant>` is kept only for readability + a legacy fallback; the
// `type` keyword is now the source of truth.
//
// SIZE BANDS. The authored room `size (w, h)` is the layout's TARGET: the smallest room it
// was designed to fit without furniture overlapping. The planner reads the real room's size
// and picks the LARGEST layout of that type that still fits, then breaks ties by which
// arrangement conflicts least with the room's doors. So author several sizes per type — a
// small set for a tight room, a fuller set for a big one. Units: per_unit 10, so 10 units =
// 1 foot (100 = 10 ft).
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
  site { plot (2100, 520) }

  floor 1 "Layouts" {
    // ===== Bedroom =====
    // Small: bed + wardrobe (11 x 12 ft).
    room bedroom_s at (0, 0) size (110, 120) type bedroom {
      item f."bed_double" anchor top-center gap (0, 4)
      item f."wardrobe" anchor bottom-right gap (4, 4)
    }
    // Large: bed + a bedside table each side + wardrobe (13 x 13 ft). Bed on the NORTH wall.
    room bedroom_l at (0, 140) size (130, 130) type bedroom {
      item f."bed_double" anchor top-center gap (0, 4)
      item f."bedside_table" anchor top-left gap (2, 4)
      item f."bedside_table" anchor top-right gap (2, 4)
      item f."wardrobe" anchor bottom-center gap (0, 4)
    }
    // Large, bed on the SOUTH wall — the picker takes this when a door sits on the north.
    room bedroom_lb at (140, 140) size (130, 130) type bedroom {
      item f."bed_double" anchor bottom-center gap (0, 4) rotation 180
      item f."bedside_table" anchor bottom-left gap (2, 4)
      item f."bedside_table" anchor bottom-right gap (2, 4)
      item f."wardrobe" anchor top-center gap (0, 4)
    }

    // Extra-small: bed only, for a tight bedroom (a bed + wardrobe needs more room).
    room bedroom_xs at (1340, 0) size (68, 88) type bedroom {
      item f."bed_single" anchor center-left rotation 0
      item f."cabinet_wide" anchor center-right
    }

    // ===== Dining =====
    // Extra-small: just the table, for a small dining nook (chairs need more room).
    room dining_xs at (1560, 0) size (66, 48) type dining {
      item f."dining_table" anchor center
    }
    // Small: table + two chairs, north/south (10 x 10 ft).
    room dining_s at (290, 0) size (100, 100) type dining {
      item f."dining_table" anchor center
      item f."chair" anchor center gap (0, -30)
      item f."chair" anchor center gap (0, 30) rotation 180
    }
    // Large: table + a chair on each side (12 x 12 ft).
    room dining_l at (290, 140) size (120, 120) type dining {
      item f."dining_table" anchor center
      item f."chair" anchor center gap (0, -30)
      item f."chair" anchor center gap (0, 30) rotation 180
      item f."chair" anchor center gap (-38, 0) rotation 90
      item f."chair" anchor center gap (38, 0) rotation 270
    }

    // ===== Living =====
    // Extra-small: sofa + tv only.
    room living_xs at (1450, 0) size (95, 90) type living {
      item f."sofa" anchor bottom-center gap (0, 6)
      item f."armchair" anchor top-right rotation 315
      item f."armchair" anchor top-left rotation 45
    }
    // Small: sofa + coffee table + tv unit (12 x 12 ft).
    room living_s at (430, 0) size (120, 120) type living {
      item f."sofa" anchor bottom-center gap (0, 6) rotation 180
      item f."coffee_table" anchor center gap (0, 4)
      item f."tv_unit" anchor top-center gap (0, 6)
    }
    // Large: sofa + coffee table + two armchairs + tv unit (15 x 14 ft).
    room living_l at (430, 140) size (150, 140) type living {
      item f."sofa" anchor bottom-center gap (0, 6) rotation 180
      item f."coffee_table" anchor center gap (0, 8)
      item f."armchair" anchor center gap (-42, 0) rotation 30
      item f."armchair" anchor center gap (42, 0) rotation 330
      item f."tv_unit" anchor top-center gap (0, 6)
    }

    // ===== Study: desk with chair (10 x 10 ft) =====
    room study_a at (600, 0) size (100, 100) type study {
      item f."desk" anchor top-center gap (0, 6)
      item f."chair" anchor top-center gap (0, 28)
    }
    // Desk on the west wall — taken when a door sits on the north.
    room study_b at (600, 140) size (100, 100) type study {
      item f."desk" anchor center-left gap (6, 0) rotation 90
      item f."chair" anchor center
    }

    // ===== Kitchen: counter run + fridge (10 x 10 ft) =====
    // Extra-small: a single counter run (cabinet + stove + sink), no fridge.
    room kitchen_xs at (1660, 0) size (78, 46) type kitchen {
      item f."kitchen_cabinet" anchor top-left gap (2, 4)
      item f."stove" anchor top-center gap (0, 4)
      item f."kitchen_sink" anchor top-right gap (2, 4)
    }
    room kitchen_a at (720, 0) size (100, 100) type kitchen {
      item f."kitchen_cabinet" anchor top-left gap (4, 4)
      item f."stove" anchor top-center gap (0, 4)
      item f."kitchen_sink" anchor top-right gap (4, 4)
      item f."fridge" anchor center-right gap (4, 0)
    }
    room kitchen_b at (720, 140) size (100, 100) type kitchen {
      item f."kitchen_cabinet" anchor top-right gap (4, 4)
      item f."stove" anchor center-right gap (4, 0)
      item f."kitchen_sink" anchor bottom-right gap (4, 4)
      item f."fridge" anchor bottom-left gap (4, 4)
    }

    // ===== Bathroom: basin, toilet, shower (10 x 10 ft) =====
    // Extra-small: sink + toilet only, for a small WC (a shower needs more depth).
    room bath_xs at (1760, 0) size (66, 40) type bath {
      item f."bathroom_sink" anchor top-left gap (4, 4)
      item f."toilet" anchor top-right gap (4, 0)
    }
    room bath_a at (840, 0) size (100, 100) type bath {
      item f."bathroom_sink" anchor top-left gap (4, 4)
      item f."toilet" anchor bottom-left gap (4, 4)
      item f."shower" anchor bottom-right gap (4, 4)
    }
    room bath_b at (840, 140) size (100, 100) type bath {
      item f."bathroom_sink" anchor top-right gap (4, 4)
      item f."toilet" anchor bottom-right gap (4, 4)
      item f."shower" anchor bottom-left gap (4, 4)
    }

    // ===== Compact + extra layouts (B: cover the small end + add variety) =====
    // Orientation is handled by the planner (a portrait layout rotates to fill a landscape
    // room), so each of these is authored in ONE orientation only.

    // Bedroom, narrow: a single bed for a tight/narrow room a double bed can't fit.
    room bedroom_single at (300, 290) size (48, 82) type bedroom {
      item f."bed_single" anchor top-center gap (0, 4)
    }
    // Bedroom, mid: bed + a bedside table each side, no wardrobe (between xs and s).
    room bedroom_m at (380, 290) size (108, 90) type bedroom {
      item f."bed_double" anchor top-center gap (0, 4)
      item f."bedside_table" anchor top-left gap (2, 4)
      item f."bedside_table" anchor top-right gap (2, 4)
    }

    // Study, extra-small: desk + chair (desk_a/b are 10x10; this fits a ~6.5 ft nook).
    room study_xs at (0, 290) size (66, 66) type study {
      item f."desk" anchor top-center gap (0, 6)
      item f."desk_chair" anchor top-center gap (0, 30)
    }
    // Study, large: corner desk + chair + bookcase.
    room study_l at (520, 290) size (120, 120) type study {
      item f."desk_corner" anchor top-left gap (6, 6)
      item f."desk_chair" anchor center gap (14, 14)
      item f."bookcase" anchor bottom-center gap (0, 4)
    }

    // Kitchen, compact: cabinet + sink only (no stove), a narrower counter than kitchen_xs.
    room kitchen_compact at (100, 290) size (66, 46) type kitchen {
      item f."kitchen_cabinet" anchor top-left gap (4, 4)
      item f."kitchen_sink" anchor top-right gap (4, 4)
    }
    // Kitchen, large L: counter run on the north + fridge and a cabinet down the east wall.
    room kitchen_l at (680, 290) size (120, 112) type kitchen {
      item f."kitchen_cabinet" anchor top-left gap (6, 4)
      item f."stove" anchor top-center gap (0, 4)
      item f."kitchen_sink" anchor top-right gap (6, 4)
      item f."fridge" anchor center-right gap (4, 8)
      item f."kitchen_cabinet" anchor bottom-right gap (6, 6)
    }

    // Bath, minimal WC: washbasin + toilet, no shower (a 2-piece for a small bathroom).
    room bath_wc at (200, 290) size (60, 46) type bath {
      item f."bathroom_sink" anchor top-left gap (4, 4)
      item f."toilet" anchor top-right gap (4, 4)
    }

    // Dining, nook: a round table only, for a small square dining a rectangular table can't fit.
    room dining_nook at (1120, 290) size (54, 54) type dining {
      item f."round_table" anchor center
    }
    // Dining, round: a round table with four chairs (a compact square dining).
    room dining_round at (840, 290) size (92, 92) type dining {
      item f."round_table" anchor center
      item f."chair" anchor center gap (0, -28)
      item f."chair" anchor center gap (0, 28) rotation 180
      item f."chair" anchor center gap (-28, 0) rotation 90
      item f."chair" anchor center gap (28, 0) rotation 270
    }

    // Living, mid: sofa + coffee table + one armchair + tv (between small and large).
    room living_m at (980, 290) size (134, 128) type living {
      item f."sofa" anchor bottom-center gap (0, 6) rotation 180
      item f."coffee_table" anchor center gap (0, 6)
      item f."armchair" anchor center gap (-38, 0) rotation 30
      item f."tv_unit" anchor top-center gap (0, 6)
    }

    // ===== Balcony / terrace =====
    // These carry a low ROOM-LEVEL wall height, nothing else special. On export every room
    // walls all its sides at its own height, so the balcony's outward walls come out at this
    // parapet height while the room it opens off keeps the shared wall full height. Change the
    // height, or add more open-room types, right here — no code, no keyword.
    room balcony_a at (960, 0) size (40, 70) type balcony height 35
    room terrace_a at (1120, 0) size (20, 20) type terrace height 30
  }
}
