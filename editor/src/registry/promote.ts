// Promote a WDL component to a typed primitive at RUNTIME (plans/declarative-plugins.md
// P0). A `component` marked `expose as <ns.type>` becomes a first-class object type: its
// `params` project to `fields` (so it gets a schema, a form, docs, and DSL descriptors),
// and it registers a NodeDefinition whose `expand` stamps the component body by reusing
// the existing component expander. A pure composition primitive needs NO render code:
// it expands to core objects and the existing 3D/2D/quantities pipeline draws them.
//
// This is ADDITIVE and runtime: no base-code edit is needed to add such a primitive,
// which is the point. Registration is idempotent (last write per type wins); type names
// are namespaced (`pack.type`) to avoid clashing with core types.

import type { NodeDefinition, NodeExpandCtx } from "./types";
import type { FieldSpec } from "./fieldSchema";
import { fieldsToZod } from "./fieldSchema";
import { registerNode } from "./registry";
import { expandComponentDef, type ComponentDefLoose } from "../svg2d/expand";
import type { HouseConfig, HouseObject } from "../schema/houseConfig";
import type { LayerRole } from "../state/layerDefaults";

// The promotion metadata carried on a component's `expose` marker.
export interface ExposeMeta {
  type: string; // the promoted primitive type name (namespaced, e.g. "pack.water_tank")
  label?: string;
  layer?: string; // layer role for the promoted objects
}

// A component param, as authored (schema: componentParam). `kind`/`unit` are the
// optional field-projection annotations; when absent the kind is inferred.
interface ParamDecl {
  name: string;
  label?: string;
  description?: string;
  default?: number;
  kind?: string; // FieldKind preset (coord/extent/nonneg/int/text/flag/enum)
  unit?: string;
}
interface ExposedComponentDef extends ComponentDefLoose {
  params?: ParamDecl[];
  expose?: ExposeMeta;
}

// The placement + common fields a promoted primitive carries in addition to its params.
// (The common tail formulas/enabled/layer is added by fieldsToZod.)
const PLACEMENT_FIELDS: FieldSpec[] = [
  { name: "name", kind: "text", required: false, doc: "Label" },
  { name: "x", kind: "coord", required: false, doc: "Plan X", unit: "project units" },
  { name: "y", kind: "coord", required: false, doc: "Plan Y", unit: "project units" },
  { name: "rotation", kind: "coord", required: false, doc: "Yaw", unit: "degrees" },
  { name: "z_offset", kind: "coord", required: false, doc: "Lift above floor base", unit: "project units" },
];
const PLACEMENT_NAMES = new Set(PLACEMENT_FIELDS.map((f) => f.name));

/** Project a component's `params` to primitive `fields`: infer the kind from the
 *  default's type (number → coord, string → text), refine with an explicit `kind`
 *  annotation, and prepend the standard placement fields. */
export function paramsToFields(def: ExposedComponentDef): FieldSpec[] {
  const paramFields: FieldSpec[] = (def.params ?? []).map((p) => ({
    name: p.name,
    kind: p.kind ?? (typeof p.default === "number" ? "coord" : "text"),
    required: false, // a param always has a default; omit the field to use it
    label: p.label,
    doc: p.description,
    unit: p.unit,
  }));
  return [...PLACEMENT_FIELDS, ...paramFields];
}

/** Build a NodeDefinition for a component exposed as a typed primitive. Its `expand`
 *  stamps the captured component body via expandComponentDef; no render code, since
 *  the stamped core objects are drawn by the existing pipeline. */
export function promoteComponentToNode(def: ExposedComponentDef, meta: ExposeMeta): NodeDefinition {
  const fields = paramsToFields(def);
  const paramNames = (def.params ?? []).map((p) => p.name);
  const defaults: Record<string, number> = {};
  for (const p of def.params ?? []) if (typeof p.default === "number") defaults[p.name] = p.default;

  return {
    type: meta.type,
    label: meta.label ?? meta.type,
    addable: true,
    layerRole: meta.layer as LayerRole | undefined,
    fields,
    schema: fieldsToZod(meta.type, fields),
    makeDefault: () => ({ type: meta.type, x: 0, y: 0, ...defaults }) as unknown as HouseObject,
    expand: (obj: Record<string, unknown>, ctx: NodeExpandCtx): HouseObject[] => {
      const params: Record<string, number | string> = {};
      for (const k of paramNames) {
        const v = obj[k];
        if (typeof v === "number" || typeof v === "string") params[k] = v;
      }
      return expandComponentDef(
        def,
        {
          params,
          x: typeof obj.x === "number" ? obj.x : undefined,
          y: typeof obj.y === "number" ? obj.y : undefined,
          z_offset: typeof obj.z_offset === "number" ? obj.z_offset : undefined,
          rotation: typeof obj.rotation === "number" ? obj.rotation : undefined,
          ref: meta.type,
        },
        (ctx.houseConfig ?? { floors: [] }) as HouseConfig,
        ctx.wallThickness ?? 8,
        { lenient: ctx.lenient, onWarning: ctx.onWarning },
        ctx.depth ?? 0,
      ) as HouseObject[];
    },
  };
}

// Ignore keys that are placement/common, not params, when reading a config's params.
export const nonParamFields = PLACEMENT_NAMES;

// Built-in object type discriminators. A promoted type must not reuse one of these
// (it would shadow a core type in the registry-consult path). Kept in sync with the
// `object` discriminatedUnion in schema/houseConfig.ts; a guard test asserts it.
export const CORE_OBJECT_TYPES = new Set<string>([
  "plinth", "ground", "component", "item", "model", "floor_slab", "pillar", "beam",
  "room", "wall", "staircase", "spiral_staircase", "door", "window", "kitchen_platform",
  "roof",
]);

/** Scan a config's `components` for `expose`d definitions and register each as a
 *  typed primitive. Idempotent; call it when a config is loaded (before it is
 *  validated, expanded, or rendered). Returns the list of registered type names.
 *
 *  Guards (fail-closed: if ANY exposed type is invalid, nothing is registered and it
 *  throws with all the reasons):
 *   - the type must be NAMESPACED (contain a dot), e.g. `pack.water_tank`, so it can't
 *     collide with a core single-word type and reads as a plugin type;
 *   - it must not collide with a built-in object type;
 *   - two components in one config must not expose the same type. */
export function registerExposedComponents(config: HouseConfig | null | undefined): string[] {
  const comps = (config?.components ?? {}) as Record<string, ExposedComponentDef>;
  const errors: string[] = [];
  const seen = new Set<string>();
  const pending: Array<[ExposedComponentDef, ExposeMeta]> = [];
  for (const [name, def] of Object.entries(comps)) {
    const ex = def?.expose;
    if (!ex || typeof ex.type !== "string") continue;
    const type = ex.type;
    if (CORE_OBJECT_TYPES.has(type)) {
      errors.push(`component "${name}": exposed type "${type}" collides with a built-in object type`);
    } else if (!type.includes(".")) {
      errors.push(`component "${name}": exposed type "${type}" must be namespaced (contain a dot), e.g. "pack.${type}"`);
    } else if (seen.has(type)) {
      errors.push(`exposed type "${type}" is exposed by more than one component`);
    } else {
      seen.add(type);
      pending.push([def, ex]);
    }
  }
  if (errors.length) throw new Error(`invalid exposed primitive(s): ${errors.join("; ")}`);
  const registered: string[] = [];
  for (const [def, ex] of pending) {
    registerNode(promoteComponentToNode(def, ex));
    registered.push(ex.type);
  }
  return registered;
}
