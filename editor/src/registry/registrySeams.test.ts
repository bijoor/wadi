// P1e — proves the registration-push seams: a primitive registered ONLY through
// the registry (no edit to schema/houseConfig or state/layerDefaults) is picked up
// by the extensible object schema AND by roleForType. This is the mechanism a new
// independent primitive (spiral_staircase, P5) will ride to self-register with zero
// central-file edits.

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { registerNode } from "./registry";
import { objectSchema } from "../schema/houseConfig";
import { roleForType } from "../state/layerDefaults";

const TYPE = "__test_widget__";

// Register a fake primitive purely via the registry (schema + a non-default role).
registerNode({
  type: TYPE,
  label: "Test Widget",
  layerRole: "walls", // default would be "structure" — so this proves it flowed
  schema: z.object({ type: z.literal(TYPE), foo: z.number() }).strict(),
});

describe("P1e registration-push seams", () => {
  it("extensible object schema accepts a registry-only type", () => {
    expect(objectSchema.safeParse({ type: TYPE, foo: 5 }).success).toBe(true);
  });

  it("still structurally validates that registered type (rejects malformed)", () => {
    expect(objectSchema.safeParse({ type: TYPE }).success).toBe(false); // missing foo
    expect(objectSchema.safeParse({ type: TYPE, foo: "x" }).success).toBe(false);
  });

  it("built-in types are unaffected by the union extension", () => {
    expect(objectSchema.safeParse({ type: "__no_such_type__" }).success).toBe(false);
  });

  it("layerRole flows through roleForType from the node file", () => {
    expect(roleForType(TYPE)).toBe("walls");
  });
});
