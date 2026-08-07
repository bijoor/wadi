import { describe, it, expect } from "vitest";
import { enclosingHeaderType, genericCompletionsAt } from "../src/generator/completion.js";

// Descriptor-driven completion for the generic ObjectDecl path (P3b LSP, deferred
// → done). Pure logic; the Monaco mapping lives in playground/lsp.ts. Uses the REAL
// manifest (spiral_staircase is registered as of P5).

describe("DSL completion — enclosingHeaderType", () => {
  it("finds the block the cursor sits in", () => {
    expect(enclosingHeaderType(`house H {\nfloor 0 "G" {\n`)).toBe("floor");
    expect(enclosingHeaderType(`house H {\nfloor 0 "G" {\nspiral_staircase "S" {\n`)).toBe(
      "spiral_staircase",
    );
    // A closed inner block doesn't count; the floor is still the enclosing one.
    expect(enclosingHeaderType(`house H {\nfloor 0 "G" {\nroom R at (0,0) size (1,1) { }\n`)).toBe(
      "floor",
    );
    expect(enclosingHeaderType(`house H {\n`)).toBe("house");
    expect(enclosingHeaderType(`house H {}\n`)).toBe(null); // nothing open
  });
});

describe("DSL completion — genericCompletionsAt", () => {
  it("inside a primitive's block → its field names (name excluded)", () => {
    const g = genericCompletionsAt(`house H {\nfloor 0 "G" {\nspiral_staircase "S" {\n  `);
    expect(g?.kind).toBe("field");
    if (g?.kind === "field") {
      expect(g.type).toBe("spiral_staircase");
      expect(g.items).toContain("radius");
      expect(g.items).toContain("total_height");
      expect(g.items).not.toContain("name");
    }
  });

  it("does not re-suggest a field already used in the block", () => {
    const g = genericCompletionsAt(`house H {\nfloor 0 "G" {\nspiral_staircase "S" { radius 40\n  `);
    expect(g?.kind).toBe("field");
    if (g?.kind === "field") expect(g.items).not.toContain("radius");
  });

  it("at a floor statement start → contributed primitive type names", () => {
    const g = genericCompletionsAt(`house H {\nfloor 0 "G" {\n  spir`);
    expect(g?.kind).toBe("type");
    if (g?.kind === "type") expect(g.items).toContain("spiral_staircase");
  });

  it("inside a room block (no descriptor) → nothing", () => {
    // `room` has no descriptor; not a floor/component either → no generic help.
    const g = genericCompletionsAt(`house H {\nfloor 0 "G" {\nroom R at (0,0) size (1,1) {\n  `);
    expect(g).toBeNull();
  });
});
