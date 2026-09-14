// The room-layout loader (editor/src/furniture/roomLayouts.ts): a compiled + resolved
// layout pack -> Layout[] for the placement engine. Tested against a small self-contained
// pack (inline assets, no std-furniture import) that exercises the native `type`, the
// `<type>_<variant>` id fallback, the furniture-container vs plain-items bodies, and the
// negative-gap-as-formula case.

import { describe, it, expect } from "vitest";
import { compileDsl } from "../../../wadi-dsl/src/generator/toHouseConfig";
import { resolveParametric } from "../param/resolve";
import { configToLayouts, roomTypeOf } from "./roomLayouts";

const PACK = `house Mini {
  units feet_inches per_unit 10
  site { plot (500, 500) }
  floor 1 "Layouts" {
    room bedroom_s at (0, 0) size (110, 120) {
      item asset { id "bed" src "b.glb" dims (1.5, 1, 2) } anchor top-center gap (0, 4)
      item asset { id "wardrobe" src "w.glb" dims (1, 1, 0.6) } anchor bottom-right gap (4, 4)
    }
    room living_grand at (0, 140) size (160, 160) type living {
      furniture {
        item asset { id "sofa" src "s.glb" dims (2, 1, 1) } anchor bottom-center gap (0, -6)
      }
    }
  }
}`;

const layouts = configToLayouts(resolveParametric(compileDsl(PACK)).config as never);
const byId = (id: string) => layouts.find((l) => l.id === id)!;

describe("roomTypeOf", () => {
  it("prefers the native room_type, else strips the id's _<variant>", () => {
    expect(roomTypeOf({ name: "bedroom_s" })).toBe("bedroom");
    expect(roomTypeOf({ name: "dining_lb" })).toBe("dining");
    expect(roomTypeOf({ name: "study_l", room_type: "office" })).toBe("office"); // native wins
    expect(roomTypeOf({ name: "kitchen" })).toBe("kitchen"); // no variant suffix
  });
});

describe("configToLayouts", () => {
  it("loads every template room as a Layout with target size {w,l}", () => {
    expect(layouts).toHaveLength(2);
    const bed = byId("bedroom_s");
    expect(bed.type).toBe("bedroom"); // id-parsed
    expect([bed.w, bed.l]).toEqual([110, 120]);
    expect(bed.pieces).toHaveLength(2);
  });

  it("reads the room CATEGORY from a native `type` when present", () => {
    expect(byId("living_grand").type).toBe("living");
  });

  it("takes pieces from the furniture CONTAINER body as well as plain items", () => {
    expect(byId("living_grand").pieces.map((p) => p.asset.id)).toEqual(["sofa"]);
  });

  it("maps anchor / gaps / asset dimensions onto each piece", () => {
    const bed = byId("bedroom_s").pieces[0];
    expect(bed.asset.id).toBe("bed");
    expect(bed.asset.dimensions).toEqual([1.5, 1, 2]);
    expect(bed.anchor).toBe("top-center");
    expect(bed.gap_y).toBe(4);
  });

  it("honours a NEGATIVE gap (stored as a constant formula) instead of collapsing it to 0", () => {
    const sofa = byId("living_grand").pieces[0];
    expect(sofa.gap_y).toBe(-6);
  });
});
