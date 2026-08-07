import { describe, it, expect, afterEach } from "vitest";
import { URI } from "langium";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { createWadiServices } from "../src/language/wadi-module.js";
import {
  __setDescriptors,
  __resetDescriptors,
  makeDescriptor,
} from "../src/generator/descriptors.js";

// P3b (§2.6): the descriptor-driven half of the generic path — positional args map
// to the primitive's field ORDER, and unknown fields / arg-count are validated,
// all from the `fields` descriptor (the kernel seam, src/generator/descriptors).
// Production descriptors are all keyword-sugared types that never reach the generic
// rule, so we inject a SYNTHETIC non-keyword primitive (as a real contributed one,
// e.g. spiral_staircase P5, will register) to exercise the machinery.

type Obj = Record<string, unknown>;
const floor0Objects = (cfg: Obj): Obj[] => ((cfg.floors as Obj[])[0].objects as Obj[]) ?? [];
const wrap = (body: string) => `house Generic {\nfloor 0 "G" {\n${body}\n}\n}\n`;

const SPIRAL = makeDescriptor("spiral_staircase", ["x", "y", "radius", "height", "turns"]);
const withSpiral = () => __setDescriptors(new Map([[SPIRAL.type, SPIRAL]]));

afterEach(() => __resetDescriptors());

// Build + validate a doc, returning its diagnostics.
async function diagnostics(text: string) {
  const { shared } = createWadiServices();
  const doc = shared.workspace.LangiumDocumentFactory.fromString(text, URI.parse("memory:///v.wdl"));
  shared.workspace.LangiumDocuments.addDocument(doc);
  await shared.workspace.DocumentBuilder.build([doc], { validation: true });
  return doc.diagnostics ?? [];
}

describe("DSL — descriptor-driven generic path (P3b)", () => {
  it("positional args map to the descriptor's field order", () => {
    withSpiral();
    const cfg = compileDsl(wrap(`spiral_staircase "S" (100, 120, 30)`));
    expect(floor0Objects(cfg)[0]).toEqual({
      type: "spiral_staircase",
      name: "S",
      x: 100,
      y: 120,
      radius: 30,
    });
  });

  it("positional args + named assigns combine", () => {
    withSpiral();
    const cfg = compileDsl(wrap(`spiral_staircase "S" (100, 120) { turns 3 }`));
    expect(floor0Objects(cfg)[0]).toEqual({
      type: "spiral_staircase",
      name: "S",
      x: 100,
      y: 120,
      turns: 3,
    });
  });

  it("a positional arg can be a formula", () => {
    withSpiral();
    const cfg = compileDsl(`house G {\nvar r = 5\nfloor 0 "G" {\nspiral_staircase "S" (10, 20, r * 2)\n}\n}\n`);
    expect(floor0Objects(cfg)[0]).toEqual({
      type: "spiral_staircase",
      name: "S",
      x: 10,
      y: 20,
      radius: 0,
      formulas: { radius: "= r * 2" },
    });
  });

  it("validates: too many positional args → error", async () => {
    withSpiral();
    const diags = await diagnostics(wrap(`spiral_staircase "S" (1, 2, 3, 4, 5, 6)`));
    const arg = diags.find((d) => /positional argument/.test(d.message));
    expect(arg?.severity).toBe(1); // 1 = Error
    expect(arg?.message).toContain("at most 5");
  });

  it("validates: an unknown field → warning", async () => {
    withSpiral();
    const diags = await diagnostics(wrap(`spiral_staircase "S" { bogus 3 }`));
    const unknown = diags.find((d) => /Unknown field 'bogus'/.test(d.message));
    expect(unknown?.severity).toBe(2); // 2 = Warning
  });

  it("a declared field is accepted (no unknown-field diagnostic)", async () => {
    withSpiral();
    const diags = await diagnostics(wrap(`spiral_staircase "S" { turns 3 }`));
    expect(diags.some((d) => /Unknown field/.test(d.message))).toBe(false);
  });

  it("an UNKNOWN type is left alone (no descriptor → no generic diagnostics)", async () => {
    // No synthetic descriptor set → getDescriptor returns undefined.
    const diags = await diagnostics(wrap(`mystery "M" { anything 1 }`));
    expect(diags.some((d) => /Unknown field|positional argument/.test(d.message))).toBe(false);
  });
});
