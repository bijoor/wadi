import { describe, it, expect } from "vitest";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { emitWdl } from "../src/generator/fromHouseConfig.js";

// P0 (plans/declarative-plugins.md): a `component … expose as <ns.type>` compiles the
// promotion metadata onto the component def, and the promoted type is usable via the
// generic ObjectDecl path (its namespaced name parses because ObjectDecl accepts a
// QualifiedName). Round-trips through the decompiler.

const wdl = `house H {
  component Deck expose as pack.deck layer "structure" label "Deck" {
    param lift = 0 label "Lift"
    param deep = 60 kind extent unit "project units"
    slab at (0, 0) size (100, 60)
  }
  floor 1 "G" {
    pack.deck "D1" { x 200 y 150 deep 80 }
  }
}
`;

type Obj = Record<string, unknown>;

describe("DSL — component promotion (expose as)", () => {
  it("captures expose + param annotations on the component def", () => {
    const cfg = compileDsl(wdl) as Obj;
    const def = (cfg.components as Record<string, Obj>).Deck;
    expect(def.expose).toEqual({ type: "pack.deck", layer: "structure", label: "Deck" });
    expect(def.params).toEqual([
      { name: "lift", default: 0, label: "Lift" },
      { name: "deep", default: 60, kind: "extent", unit: "project units" },
    ]);
  });

  it("the promoted type parses generically (namespaced name)", () => {
    const cfg = compileDsl(wdl) as Obj;
    const obj = ((cfg.floors as Obj[])[0].objects as Obj[])[0];
    expect(obj).toMatchObject({ type: "pack.deck", name: "D1", x: 200, y: 150, deep: 80 });
  });

  it("round-trips: emit → recompile preserves expose + annotations", () => {
    const cfg = compileDsl(wdl);
    const wdl2 = emitWdl(cfg);
    expect(wdl2).toContain("expose as pack.deck");
    expect(wdl2).toContain("kind extent");
    const cfg2 = compileDsl(wdl2) as Obj;
    expect((cfg2.components as Record<string, Obj>).Deck.expose).toEqual({
      type: "pack.deck", layer: "structure", label: "Deck",
    });
  });
});
