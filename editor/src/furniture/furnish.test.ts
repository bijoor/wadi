// End-to-end: furnishRoom (editor/src/furniture/furnish.ts) runs the placement engine for a
// real room and materialises the result into its `furniture` container — the RE-CONFIGURE
// step. Exercises the native-type source, a locked block (skipped) and locked item (kept),
// and the sibling-room clone. Uses compiled WDL for both the house and the layout pack.

import { describe, it, expect } from "vitest";
import { compileDsl } from "../../../wadi-dsl/src/generator/toHouseConfig";
import { resolveParametric } from "../param/resolve";
import { configToLayouts } from "./roomLayouts";
import { furnishRoom } from "./furnish";

const PACK = `house Pack {
  units feet_inches per_unit 10
  site { plot (500, 500) }
  floor 1 "L" {
    room bedroom_s at (0, 0) size (110, 120) {
      item asset { id "bed" src "b.glb" dims (1.5, 1, 2) } anchor top-center gap (0, 4)
      item asset { id "table" src "t.glb" dims (0.5, 1, 0.5) } anchor center
    }
  }
}`;
const LAYOUTS = configToLayouts(resolveParametric(compileDsl(PACK)).config as never);

const HOUSE = `house H {
  convention center
  units feet_inches per_unit 10
  site { plot (600, 400) }
  defaults { floor_height 120 wall_height 108 slab_thickness 8 wall_thickness 8 }
  floor 1 "Ground" slab_thickness 0 {
    room Master at (0, 0) size (200, 160) type bedroom {
      wall east west south
      wall north { door D at 80 size (40, 84) }
      furniture auto
    }
    room Guest at (220, 0) size (200, 160) {
      furniture auto room Master
    }
  }
}`;

type Obj = Record<string, unknown>;
const roomIn = (cfg: Record<string, unknown>, name: string): Obj =>
  ((cfg.floors as Array<{ objects?: Obj[] }>)[0].objects ?? []).find((o) => o.type === "room" && o.name === name)!;
const furnItems = (cfg: Record<string, unknown>, name: string): Obj[] =>
  ((roomIn(cfg, name).furniture as { items?: Obj[] } | undefined)?.items ?? []);

describe("furnishRoom — native type source", () => {
  it("furnishes from the room's own `type` and materialises into the block", () => {
    const { config, result } = furnishRoom(compileDsl(HOUSE) as never, 1, "Master", LAYOUTS);
    expect(result.furnished).toBe(true);
    expect(result.template).toBe("bedroom_s");
    const items = furnItems(config, "Master");
    // the centre table always survives; the bed is shifted/kept or dropped for the door
    expect(items.map((i) => (i.asset as { id?: string }).id)).toContain("table");
    expect((roomIn(config, "Master").furniture as Obj).auto).toBe(true);
  });
});

describe("furnishRoom — locked", () => {
  it("skips a locked block untouched", () => {
    const src = HOUSE.replace("furniture auto\n", "furniture auto locked { }\n");
    const cfg = compileDsl(src);
    const before = JSON.stringify(roomIn(cfg as never, "Master").furniture ?? null);
    const { config, result } = furnishRoom(cfg as never, 1, "Master", LAYOUTS);
    expect(result.furnished).toBe(false);
    expect(result.reason).toBe("locked");
    expect(JSON.stringify(roomIn(config, "Master").furniture ?? null)).toBe(before);
  });

  it("keeps a locked item when regenerating the (unlocked) block", () => {
    const src = HOUSE.replace(
      "furniture auto\n",
      `furniture auto { item name "keep" asset { id "lamp" src "l.glb" dims (0.3, 1, 0.3) } anchor center gap (50, 50) locked }\n`,
    );
    const { config, result } = furnishRoom(compileDsl(src) as never, 1, "Master", LAYOUTS);
    expect(result.furnished).toBe(true);
    const ids = furnItems(config, "Master").map((i) => (i.asset as { id?: string }).id);
    expect(ids).toContain("lamp"); // the locked item survived the regeneration
    expect(ids).toContain("table"); // engine output added alongside it
  });
});

