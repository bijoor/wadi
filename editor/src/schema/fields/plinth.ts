// `plinth` primitive (on the Plinth floor) — shape declared as `fields`. Carries
// an optional `material` (a per-primitive field, NOT the common tail). (P2b)
import type { FieldSpec } from "../../registry/fieldSchema";

export const plinthType = "plinth";

export const plinthFields: FieldSpec[] = [
  { name: "name", kind: "text", required: false, doc: "Label" },
  { name: "material", kind: "text", required: false, doc: "Material key" },
  { name: "x", kind: "coord", doc: "Top-left X", unit: "project units" },
  { name: "y", kind: "coord", doc: "Top-left Y", unit: "project units" },
  { name: "width", kind: "extent", doc: "X extent", unit: "project units" },
  { name: "length", kind: "extent", doc: "Y extent", unit: "project units" },
  { name: "height", kind: "extent", doc: "Plinth height", unit: "project units" },
  { name: "z_offset", kind: "coord", required: false, doc: "Lift above ground", unit: "project units" },
];
