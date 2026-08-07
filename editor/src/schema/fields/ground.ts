// `ground` plane (on the Plinth floor) — shape declared as `fields`. `height` is an
// optional non-negative thickness (0 = flat). Carries optional `material`. (P2b)
import type { FieldSpec } from "../../registry/fieldSchema";

export const groundType = "ground";

export const groundFields: FieldSpec[] = [
  { name: "name", kind: "text", required: false, doc: "Label" },
  { name: "material", kind: "text", required: false, doc: "Material key" },
  { name: "x", kind: "coord", doc: "Top-left X", unit: "project units" },
  { name: "y", kind: "coord", doc: "Top-left Y", unit: "project units" },
  { name: "width", kind: "extent", doc: "X extent", unit: "project units" },
  { name: "length", kind: "extent", doc: "Y extent", unit: "project units" },
  { name: "height", kind: "nonneg", required: false, doc: "Thickness (0 = flat)", unit: "project units" },
  { name: "z_offset", kind: "coord", required: false, doc: "Lift above origin", unit: "project units" },
];
