// Shim → the field ENGINE now lives in the domain-neutral kernel
// (kernel/fieldSchema.ts, zod-free). Re-exported here so the ~10 editor imports of
// this module stay unchanged.
//
// Only the RUNTIME zod builder (`fieldsToZod`) stays here, with its consumer: it's
// used solely by the `fieldsToZod ≡ generated` parity test. The PRODUCTION path
// uses the kernel's `fieldsToZodSource` (a STRING emitter) via the gen-primitives
// codegen, so the kernel itself need not depend on zod. Keeping this one function
// on the app's own `z` also avoids a second zod instance in the schema union.

import { z } from "zod";
import {
  resolveFieldType,
  type FieldSpec,
  type FieldType,
  type Constraints,
} from "../../../kernel/fieldSchema";

// Re-export the whole kernel engine (types + all projections) unchanged.
export * from "../../../kernel/fieldSchema";

// ---- Projection: FieldType → RUNTIME Zod (test-only; kept off the kernel) ----

function numberZod(c?: Constraints): z.ZodTypeAny {
  let n = z.number();
  if (c?.int) n = n.int();
  if (c?.positive) n = n.positive();
  if (c?.nonneg) n = n.nonnegative();
  if (c?.min != null) n = n.min(c.min);
  if (c?.max != null) n = n.max(c.max);
  return n;
}

function fieldTypeToZod(ft: FieldType): z.ZodTypeAny {
  let zt: z.ZodTypeAny;
  if (ft.union) {
    zt = z.union(ft.union.map(fieldTypeToZod) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  } else if (ft.atom === "literal") {
    zt = z.enum([...(ft.values ?? [])] as [string, ...string[]]);
  } else if (ft.atom === "number") {
    zt = numberZod(ft.constraints);
  } else if (ft.atom === "string") {
    zt = ft.constraints?.pattern ? z.string().regex(new RegExp(ft.constraints.pattern)) : z.string();
  } else if (ft.atom === "boolean") {
    zt = z.boolean();
  } else {
    throw new Error("field type has neither atom nor union");
  }
  if (ft.list) zt = z.array(zt);
  if (ft.optional) zt = zt.optional();
  return zt;
}

// The runtime form of the common tail (mirrors the kernel's COMMON_SOURCE_LINES).
const commonShape = {
  formulas: z.record(z.string(), z.string()).optional(),
  enabled: z.union([z.boolean(), z.number()]).optional(),
  layer: z.string().optional(),
};

/** Project a primitive's `fields` to its RUNTIME Zod object schema (strict,
 *  discriminated on `type`), including the common tail. Behaviourally identical to
 *  the kernel's `fieldsToZodSource` (shared resolution; guarded by test). */
export function fieldsToZod(typeLiteral: string, fields: readonly FieldSpec[]): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {
    type: z.literal(typeLiteral),
    ...commonShape,
  };
  for (const f of fields) shape[f.name] = fieldTypeToZod(resolveFieldType(f));
  return z.object(shape).strict();
}
