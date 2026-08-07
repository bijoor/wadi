// `beam` primitive — its shape declared ONCE as `fields` (the single source of
// truth). The gen-primitives codegen emits a typed Zod schema from this into
// schema/generated/objects.generated.ts; houseConfig imports that generated schema
// into the object union. (P2b; plans/primitive-componentization.md §2.3)
import type { FieldSpec } from "../../registry/fieldSchema";

export const beamType = "beam";

export const beamFields: FieldSpec[] = [
  { name: "name", kind: "text", required: false, doc: "Label" },
  { name: "x", kind: "coord", doc: "Top-left X", unit: "project units" },
  { name: "y", kind: "coord", doc: "Top-left Y", unit: "project units" },
  { name: "width", kind: "extent", doc: "X extent", unit: "project units" },
  { name: "length", kind: "extent", doc: "Y extent", unit: "project units" },
  { name: "height", kind: "extent", required: false, doc: "Vertical thickness", unit: "project units" },
  { name: "z_offset", kind: "coord", required: false, doc: "Lift above floor base", unit: "project units" },
];