describe("furnishRoom — nothing fits", () => {
  // A bedroom smaller than the only layout (bedroom_s 110x120) has no fitting template.
  const tiny = (body: string) => `house H {
    convention center
    units feet_inches per_unit 10
    site { plot (300, 300) }
    defaults { floor_height 120 wall_height 108 slab_thickness 8 wall_thickness 8 }
    floor 1 "Ground" slab_thickness 0 {
      room Tiny at (0, 0) size (40, 40) type bedroom {
        wall north east south west
        ${body}
      }
    }
  }`;

  it("clears the engine-managed items when nothing fits, keeping locked ones", () => {
    const src = tiny(`furniture auto {
      item name "old" asset { id "chair" src "c.glb" dims (0.5, 1, 0.5) } anchor center
      item name "pin" asset { id "lamp" src "l.glb" dims (0.3, 1, 0.3) } anchor top-left locked
    }`);
    const { config, result } = furnishRoom(compileDsl(src) as never, 1, "Tiny", LAYOUTS);
    expect(result.furnished).toBe(true);
    expect(result.template).toBe(null);
    const ids = furnItems(config, "Tiny").map((i) => (i.asset as { id?: string }).id);
    expect(ids).toEqual(["lamp"]); // the stray "chair" is cleared; the locked "lamp" stays
  });

  it("reports not-furnished when there is nothing to clear", () => {
    const { result } = furnishRoom(compileDsl(tiny("furniture auto")) as never, 1, "Tiny", LAYOUTS);
    expect(result.furnished).toBe(false);
    expect(result.reason).toBe("no-layout");
  });
});

describe("furnishRoom — a shared-wall door owned by the neighbour", () => {
  // Attic sits directly NORTH of Main and declares a door on the shared wall (its south wall =
  // Main's north wall). Main's bed is authored top-center → it would land on that door. The
  // furnish must SEE the neighbour-owned door (not just Main's own openings) and move furniture
  // off it — the reported "furniture overlaps the door, no error" bug.
  const mk = (southWall) => `house H {
    convention center
    units feet_inches per_unit 10
    site { plot (400, 400) }
    defaults { floor_height 120 wall_height 108 slab_thickness 8 wall_thickness 8 }
    floor 1 "Ground" slab_thickness 0 {
      room Attic at (0, 0) size (200, 100) {
        wall north east west
        ${southWall}
      }
      room Main at (0, 100) size (200, 160) type bedroom {
        wall south east west
        furniture auto
      }
    }
  }`;
  it("moves furniture off a door the adjacent room declares on the shared wall", () => {
    const withDoor = furnishRoom(compileDsl(mk("wall south { door D at 80 size (40, 84) }")) as never, 1, "Main", LAYOUTS).config;
    const noDoor = furnishRoom(compileDsl(mk("wall south")) as never, 1, "Main", LAYOUTS).config;
    // With no shared-wall door the bed sits at its authored top-center spot; the neighbour's
    // door changes the placement (a shift, a rotation, or a drop). Before the fix the two were
    // identical because the neighbour's door was invisible to Main's furnish.
    expect(JSON.stringify(furnItems(withDoor, "Main"))).not.toBe(JSON.stringify(furnItems(noDoor, "Main")));
  });
});

describe("furnishRoom — clone a sibling room", () => {
  it("reuses a furnished sibling's arrangement, re-fitted to this room", () => {
    // furnish Master first, then Guest clones Master's (now materialised) furniture
    const step1 = furnishRoom(compileDsl(HOUSE) as never, 1, "Master", LAYOUTS);
    const step2 = furnishRoom(step1.config, 1, "Guest", LAYOUTS);
    expect(step2.result.furnished).toBe(true);
    const guestIds = furnItems(step2.config, "Guest").map((i) => (i.asset as { id?: string }).id);
    const masterIds = furnItems(step1.config, "Master").map((i) => (i.asset as { id?: string }).id);
    // Guest (no doors) keeps every piece Master ended up with
    expect(new Set(guestIds)).toEqual(new Set(masterIds));
  });
});
