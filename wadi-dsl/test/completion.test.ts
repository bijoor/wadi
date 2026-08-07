import { describe, it, expect, afterEach } from "vitest";
import { enclosingHeaderType, genericCompletionsAt } from "../src/generator/completion.js";
import { __setDescriptors, __resetDescriptors, makeDescriptor } from "../src/generator/descriptors.js";

// Descriptor-driven completion for the generic ObjectDecl path (P3b LSP). Pure logic;
// the Monaco mapping lives in playground/lsp.ts. FIELD completion only applies to
// GENERIC (block-using) primitives, so we inject a synthetic `widget` to exercise it;
// TYPE completion offers the real contributed primitive names (incl. promoted ones).

const WIDGET = makeDescriptor("widget", ["x", "y", "radius", "total_height", "turns"]);
const withWidget = () => __setDescriptors(new Map([[WIDGET.type, WIDGET]]));
afterEach(() => __resetDescriptors());

describe("DSL completion — enclosingHeaderType", () => {
  it("finds the block the cursor sits in", () => {
    expect(enclosingHeaderType(`house H {\nfloor 0 "G" {\n`)).toBe("floor");
    expect(enclosingHeaderType(`house H {\nfloor 0 "G" {\nwidget "W" {\n`)).toBe("widget");
    // A closed inner block doesn't count; the floor is still the enclosing one.
    expect(enclosingHeaderType(`house H {\nfloor 0 "G" {\nroom R at (0,0) size (1,1) { }\n`)).toBe(
      "floor",
    );
    expect(enclosingHeaderType(`house H {\n`)).toBe("house");
    expect(enclosingHeaderType(`house H {}\n`)).toBe(null); // nothing open
  });
});

describe("DSL completion — genericCompletionsAt", () => {
  it("inside a generic primitive's block → its field names (name excluded)", () => {
    withWidget();
    const g = genericCompletionsAt(`house H {\nfloor 0 "G" {\nwidget "W" {\n  `);
    expect(g?.kind).toBe("field");
    if (g?.kind === "field") {
      expect(g.type).toBe("widget");
      expect(g.items).toContain("radius");
      expect(g.items).toContain("total_height");
      expect(g.items).not.toContain("name");
    }
  });

  it("does not re-suggest a field already used in the block", () => {
    withWidget();
    const g = genericCompletionsAt(`house H {\nfloor 0 "G" {\nwidget "W" { radius 40\n  `);
    expect(g?.kind).toBe("field");
    if (g?.kind === "field") expect(g.items).not.toContain("radius");
  });

  it("at a floor statement start → contributed primitive type names (real manifest)", () => {
    // No inject → real PRIMITIVE_FIELD_DECLS. spiral_staircase is registered (its
    // descriptor still drives schema/form/docs even though its DSL is now bespoke),
    // so completing the keyword is useful.
    const g = genericCompletionsAt(`house H {\nfloor 0 "G" {\n  spir`);
    expect(g?.kind).toBe("type");
    if (g?.kind === "type") expect(g.items).toContain("spiral_staircase");
  });

  it("inside a room block (no descriptor) → nothing", () => {
    const g = genericCompletionsAt(`house H {\nfloor 0 "G" {\nroom R at (0,0) size (1,1) {\n  `);
    expect(g).toBeNull();
  });
});
