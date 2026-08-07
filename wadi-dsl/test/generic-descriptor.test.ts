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
// to the primitive's field ORDER, and unknown fields / arg-count are validated, all
// from the `fields` descriptor (the kernel seam, src/generator/descriptors). Every
// production primitive is keyword-sugared (so it never reaches the generic rule), so
// we inject a SYNTHETIC non-keyword primitive `widget` to exercise the machinery —
// the exact path a freshly-contributed primitive rides before any promotion.

type Obj = Record<string, unknown>;
const floor0Objects = (cfg: Obj): Obj[] => ((cfg.floors as Obj[])[0].objects as Obj[]) ?? [];
const wrap = (body: string) => `house Generic {\nfloor 0 "G" {\n${body}\n}\n}\n`;

const WIDGET = makeDescriptor("widget", ["x", "y", "radius", "height", "turns"]);
const withWidget = () => __setDescriptors(new Map([[WIDGET.type, WIDGET]]));

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
    withWidget();
    const cfg = compileDsl(wrap(`widget "W" (100, 120, 30)`));
    expect(floor0Objects(cfg)[0]).toEqual({ type: "widget", name: "W", x: 100, y: 120, radius: 30 });
  });

  it("positional args + named assigns combine", () => {
    withWidget();
    const cfg = compileDsl(wrap(`widget "W" (100, 120) { turns 3 }`));
    expect(floor0Objects(cfg)[0]).toEqual({ type: "widget", name: "W", x: 100, y: 120, turns: 3 });
  });

  it("a positional arg can be a formula", () => {
    withWidget();
    const cfg = compileDsl(`house G {\nvar r = 5\nfloor 0 "G" {\nwidget "W" (10, 20, r * 2)\n}\n}\n`);
    expect(floor0Objects(cfg)[0]).toEqual({
      type: "widget",
      name: "W",
      x: 10,
      y: 20,
      radius: 0,
      formulas: { radius: "= r * 2" },
    });
  });

  it("named parameters — each value labelled (the generic block form)", () => {
    withWidget();
    const cfg = compileDsl(wrap(`widget "W" { x 120 y 120 radius 45 height 110 turns 1.75 }`));
    expect(floor0Objects(cfg)[0]).toEqual({
      type: "widget",
      name: "W",
      x: 120,
      y: 120,
      radius: 45,
      height: 110,
      turns: 1.75,
    });
  });

  it("validates: too many positional args → error", async () => {
    withWidget();
    const diags = await diagnostics(wrap(`widget "W" (1, 2, 3, 4, 5, 6)`));
    const arg = diags.find((d) => /positional argument/.test(d.message));
    expect(arg?.severity).toBe(1); // 1 = Error
    expect(arg?.message).toContain("at most 5");
  });

  it("validates: an unknown field → warning", async () => {
    withWidget();
    const diags = await diagnostics(wrap(`widget "W" { bogus 3 }`));
    const unknown = diags.find((d) => /Unknown field 'bogus'/.test(d.message));
    expect(unknown?.severity).toBe(2); // 2 = Warning
  });

  it("a declared field is accepted (no unknown-field diagnostic)", async () => {
    withWidget();
    const diags = await diagnostics(wrap(`widget "W" { turns 3 }`));
    expect(diags.some((d) => /Unknown field/.test(d.message))).toBe(false);
  });

  it("an UNKNOWN type is left alone (no descriptor → no generic diagnostics)", async () => {
    // No synthetic descriptor set → getDescriptor returns undefined.
    const diags = await diagnostics(wrap(`mystery "M" { anything 1 }`));
    expect(diags.some((d) => /Unknown field|positional argument/.test(d.message))).toBe(false);
  });
});
