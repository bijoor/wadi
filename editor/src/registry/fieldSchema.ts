// Field-schema — the heart of primitive componentization (P2;
// plans/primitive-componentization.md §2.3). A primitive declares its `fields`
// ONCE as data; each field projects onto every surface.
//
// TWO-TIER, so a new field "kind" is DATA, not an engine release (like Zod / JSON
// Schema / protobuf):
//   • Tier 1 — atoms + combinators + constraints: the CLOSED, ~stable vocabulary
//     (number/string/boolean/literal; union/list/optional; positive/nonneg/int/
//     min/max/pattern). This is the only part that's engine code.
//   • Tier 2 — PRESETS: named `FieldType`s composed from Tier 1 (coord, extent,
//     …). Adding a preset is data — no release — and it inherits every projection.
//
// Two projections live here: `fieldsToZod` (RUNTIME Zod) and `fieldsToZodSource`
// (emits typed Zod SOURCE for the gen-primitives codegen → precise `z.infer` types,
// no dynamic tier). Both share the Tier-1/preset resolution, so they can't drift;
// the `fieldsToZod ≡ generated` test locks them together. Kinds mirror
// schema/houseConfig's helpers, so behaviour matches.

import { z } from "zod";

// ---- Tier 1: atoms + combinators + constraints (CLOSED) ---------------------

type Atom = "number" | "string" | "boolean" | "literal";
interface Constraints {
  positive?: boolean;
  nonneg?: boolean;
  int?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
}
interface FieldType {
  atom?: Atom; // present unless `union`
  values?: readonly string[]; // for atom "literal" → z.enum(values)
  constraints?: Constraints;
  union?: FieldType[]; // combinator
  list?: boolean; // combinator: array of
  optional?: boolean;
}

// ---- Tier 2: presets (OPEN — data composed from Tier 1) ---------------------

/** A field "kind" is a preset name (Tier 2). New presets are data — see PRESETS. */
export type FieldKindName = string;

const PRESETS: Record<string, FieldType> = {
  coord: { atom: "number" }, // x, y, z_offset
  extent: { atom: "number", constraints: { positive: true } }, // width, length, height
  nonneg: { atom: "number", constraints: { nonneg: true } }, // thickness
  int: { atom: "number", constraints: { int: true } },
  text: { atom: "string" }, // name, label
  flag: { union: [{ atom: "boolean" }, { atom: "number" }] }, // enabled-like
  enum: { atom: "literal" }, // values supplied by the FieldSpec
};

export interface FieldSpec {
  name: string;
  kind: FieldKindName;
  /** Default true. false → the field is `.optional()`. */
  required?: boolean;
  /** For kind "enum": the allowed values. */
  values?: readonly string[];
  /** Human description (→ docs). */
  doc?: string;
  /** Doc-only unit hint, e.g. "project units". */
  unit?: string;
}

function resolveFieldType(spec: FieldSpec): FieldType {
  const preset = PRESETS[spec.kind];
  if (!preset) throw new Error(`unknown field kind "${spec.kind}"`);
  const ft: FieldType = structuredClone(preset);
  if (spec.values) ft.values = spec.values;
  if (spec.required === false) ft.optional = true;
  return ft;
}

// ---- Projection: FieldType → runtime Zod ------------------------------------

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

// ---- Projection: FieldType → Zod SOURCE (for codegen) -----------------------

function numberSource(c?: Constraints): string {
  let s = "z.number()";
  if (c?.int) s += ".int()";
  if (c?.positive) s += ".positive()";
  if (c?.nonneg) s += ".nonnegative()";
  if (c?.min != null) s += `.min(${c.min})`;
  if (c?.max != null) s += `.max(${c.max})`;
  return s;
}

function fieldTypeToSource(ft: FieldType): string {
  let s: string;
  if (ft.union) {
    s = `z.union([${ft.union.map(fieldTypeToSource).join(", ")}])`;
  } else if (ft.atom === "literal") {
    s = `z.enum([${(ft.values ?? []).map((v) => JSON.stringify(v)).join(", ")}])`;
  } else if (ft.atom === "number") {
    s = numberSource(ft.constraints);
  } else if (ft.atom === "string") {
    s = ft.constraints?.pattern ? `z.string().regex(/${ft.constraints.pattern}/)` : "z.string()";
  } else if (ft.atom === "boolean") {
    s = "z.boolean()";
  } else {
    throw new Error("field type has neither atom nor union");
  }
  if (ft.list) s = `z.array(${s})`;
  if (ft.optional) s += ".optional()";
  return s;
}

// ---- The common tail every primitive object carries -------------------------

const commonShape = {
  formulas: z.record(z.string(), z.string()).optional(),
  enabled: z.union([z.boolean(), z.number()]).optional(),
  layer: z.string().optional(),
};
// Source form of the SAME common tail (must mirror commonShape exactly).
const COMMON_SOURCE_LINES = [
  "formulas: z.record(z.string(), z.string()).optional(),",
  "enabled: z.union([z.boolean(), z.number()]).optional(),",
  "layer: z.string().optional(),",
];

/** Project a primitive's `fields` to its RUNTIME Zod object schema (strict,
 *  discriminated on `type`), including the common tail. */
export function fieldsToZod(typeLiteral: string, fields: readonly FieldSpec[]): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {
    type: z.literal(typeLiteral),
    ...commonShape,
  };
  for (const f of fields) shape[f.name] = fieldTypeToZod(resolveFieldType(f));
  return z.object(shape).strict();
}

/** Emit the TS SOURCE for the same schema — for the gen-primitives codegen, so the
 *  generated file gives precise `z.infer` types. Behaviourally identical to
 *  `fieldsToZod` (shared resolution; guarded by test). References `z` only. */
export function fieldsToZodSource(typeLiteral: string, fields: readonly FieldSpec[]): string {
  const lines = [
    `type: z.literal(${JSON.stringify(typeLiteral)}),`,
    ...COMMON_SOURCE_LINES,
    ...fields.map((f) => `${f.name}: ${fieldTypeToSource(resolveFieldType(f))},`),
  ];
  return `z.object({\n${lines.map((l) => `  ${l}`).join("\n")}\n}).strict()`;
}

// ---- Projection: FieldType → docs -------------------------------------------

function docType(ft: FieldType): string {
  if (ft.union) return ft.union.map(docType).join(" | ");
  if (ft.atom === "literal") return (ft.values ?? []).map((v) => `"${v}"`).join(" | ");
  if (ft.atom === "number") {
    if (ft.constraints?.int) return "integer";
    if (ft.constraints?.positive) return "number > 0";
    if (ft.constraints?.nonneg) return "number ≥ 0";
    return "number";
  }
  if (ft.atom === "string") return "string";
  if (ft.atom === "boolean") return "boolean";
  return "unknown";
}

export interface DocRow {
  field: string;
  type: string;
  required: boolean;
  doc: string;
}

/** Project a primitive's `fields` to documentation rows (→ data-model docs). */
export function fieldsToDocRows(fields: readonly FieldSpec[]): DocRow[] {
  return fields.map((f) => ({
    field: f.name,
    type: docType(resolveFieldType({ ...f, required: true })),
    required: f.required !== false,
    doc: [f.doc, f.unit ? `(${f.unit})` : ""].filter(Boolean).join(" "),
  }));
}
