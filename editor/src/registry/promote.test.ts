import { describe, it, expect } from "vitest";
import { paramsToFields, promoteComponentToNode, registerExposedComponents } from "./promote";
import { getNode } from "./registry";
import { resolveParametric } from "../param/resolve";
import { expandRoomWalls } from "../svg2d/expand";
import type { HouseConfig } from "../schema/houseConfig";

// P0 (plans/declarative-plugins.md): a component `expose`d as a typed primitive is
// registered at runtime, gets fields from its params, and expands to core objects.

describe("declarative plugins — component promotion (P0)", () => {
  const deckDef = {
    params: [
      { name: "lift", default: 0, label: "Lift" },
      { name: "deep", default: 60, kind: "extent", unit: "project units" },
    ],
    objects: [
      { type: "floor_slab", x: 0, y: 0, width: 100, length: 60, thickness: 6 },
    ],
    expose: { type: "pack.deck", layer: "structure", label: "Deck" },
  };

  it("paramsToFields: placement fields + params (kind inferred, or annotated)", () => {
    const fields = paramsToFields(deckDef);
    expect(fields.map((f) => f.name)).toEqual([
      "name", "x", "y", "rotation", "z_offset", "lift", "deep",
    ]);
    // inferred: number default → coord; annotated: kind extent
    expect(fields.find((f) => f.name === "lift")?.kind).toBe("coord");
    expect(fields.find((f) => f.name === "deep")?.kind).toBe("extent");
    expect(fields.find((f) => f.name === "deep")?.unit).toBe("project units");
  });

  it("promoteComponentToNode: a valid schema + add-menu default", () => {
    const node = promoteComponentToNode(deckDef, deckDef.expose);
    expect(node.type).toBe("pack.deck");
    expect(node.label).toBe("Deck");
    expect(node.layerRole).toBe("structure");
    expect(node.addable).toBe(true);
    // schema accepts a valid instance and rejects an unknown key
    expect(node.schema!.safeParse({ type: "pack.deck", x: 1, y: 2, deep: 80 }).success).toBe(true);
    expect(node.schema!.safeParse({ type: "pack.deck", x: 1, y: 2, bogus: 9 }).success).toBe(false);
    // makeDefault seeds param defaults
    const def = node.makeDefault!({} as HouseConfig, []) as Record<string, unknown>;
    expect(def).toMatchObject({ type: "pack.deck", lift: 0, deep: 60 });
  });

  it("registerExposedComponents + expand: a promoted primitive stamps its body", () => {
    const config = {
      floors: [
        { floor_number: 1, name: "G", objects: [{ type: "pack.deck", x: 200, y: 150 }] },
      ],
      components: { Deck: deckDef },
    } as unknown as HouseConfig;

    const registered = registerExposedComponents(config);
    expect(registered).toContain("pack.deck");
    expect(getNode("pack.deck")).toBeTruthy();

    const resolved = resolveParametric(config as never).config as unknown as HouseConfig;
    const expanded = expandRoomWalls(resolved, 8);
    const objs = (expanded.floors?.[0]?.objects ?? []) as Record<string, unknown>[];

    // the pack.deck object is gone; a floor_slab, offset by (200,150), took its place
    expect(objs.some((o) => o.type === "pack.deck")).toBe(false);
    const slab = objs.find((o) => o.type === "floor_slab");
    expect(slab).toBeTruthy();
    expect(slab).toMatchObject({ type: "floor_slab", x: 200, y: 150, width: 100, length: 60 });
  });
});
