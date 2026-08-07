import { describe, it, expect } from "vitest";
import { z } from "zod";
import { fieldsToZod, fieldsToZodSource, fieldsToDocRows } from "./fieldSchema";
import { object } from "../schema/houseConfig";
// The SINGLE source of truth for beam's shape (drives the generated schema too).
import { beamFields } from "../schema/fields/beam";

const generated = fieldsToZod("beam", beamFields);

// Validate the SAME beam object against the generated schema and the real one (the
// discriminated union routes a beam to its hand-written member). Success must match.
const cases: { name: string; o: Record<string, unknown>; valid: boolean }[] = [
  { name: "minimal", o: { type: "beam", x: 0, y: 0, width: 10, length: 10 }, valid: true },
  {
    name: "full",
    o: {
      type: "beam", name: "B", x: 1, y: 2, width: 5, length: 6, height: 8, z_offset: -3,
      formulas: { width: "= a" }, enabled: 1, layer: "L",
    },
    valid: true,
  },
  { name: "enabled bool", o: { type: "beam", x: 0, y: 0, width: 10, length: 10, enabled: true }, valid: true },
  { name: "negative z_offset ok (coord)", o: { type: "beam", x: 0, y: 0, width: 10, length: 10, z_offset: -5 }, valid: true },
  { name: "width negative", o: { type: "beam", x: 0, y: 0, width: -1, length: 10 }, valid: false },
  { name: "width zero", o: { type: "beam", x: 0, y: 0, width: 0, length: 10 }, valid: false },
  { name: "height zero", o: { type: "beam", x: 0, y: 0, width: 10, length: 10, height: 0 }, valid: false },
  { name: "missing length", o: { type: "beam", x: 0, y: 0, width: 10 }, valid: false },
  { name: "x not number", o: { type: "beam", x: "0", y: 0, width: 10, length: 10 }, valid: false },
  { name: "unknown key", o: { type: "beam", x: 0, y: 0, width: 10, length: 10, bogus: 1 }, valid: false },
];

describe("fieldSchema — fields→zod behavioural parity with hand-written beam", () => {
  for (const c of cases) {
    it(`${c.name}: generated agrees with the real schema`, () => {
      const gen = generated.safeParse(c.o).success;
      const real = object.safeParse(c.o).success;
      expect(gen).toBe(real); // generated ≡ hand-written
      expect(gen).toBe(c.valid); // …and both match the intended outcome
    });
  }
});

describe("fieldSchema — fields→zod SOURCE emitter (gen-primitives)", () => {
  // Evaluate the emitted source (references `z` only) and run the same battery:
  // the generated typed schema must behave exactly like the runtime one.
  const src = fieldsToZodSource("beam", beamFields);
  const evaledSchema = new Function("z", `return (${src});`)(z) as z.ZodTypeAny;

  it("emits a self-contained z.object(...).strict() expression", () => {
    expect(src.startsWith("z.object({")).toBe(true);
    expect(src.trimEnd().endsWith(").strict()")).toBe(true);
    expect(src).toContain("width: z.number().positive(),");
    expect(src).toContain('type: z.literal("beam"),');
  });

  for (const c of cases) {
    it(`${c.name}: emitted-source schema agrees with runtime + hand-written`, () => {
      expect(evaledSchema.safeParse(c.o).success).toBe(object.safeParse(c.o).success);
      expect(evaledSchema.safeParse(c.o).success).toBe(c.valid);
    });
  }
});

describe("generated box primitives — key constraints hold via the object union", () => {
  // Guards a MORE-permissive drift (parity-render only exercises valid configs).
  const rejects: Record<string, unknown>[] = [
    { type: "pillar", x: 0, y: 0, height: 10 }, // missing REQUIRED name
    { type: "floor_slab", x: 0, y: 0, width: -1, length: 10 }, // width not positive
    { type: "plinth", name: "P", x: 0, y: 0, width: 10, length: 10, height: 10, bogus: 1 }, // unknown key
    { type: "ground", name: "G", x: 0, y: 0, width: 10, length: 10, height: -1 }, // height not ≥ 0
  ];
  const accepts: Record<string, unknown>[] = [
    { type: "pillar", name: "P", x: 0, y: 0, height: 10 }, // width/length both optional
    { type: "floor_slab", x: 0, y: 0, width: 10, length: 10 },
    { type: "plinth", x: 0, y: 0, width: 10, length: 10, height: 10, material: "brick" },
    { type: "ground", x: 0, y: 0, width: 10, length: 10 }, // height optional
  ];
  for (const o of rejects) {
    it(`rejects invalid ${o.type}`, () => expect(object.safeParse(o).success).toBe(false));
  }
  for (const o of accepts) {
    it(`accepts valid ${o.type}`, () => expect(object.safeParse(o).success).toBe(true));
  }
});

describe("fieldSchema — fields→docs", () => {
  it("projects rows with type + required + doc", () => {
    const rows = fieldsToDocRows(beamFields);
    expect(rows).toContainEqual({ field: "width", type: "number > 0", required: true, doc: "X extent (project units)" });
    expect(rows.find((r) => r.field === "name")).toMatchObject({ required: false });
    expect(rows.find((r) => r.field === "z_offset")).toMatchObject({ type: "number", required: false });
  });
});
