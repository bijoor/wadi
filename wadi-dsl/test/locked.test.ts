// `locked` is a pure-metadata tool-boundary flag (plans/room-templates-in-wadi.md,
// Part 3). It must round-trip through the DSL: authored in `.wdl`, carried into the
// config, and emitted back as the same bare flag — on objects (the common tail) and
// on nested wall openings (their own flag list). It carries NO geometry.

import { describe, it, expect } from "vitest";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { emitWdl } from "../src/generator/fromHouseConfig.js";

const SRC = `house LockTest {
  convention center
  units feet_inches per_unit 10
  site { plot (300, 300) }
  defaults { floor_height 120 wall_height 108 slab_thickness 8 wall_thickness 8 }
  floor 1 "Ground" slab_thickness 0 {
    room Studio at (4, 4) size (200, 240) locked {
      wall east west
      wall south { door Main at 90 size (34, 84) locked }
    }
    pillar Col at (0, 0) size (20, 20) height 100 locked
  }
}`;

function objectsOf(cfg: Record<string, unknown>): Record<string, unknown>[] {
  const floors = (cfg.floors as Array<{ objects?: Record<string, unknown>[] }>) ?? [];
  return floors.flatMap((f) => f.objects ?? []);
}
function firstOpening(objs: Record<string, unknown>[]): Record<string, unknown> | undefined {
  for (const o of objs) {
    const walls = o.walls as Record<string, { openings?: Record<string, unknown>[] }> | undefined;
    if (walls && typeof walls === "object") {
      for (const side of Object.keys(walls)) {
        const ops = walls[side]?.openings;
        if (Array.isArray(ops) && ops.length) return ops[0];
      }
    }
  }
  return undefined;
}

describe("locked flag round-trip", () => {
  it("compiles `locked` onto objects and nested openings", () => {
    const objs = objectsOf(compileDsl(SRC));
    const room = objs.find((o) => o.type === "room");
    const pillar = objs.find((o) => o.type === "pillar");
    expect(room?.locked).toBe(true);
    expect(pillar?.locked).toBe(true);
    expect(firstOpening(objs)?.locked).toBe(true);
  });

  it("emits `locked` back as a bare flag and survives a re-compile", () => {
    const wdl = emitWdl(compileDsl(SRC));
    // one for the room, one for the pillar, one for the door opening
    expect((wdl.match(/\blocked\b/g) ?? []).length).toBe(3);

    const objs = objectsOf(compileDsl(wdl));
    expect(objs.find((o) => o.type === "room")?.locked).toBe(true);
    expect(objs.find((o) => o.type === "pillar")?.locked).toBe(true);
    expect(firstOpening(objs)?.locked).toBe(true);
  });

  it("does not stamp `locked` on objects that were not authored with it", () => {
    const unlocked = SRC.replace(/ locked/g, "");
    const objs = objectsOf(compileDsl(unlocked));
    expect(objs.every((o) => o.locked === undefined)).toBe(true);
    expect(emitWdl(compileDsl(unlocked))).not.toMatch(/\blocked\b/);
  });
});
