// Field-schema — the heart of primitive componentization (P2;
// plans/primitive-componentization.md §2.3). A primitive declares its `fields`
// ONCE as data; each field's KIND knows how to project onto every surface. This
// module implements the Zod + docs projections (the form + DSL projections land in
// later increments). One declaration replaces four hand-synced copies.
//
// Behavioural parity, not byte-identity, is the goal: the generated Zod validates
// the SAME configs as the hand-written schema. The kinds mirror the shared helpers
// in schema/houseConfig (positive/nonnegative/enabledField/formulaMap).

import { z } from "zod";

export type FieldKindName =
  | "coord" // any number — x, y, z_offset
  | "extent" // positive number — width, length, height
  | "nonneg" // non-negative number — thickness
  | "int" // integer
  | "text" // string
  | "flag" // boolean | number (enabled-like switch)
  | "enum"; // one of a fixed set of strings

export interface FieldSpec {
  name: string;
  kind: FieldKindName;
  /** Default true. false → the Zod field is `.optional()`. */
  required?: boolean;
  /** For kind "enum": the allowed values. */
  values?: readonly string[];
  /** Human description (→ docs). */
  doc?: string;
  /** Doc-only unit hint, e.g. "project units". */
  unit?: string;
}

// Zod for a field's REQUIRED form; `fieldsToZod` applies `.optional()` when needed.
const KIND_ZOD: Record<FieldKindName, (f: FieldSpec) => z.ZodTypeAny> = {
  coord: () => z.number(),
  extent: () => z.number().positive(),
  nonneg: () => z.number().nonnegative(),
  int: () => z.number().int(),
  text: () => z.string(),
  flag: () => z.union([z.boolean(), z.number()]),
  enum: (f) => z.enum([...(f.values ?? [])] as [string, ...string[]]),
};

// The common attribute tail every primitive object carries — parametric `formulas`
// plus the `enabled`/`layer` switches. Mirrors the DSL `Common` fragment and the
// shared head of every hand-written object schema. Applied by `fieldsToZod` so a
// primitive's `fields` only declares its OWN geometry.
const commonShape = {
  formulas: z.record(z.string(), z.string()).optional(),
  enabled: z.union([z.boolean(), z.number()]).optional(),
  layer: z.string().optional(),
};

/** Project a primitive's `fields` to its Zod object schema (strict, discriminated
 *  on `type`), including the common tail. */
export function fieldsToZod(typeLiteral: string, fields: readonly FieldSpec[]): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {
    type: z.literal(typeLiteral),
    ...commonShape,
  };
  for (const f of fields) {
    let zt = KIND_ZOD[f.kind](f);
    if (f.required === false) zt = zt.optional();
    shape[f.name] = zt;
  }
  return z.object(shape).strict();
}

export interface DocRow {
  field: string;
  type: string;
  required: boolean;
  doc: string;
}

const KIND_DOC_TYPE: Record<FieldKindName, string> = {
  coord: "number",
  extent: "number > 0",
  nonneg: "number ≥ 0",
  int: "integer",
  text: "string",
  flag: "boolean | number",
  enum: "enum",
};

/** Project a primitive's `fields` to documentation rows (→ data-model docs). */
export function fieldsToDocRows(fields: readonly FieldSpec[]): DocRow[] {
  return fields.map((f) => ({
    field: f.name,
    type:
      f.kind === "enum"
        ? (f.values ?? []).map((v) => `"${v}"`).join(" | ")
        : KIND_DOC_TYPE[f.kind],
    required: f.required !== false,
    doc: [f.doc, f.unit ? `(${f.unit})` : ""].filter(Boolean).join(" "),
  }));
}
