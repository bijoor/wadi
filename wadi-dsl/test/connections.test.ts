// Phase 0: room `connect` <-> `room.connections` round-trip.
// A connection is design intent + a functional test, not geometry — this only
// checks that the field compiles, de-dupes, and survives emit -> compile.
// `connect A B` is a space-separated line INSIDE the room block.

import { describe, it, expect } from "vitest";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { emitWdl } from "../src/generator/fromHouseConfig.js";
import { resolveParametric } from "../../editor/src/param/resolve";
import { expandRoomWalls } from "../../editor/src/svg2d/expand";

const SRC = `house Test {
  convention center
  units feet_inches per_unit 10
  floor 1 "Ground" {
    room Living at (0, 0) size (100, 90) {
      connect Kitchen Hall
      wall north south east west
    }
    room Kitchen at (100, 0) size (80, 60) {
      connect Living
      wall north south east west
    }
    room Hall at (100, 60) size (80, 90) {
      wall north south east west
    }
  }
}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rooms = (cfg: any) => cfg.floors[0].objects.filter((o: any) => o.type === "room");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const byName = (cfg: any, n: string) => rooms(cfg).find((r: any) => r.name === n);

describe("room connections (Phase 0)", () => {
  it("compiles a `connect` line into room.connections", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = compileDsl(SRC) as any;
    expect(byName(cfg, "Living").connections).toEqual(["Kitchen", "Hall"]);
    expect(byName(cfg, "Kitchen").connections).toEqual(["Living"]);
    // A room with no `connect` line has no connections field at all.
    expect(byName(cfg, "Hall").connections).toBeUndefined();
  });

  it("de-dupes repeated names, keeping author order", () => {
    const src = SRC.replace("connect Kitchen Hall", "connect Kitchen Hall Kitchen");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = compileDsl(src) as any;
    expect(byName(cfg, "Living").connections).toEqual(["Kitchen", "Hall"]);
  });

  it("round-trips through emit -> compile", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = compileDsl(SRC) as any;
    const wdl = emitWdl(cfg);
    expect(wdl).toContain("connect Kitchen Hall");
    expect(wdl).toContain("connect Living");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg2 = compileDsl(wdl) as any;
    expect(byName(cfg2, "Living").connections).toEqual(["Kitchen", "Hall"]);
    expect(byName(cfg2, "Kitchen").connections).toEqual(["Living"]);
    expect(byName(cfg2, "Hall").connections).toBeUndefined();
  });

  it("quotes connection names that need it", () => {
    const src = `house Test {
  convention center
  units feet_inches per_unit 10
  floor 1 "Ground" {
    room Living at (0, 0) size (100, 90) {
      connect "Guest Room" Hall
      wall north south east west
    }
    room "Guest Room" at (100, 0) size (80, 60) {
      wall north south east west
    }
    room Hall at (100, 60) size (80, 90) {
      wall north south east west
    }
  }
}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = compileDsl(src) as any;
    expect(byName(cfg, "Living").connections).toEqual(["Guest Room", "Hall"]);
    // A name with a space must be re-quoted on emit and re-parse cleanly.
    const wdl = emitWdl(cfg);
    expect(wdl).toContain('connect "Guest Room" Hall');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg2 = compileDsl(wdl) as any;
    expect(byName(cfg2, "Living").connections).toEqual(["Guest Room", "Hall"]);
  });

  it("survives resolve + expand (renderer ignores it; C11 reads the resolved config)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = compileDsl(SRC) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { config } = resolveParametric(cfg as any) as { config: any };
    // Present in the resolved config, where the C11 constraint will read it.
    expect(byName(config, "Living").connections).toEqual(["Kitchen", "Hall"]);
    // And the geometry pipeline is untouched by it.
    expect(() => expandRoomWalls(config)).not.toThrow();
  });
});
