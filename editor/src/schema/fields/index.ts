// Registry of primitives whose Zod schema is GENERATED from `fields`. The
// gen-primitives codegen iterates this and emits schema/generated/objects.generated.ts;
// houseConfig imports the generated schemas into the object union. Add a primitive
// here (+ its *.fields.ts) and regenerate — no hand-written schema. (P2b)
import type { FieldSpec } from "../../registry/fieldSchema";
import { beamType, beamFields } from "./beam";

export interface PrimitiveFieldDecl {
  /** The object `type` discriminator + generated const name. */
  type: string;
  fields: FieldSpec[];
}

export const PRIMITIVE_FIELD_DECLS: PrimitiveFieldDecl[] = [
  { type: beamType, fields: beamFields },
];
