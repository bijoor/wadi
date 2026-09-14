// `counter` — the parametric furniture element that replaces kitchen_platform
// (plans/parametric-furniture-elements.md). A free run carries `at (x, y)`; an anchored
// run hugs a named room's wall (anchor + gap) and derives x/y + a wall-span `length` at
// expand. Tests compile -> emit -> compile round-trip and the expand-time anchoring, plus
// that the legacy `kitchen` platform still parses (kept one release).

import { describe, it, expect } from "vitest";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { emitWdl } from "../src/generator/fromHouseConfig.js";
import { expandRoomWalls } from "../../editor/src/svg2d/expand";

const SRC = `house Ctr {
  convention center
  units feet_inches per_unit 10
  site { plot (500, 500) }
  defaults { floor_height 120 wall_height 108 slab_thickness 8 wall_thickness 8 }
  floor 1 "Ground" slab_thickness 0 {
    room K at (4, 4) size (200, 160) type "kitchen" { wall east west north south }
    counter name "Otta" anchor_to "K" anchor center-right depth 22 height 36 material "granite"
    counter name "Free" at (300, 60) rotation 0 length 120 depth 24 height 36 locked
  }
}`;

function objs(cfg: Record<string, unknown>): Record<string, unknown>[] {
  const floors = (cfg.floors as Array<{ objects?: Record<string, unknown>[] }>) ?? [];
  return floors.flatMap((f) => f.objects ?? []);
}
const byName = (cfg: Record<string, unknown>, n: string) => objs(cfg).find((o) => o.name === n)!;

describe("counter compile + round-trip", () => {
  const cfg = compileDsl(SRC) as Record<string, unknown>;

  it("compiles an anchored run (no x/y) and a free run (with x/y)", () => {
    const otta = byName(cfg, "Otta");
    expect(otta.type).toBe("counter");
    expect(otta.anchor_to).toBe("K");
    expect(otta.anchor).toBe("center-right");
    expect(otta.depth).toBe(22);
    expect(otta.material).toBe("granite");
    expect(otta.x).toBeUndefined(); // derived at expand
    const free = byName(cfg, "Free");
    expect(free.x).toBe(300);
    expect(free.length).toBe(120);
    expect(free.locked).toBe(true);
  });

  it("round-trips byte-stable through emit -> compile", () => {
    const wdl = emitWdl(cfg as never);
    expect(wdl).toContain('counter name "Otta"');
    expect(wdl).toContain("anchor_to \"K\" anchor center-right");
    expect(wdl).toContain("counter name \"Free\" at (300, 60)");
    const cfg2 = compileDsl(wdl) as Record<string, unknown>;
    expect(emitWdl(cfg2 as never)).toBe(wdl); // stable second pass
  });

  it("the legacy kitchen platform still parses", () => {
    const legacy = compileDsl(`house L {
      site { plot (300, 300) }
      floor 1 "G" { kitchen name "C" path ((10,10),(110,10)) side right depth 22 height 36 }
    }`) as Record<string, unknown>;
    expect(byName(legacy, "C").type).toBe("kitchen_platform");
  });
});

describe("counter expand-time anchoring", () => {
  const expanded = expandRoomWalls(compileDsl(SRC) as never) as unknown as Record<string, unknown>;

  it("an anchored counter derives x/y, faces off its wall, and fills the wall span", () => {
    const otta = byName(expanded, "Otta");
    expect(otta.x).toBeTypeOf("number"); // derived
    expect(otta.y).toBeTypeOf("number");
    expect(otta.rotation).toBe(270); // center-right → faces west off the east wall
    // length defaulted to the inner span of the east wall (room length 160, wallT 8)
    expect(otta.length as number).toBeGreaterThan(140);
    expect(otta.length as number).toBeLessThan(160);
  });

  it("a free counter keeps its authored x/y and length", () => {
    const free = byName(expanded, "Free");
    expect(free.x).toBe(300);
    expect(free.y).toBe(60);
    expect(free.length).toBe(120);
  });
});
