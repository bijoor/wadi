// Counter — the first parametric furniture element. Covers the shared `furniture`
// capability (footprint in project units, wall placement, wall-span default), the 2D
// footprint, the 3D guard, and the WDL emit. See plans/parametric-furniture-elements.md.

import { describe, it, expect } from "vitest";
import { counterNode } from "./counter";
import { itemNode } from "./item";
import { furnitureAsset, DEFAULT_FURNITURE_ID } from "../../furniture/catalog";

const base = { type: "counter", x: 100, y: 50, depth: 22, height: 36 } as Record<string, unknown>;

describe("counter.furniture capability", () => {
  it("placement is a wall run", () => {
    expect(counterNode.furniture?.placement).toBe("wall");
  });

  it("footprint is { w: length, l: depth } in project units (local frame)", () => {
    const fp = counterNode.furniture!.footprint({ ...base, length: 120 }, {});
    expect(fp).toEqual({ w: 120, l: 22 });
  });

  it("length defaults to the wall clear span when not authored", () => {
    const fp = counterNode.furniture!.footprint({ ...base }, { wallSpan: 180 });
    expect(fp).toEqual({ w: 180, l: 22 });
  });

  it("returns null when neither length nor a wall span is available", () => {
    expect(counterNode.furniture!.footprint({ ...base }, {})).toBeNull();
  });

  it("returns null when depth is missing", () => {
    expect(counterNode.furniture!.footprint({ type: "counter", length: 100, height: 36 }, {})).toBeNull();
  });
});

describe("counter.planFootprint", () => {
  it("draws a length x depth box at the plan centre, carrying rotation", () => {
    const fp = counterNode.planFootprint!({ ...base, length: 120, rotation: 270, name: "Otta" });
    expect(fp).toEqual({ cx: 100, cy: 50, w: 120, d: 22, rot: 270, label: "Otta" });
  });

  it("returns null without length/depth", () => {
    expect(counterNode.planFootprint!({ type: "counter", x: 0, y: 0 })).toBeNull();
  });
});

describe("counter.render3D", () => {
  const ctx = {
    band: { slabZ: 0, slabThickness: 8 } as never,
    plot: { width: 300, length: 300 } as never,
    floorNum: 1,
    key: "k",
  };
  it("returns null when the run is not fully resolved (pre-expand)", () => {
    expect(counterNode.render3D!({ ...base }, ctx)).toBeNull(); // no length
  });
  it("renders on the per-floor structure layer once resolved", () => {
    const out = counterNode.render3D!({ ...base, length: 120 }, ctx);
    // per-floor layer id (f<n>_<role>) — a bare role name is not a mounted 3D group
    expect(out?.layerId).toBe("f1_structure");
    expect(out?.node).toBeTruthy();
  });

  it("a plain counter renders a single mesh; cabinet renders a multi-part group", () => {
    const plain = counterNode.render3D!({ ...base, length: 120 }, ctx) as { node: { type: unknown } };
    const cab = counterNode.render3D!({ ...base, length: 120, cabinet: true }, ctx) as {
      node: { props: { children: unknown[] } };
    };
    // plain = one <mesh>; cabinet = a <group> with top slab + body (+ toe-kick) children
    expect(String(plain.node.type)).toBe("mesh");
    const kids = (cab.node.props.children as unknown[]).flat().filter(Boolean);
    expect(kids.length).toBeGreaterThanOrEqual(2);
  });
});

describe("counter.emitWdl", () => {
  it("emits a free run with at (x,y) + length/depth/height", () => {
    const wdl = counterNode.emitWdl!({ ...base, name: "Otta", length: 120, rotation: 0 });
    expect(wdl).toContain("counter name \"Otta\"");
    expect(wdl).toContain("at (100, 50)");
    expect(wdl).toContain("length 120");
    expect(wdl).toContain("depth 22 height 36");
  });

  it("emits an anchored run (no x/y) with anchor + gap", () => {
    const wdl = counterNode.emitWdl!({
      type: "counter", depth: 22, height: 36, anchor_to: "Kitchen", anchor: "center-right", gap_x: 0, gap_y: 0,
    });
    expect(wdl).not.toContain("at (");
    expect(wdl).toContain("anchor_to \"Kitchen\"");
    expect(wdl).toContain("anchor center-right");
  });

  it("emits locked + layer via the shared common suffix", () => {
    const wdl = counterNode.emitWdl!({ ...base, length: 100, locked: true, layer: "structure" });
    expect(wdl).toContain("locked");
    expect(wdl).toContain("layer \"structure\"");
  });
});

describe("item.furniture capability (retrofit)", () => {
  it("a GLB item is a free element whose footprint scales its metric asset size", () => {
    const asset = furnitureAsset(DEFAULT_FURNITURE_ID);
    const fp = itemNode.furniture!.footprint({ type: "item", asset }, {});
    expect(itemNode.furniture?.placement).toBe("free");
    // width/depth are asset metres scaled to project units (default feet_inches/per_unit 10)
    expect(fp!.w).toBeGreaterThan(0);
    expect(fp!.l).toBeGreaterThan(0);
  });
});
