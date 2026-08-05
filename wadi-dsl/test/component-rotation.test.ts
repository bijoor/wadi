// Component `use … rotation <deg>` (refined option 1): right angles exact for any
// component; free angles for furniture-only; a non-right angle on a structural
// component errors.

import { describe, it, expect } from "vitest";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { emitWdl } from "../src/generator/fromHouseConfig.js";
import { resolveParametric } from "../../editor/src/param/resolve";
import { expandRoomWalls } from "../../editor/src/svg2d/expand";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function place(wdl: string, opts?: any): any[] {
  const cfg = compileDsl(wdl, {});
  const resolved = resolveParametric(cfg as never).config;
  const floors = expandRoomWalls(resolved as never, undefined, opts).floors as any[];
  return floors.flatMap((f) => (f.objects ?? []) as any[]);
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const ASSET = `asset { id "x" src "u.glb" dims (1, 0.5, 1) }`;

describe("component rotation (refined option 1)", () => {
  it("furniture-only component: any angle rotates position + adds to yaw", () => {
    const objs = place(`house H {
      convention center
      site { plot (400,400) }
      component Set {
        item name "A" ${ASSET} at (10, 0) rotation 0
        item name "B" ${ASSET} at (0, 10) rotation 90
      }
      floor 1 "G" slab_thickness 0 { use Set at (100, 100) rotation 45 }
    }`);
    const A = objs.find((o) => o.name === "A")!;
    const B = objs.find((o) => o.name === "B")!;
    // 45° CW about origin: rp(10,0)=(7.07,-7.07) → +100 ; yaw 0+45=45
    expect(near(A.x, 100 + 10 * Math.SQRT1_2)).toBe(true);
    expect(near(A.y, 100 - 10 * Math.SQRT1_2)).toBe(true);
    expect(A.rotation).toBe(45);
    expect(B.rotation).toBe(135); // 90 + 45
  });

  it("structural component at 90°: room+pillar dims swap, sides & door direction remap", () => {
    const objs = place(`house H {
      convention center
      site { plot (400,400) }
      component Bath {
        room R at (0,0) size (100,60) { wall north { door D at 20 size (30,65) } wall south east west }
        pillar P at (0,0) size (10,20) height 90
      }
      floor 1 "G" slab_thickness 0 { use Bath at (200,200) rotation 90 }
    }`);
    const R = objs.find((o) => o.type === "room" && o.name === "R")!;
    expect([R.width, R.length]).toEqual([60, 100]);          // dims swapped
    expect([...(R.walls as string[])].sort()).toEqual(["east", "north", "south", "west"]); // all four still present
    const P = objs.find((o) => o.type === "pillar")!;
    expect([P.width, P.length]).toEqual([20, 10]);           // pillar dims swapped
    const D = objs.find((o) => o.type === "door")!;
    expect(D.direction).toBe("west");                        // north → west
    // door was north@(20,0) → rp = (0,-20) → +200 = (200,180), on the room's west edge (x=200)
    expect(near(D.x, 200)).toBe(true);
    expect(near(D.y, 180)).toBe(true);
  });

  it("round-trips rotation through the decompiler", () => {
    const wdl = `house H {
      convention center
      site { plot (200,200) }
      component C { pillar P at (0,0) size (10,10) height 90 }
      floor 1 "G" slab_thickness 0 { use C at (50,50) rotation 90 }
    }`;
    const back = compileDsl(emitWdl(compileDsl(wdl, {})), {});
    const inst = (back.floors as any[])[0].objects.find((o: any) => o.type === "component");
    expect(inst.rotation).toBe(90);
  });

  it("non-right angle on a structural component is an error", () => {
    expect(() =>
      place(
        `house H {
          convention center
          site { plot (400,400) }
          component Bath { room R at (0,0) size (100,60) { wall north south east west } }
          floor 1 "G" slab_thickness 0 { use Bath at (0,0) rotation 30 }
        }`,
        { lenient: false },
      ),
    ).toThrow(/not a right angle/);
  });
});
