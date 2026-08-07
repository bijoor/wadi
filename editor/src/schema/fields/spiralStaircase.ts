// `spiral_staircase` — the FIRST primitive contributed end-to-end through the
// componentization framework (P5; plans/primitive-componentization.md). Its shape
// is declared ONCE as `fields`; from this single source the codegen emits the typed
// Zod schema (into the object union), the property-panel form (AutoForm), the
// data-model docs, and the DSL surface (generic ObjectDecl: positional args +
// validation, via the kernel seam wadi-dsl/src/generator/descriptors). The registry
// node (registry/nodes/spiralStaircase) adds the 3D + 2D capabilities.
import type { FieldSpec } from "../../registry/fieldSchema";

export const spiralStaircaseType = "spiral_staircase";

export const spiralStaircaseDoc =
  "A helical staircase: `steps` treads winding `turns` revolutions around a central pole, from the floor to `total_height`, within `radius`. Placed by its CENTRE (x, y). Optional fields fall back to sensible defaults at render time.";

export const spiralStaircaseFields: FieldSpec[] = [
  { name: "name", kind: "text", required: false, doc: "Label" },
  { name: "x", kind: "coord", doc: "Centre X", unit: "project units" },
  { name: "y", kind: "coord", doc: "Centre Y", unit: "project units" },
  { name: "radius", kind: "extent", doc: "Outer radius", unit: "project units" },
  { name: "total_height", kind: "extent", doc: "Total rise (floor to top step)", unit: "project units" },
  { name: "turns", kind: "extent", required: false, doc: "Revolutions (default 1)" },
  { name: "steps", kind: "int", required: false, doc: "Number of treads (default ~12 per turn)" },
  { name: "tread_thickness", kind: "extent", required: false, doc: "Tread slab thickness", unit: "project units" },
  { name: "pole_radius", kind: "extent", required: false, doc: "Central pole radius", unit: "project units" },
  { name: "z_offset", kind: "coord", required: false, doc: "Lift above floor base", unit: "project units" },
];
