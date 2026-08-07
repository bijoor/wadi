// `floor_slab` primitive — shape declared as `fields` (single source). (P2b)
import type { FieldSpec } from "../../registry/fieldSchema";

export const floorSlabType = "floor_slab";

export const floorSlabFields: FieldSpec[] = [
  { name: "name", kind: "text", required: false, doc: "Label" },
  { name: "x", kind: "coord", doc: "Top-left X", unit: "project units" },
  { name: "y", kind: "coord", doc: "Top-left Y", unit: "project units" },
  { name: "width", kind: "extent", doc: "X extent", unit: "project units" },
  { name: "length", kind: "extent", doc: "Y extent", unit: "project units" },
  { name: "thickness", kind: "nonneg", required: false, doc: "Slab thickness (defaults to floor's)", unit: "project units" },
  { name: "z_offset", kind: "coord", required: false, doc: "Lift above floor base", unit: "project units" },
];
