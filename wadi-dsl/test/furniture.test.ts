// The `furniture` CONTAINER (plans/room-templates-in-wadi.md, Part 2): a room's
// tool-managed furniture region. Header metadata (`auto` + its layout source
// `type <type>` / `room <ref>` + `locked`) round-trips through the DSL, and the item
// body flattens at expand time exactly like a room's nested `items` (no geometry of
// its own). This tests compile -> emit -> compile and the expand flattening.

import { describe, it, expect } from "vitest";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { emitWdl } from "../src/generator/fromHouseConfig.js";
import { expandRoomWalls } from "../../editor/src/svg2d/expand";

const SRC = `house Furn {
  convention center
  units feet_inches per_unit 10
  site { plot (500, 500) }
  defaults { floor_height 120 wall_height 108 slab_thickness 8 wall_thickness 8 }
  floor 1 "Ground" slab_thickness 0 {
    room Master at (4, 4) size (200, 240) type bedroom {
      wall east west north south
      furniture auto type bedroom locked {
        item asset { id "bed" src "b.glb" dims (1.5, 1, 2) } anchor top-center gap (0, 4)
      }
    }
    room Guest at (220, 4) size (150, 150) type bedroom {
      furniture auto room Master
    }
    room Study at (4, 260) size (120, 120) {
      furniture auto room rooms."study_l"
    }
    room Plain at (140, 260) size (100, 100) {
      furniture {
        item asset { id "chair" src "c.glb" dims (0.5, 1, 0.5) } anchor center
      }
    }
  }
}`;

function rooms(cfg: Record<string, unknown>): Record<string, unknown>[] {
  const floors = (cfg.floors as Array<{ objects?: Record<string, unknown>[] }>) ?? [];
  return floors.flatMap((f) => f.objects ?? []).filter((o) => o.type === "room");
}
const byName = (cfg: Record<string, unknown>, n: string) => rooms(cfg).find((r) => r.name === n) as Record<string, unknown>;

describe("furniture container — compile", () => {
  const cfg = compileDsl(SRC);
  it("carries auto + type + locked + the item body", () => {
    const f = byName(cfg, "Master").furniture as Record<string, unknown>;
    expect(f.auto).toBe(true);
    expect(f.auto_type).toBe("bedroom");
    expect(f.locked).toBe(true);
    expect((f.items as unknown[]).length).toBe(1);
    expect((f.items as Record<string, unknown>[])[0].anchor).toBe("top-center");
  });
  it("a sibling-room source resolves to a plain room name", () => {
    const f = byName(cfg, "Guest").furniture as Record<string, unknown>;
    expect(f.auto).toBe(true);
    expect(f.auto_room).toBe("Master");
    expect(f.auto_room_module).toBeUndefined();
  });
  it("a module-qualified source splits into module + id", () => {
    const f = byName(cfg, "Study").furniture as Record<string, unknown>;
    expect(f.auto_room).toBe("study_l");
    expect(f.auto_room_module).toBe("rooms");
  });
  it("a plain (non-auto) block has no auto flag", () => {
    const f = byName(cfg, "Plain").furniture as Record<string, unknown>;
    expect(f.auto).toBeUndefined();
    expect((f.items as unknown[]).length).toBe(1);
  });
});

describe("furniture container — emit round-trips", () => {
  it("emits each header form and survives a re-compile", () => {
    const wdl = emitWdl(compileDsl(SRC));
    expect(wdl).toMatch(/furniture auto type bedroom locked \{/);
    expect(wdl).toMatch(/furniture auto room Master/);
    expect(wdl).toMatch(/furniture auto room rooms\.study_l/);
    const cfg2 = compileDsl(wdl);
    expect((byName(cfg2, "Master").furniture as Record<string, unknown>).auto_type).toBe("bedroom");
    expect((byName(cfg2, "Guest").furniture as Record<string, unknown>).auto_room).toBe("Master");
    expect((byName(cfg2, "Study").furniture as Record<string, unknown>).auto_room_module).toBe("rooms");
  });
});

describe("furniture container — expand flattens the body", () => {
  it("flattens furniture items to top-level anchored items and strips the block", () => {
    const expanded = expandRoomWalls(compileDsl(SRC)) as { floors: Array<{ objects: Record<string, unknown>[] }> };
    const objs = expanded.floors.flatMap((f) => f.objects);
    // the bed (Master) and the chair (Plain) both become top-level `item`s
    const items = objs.filter((o) => o.type === "item");
    const ids = items.map((o) => (o.asset as { id?: string })?.id);
    expect(ids).toContain("bed");
    expect(ids).toContain("chair");
    // the furniture block + its items are stripped from the expanded room
    const master = objs.find((o) => o.type === "room" && o.name === "Master") as Record<string, unknown>;
    expect(master.furniture).toBeUndefined();
    expect(master.items).toBeUndefined();
  });
});
