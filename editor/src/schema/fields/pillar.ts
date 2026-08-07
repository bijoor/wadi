// `pillar` primitive — shape declared as `fields` (single source). `name` is
// REQUIRED; width/length may both be absent. (P2b)
import type { FieldSpec } from "../../registry/fieldSchema";

export const pillarType = "pillar";

export const pillarFields: FieldSpec[] = [
  { name: "name", kind: "text", doc: "Label" },
  { name: "x", kind: "coord", doc: "Top-left corner X", unit: "project units" },
  { name: "y", kind: "coord", doc: "Top-left corner Y", unit: "project units" },
  { name: "width", kind: "extent", required: false, doc: "X extent", unit: "project units" },
  { name: "length", kind: "extent", required: false, doc: "Y extent", unit: "project units" },
  { name: "height", kind: "extent", doc: "Column height", unit: "project units" },
  { name: "z_offset", kind: "coord", required: false, doc: "Lift above floor base", unit: "project units" },
];
