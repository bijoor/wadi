// @dslkit/kernel — the domain-neutral field engine.
//
// This is the heart of the DSL-software framework (plans/primitive-
// componentization.md §2.3, §3): a primitive declares its `fields` ONCE as data,
// and each field PROJECTS onto every surface — schema source, docs, form control,
// and (via the descriptor manifest) DSL syntax. NOTHING here mentions houses,
// three.js, React, or even zod: it is pure TypeScript. The Wadi domain (the editor)
// sits ON this; a different domain reuses it verbatim. The dependency-direction
// guardrail (kernel/scripts/check-boundary.mjs) enforces that this file imports
// nothing outside the kernel + node/TS builtins.
//
// TWO-TIER, so a new field "kind" is DATA, not an engine release (like Zod / JSON
// Schema / protobuf):
//   • Tier 1 — atoms + combinators + constraints: the CLOSED, ~stable vocabulary
//     (number/string/boolean/literal; union/list/optional; positive/nonneg/int/
//     min/max/pattern). This is the only part that's engine code.
//   • Tier 2 — PRESETS: named `FieldType`s composed from Tier 1 (coord, extent, …).
//     Adding a preset is data — no release — and it inherits every projection.
//
// The RUNTIME zod builder (`fieldsToZod`) lives with its consumer (the editor
// shim, registry/fieldSchema.ts) so the kernel stays zod-free: the production path
// uses `fieldsToZodSource` (a STRING emitter) via the gen-primitives codegen.

// ---- Tier 1: atoms + combinators + constraints (CLOSED) ---------------------

export type Atom = "number" | "string" | "boolean" | "literal";
export interface Constraints {
  positive?: boolean;
  nonneg?: boolean;
  int?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
}
export interface FieldType {
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
  /** Human description (→ docs + form hint). */
  doc?: string;
  /** Doc-only unit hint, e.g. "project units". */
  unit?: string;
  /** Form label override (default: humanized name). */
  label?: string;
}

export function resolveFieldType(spec: FieldSpec): FieldType {
  const preset = PRESETS[spec.kind];
  if (!preset) throw new Error(`unknown field kind "${spec.kind}"`);
  const ft: FieldType = structuredClone(preset);
  if (spec.values) ft.values = spec.values;
  if (spec.required === false) ft.optional = true;
  return ft;
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

// ---- The common tail every primitive object carries (source form) -----------
// The RUNTIME zod equivalent (`commonShape`) lives in the editor shim; this string
// form is what `fieldsToZodSource` emits, and it must mirror that shape exactly.
export const COMMON_SOURCE_LINES = [
  "formulas: z.record(z.string(), z.string()).optional(),",
  "enabled: z.union([z.boolean(), z.number()]).optional(),",
  "layer: z.string().optional(),",
];

/** Emit the TS SOURCE for a primitive's strict Zod object schema (discriminated on
 *  `type`, plus the common tail) — the gen-primitives codegen writes this into the
 *  generated file, so it gives precise `z.infer` types. References `z` only. */
export function fieldsToZodSource(typeLiteral: string, fields: readonly FieldSpec[]): string {
  const lines = [
    `type: z.literal(${JSON.stringify(typeLiteral)}),`,
    ...COMMON_SOURCE_LINES,
    // A LEADING `// doc (unit)` comment (matching houseConfig's field style)
    // carries each field's semantics INTO the generated file, so the data-model
    // docs — parsed from these comments by gen-schema-doc — derive from `fields`
    // too: one source for schema, type, form AND docs.
    ...fields.flatMap((f) => {
      const line = `${f.name}: ${fieldTypeToSource(resolveFieldType(f))},`;
      const doc = fieldDoc(f);
      return doc ? [`// ${doc}`, line] : [line];
    }),
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

/** A field's human doc string: `doc (unit)`. Shared by the doc-row projection and
 *  the source emitter (which writes it as a `//` comment the doc generator reads). */
export function fieldDoc(f: FieldSpec): string {
  return [f.doc, f.unit ? `(${f.unit})` : ""].filter(Boolean).join(" ");
}

/** Project a primitive's `fields` to documentation rows (→ data-model docs). */
export function fieldsToDocRows(fields: readonly FieldSpec[]): DocRow[] {
  return fields.map((f) => ({
    field: f.name,
    type: docType(resolveFieldType({ ...f, required: true })),
    required: f.required !== false,
    doc: fieldDoc(f),
  }));
}

// ---- Projection: FieldSpec → form control -----------------------------------

/** A humanized default label for a field name: "z_offset" → "Z offset". */
export function humanize(name: string): string {
  const s = name.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Domain-neutral description of the form control a field needs. A view (Wadi's
 *  AutoForm) renders the concrete widget from this. */
export interface FormControlSpec {
  name: string;
  label: string;
  hint?: string;
  /** measure = number (formula-aware); text; select; flag. */
  control: "measure" | "text" | "select" | "flag";
  /** For "measure": min bound (positive→0.01, nonneg→0) + integer flag. */
  min?: number;
  integer?: boolean;
  /** Optional field → the control can be cleared to undefined. */
  allowEmpty: boolean;
  /** For "select": the options. */
  values?: readonly string[];
}

/** Project a field to its form control. Derived from the field's KIND, so a
 *  primitive gets a working form from `fields` alone; `label`/`doc` polish it. */
export function fieldToFormControl(spec: FieldSpec): FormControlSpec {
  const ft = resolveFieldType({ ...spec, required: true }); // ignore optionality for category
  const label = spec.label ?? humanize(spec.name);
  const hint = [spec.doc, spec.unit ? `(${spec.unit})` : ""].filter(Boolean).join(" ") || undefined;
  const allowEmpty = spec.required === false;
  const base = { name: spec.name, label, hint, allowEmpty };
  if (ft.union || ft.atom === "boolean") return { ...base, control: "flag" };
  if (ft.atom === "literal") return { ...base, control: "select", values: ft.values };
  if (ft.atom === "string") return { ...base, control: "text" };
  // number
  const min = ft.constraints?.positive ? 0.01 : ft.constraints?.nonneg ? 0 : undefined;
  return { ...base, control: "measure", min, integer: ft.constraints?.int };
}
