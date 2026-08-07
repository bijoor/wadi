// The node registry — a map of object `type` → NodeDefinition, plus the builtin
// registrations. Dispatchers import `getNode` / `allNodes` and consult it first.

import type { NodeDefinition } from "./types";
import { registerObjectSchema } from "../schema/houseConfig";
import { registerBuiltinRole } from "../state/layerDefaults";
import { itemNode } from "./nodes/item";

const REGISTRY = new Map<string, NodeDefinition>();

export function registerNode(def: NodeDefinition): void {
  REGISTRY.set(def.type, def);
  // Registration-push: a registered primitive contributes its schema + layer role
  // to the central lists WITHOUT those low-level modules importing the registry
  // (cycle). So a new primitive self-registers everywhere from its one node file.
  if (def.schema) registerObjectSchema(def.type, def.schema);
  if (def.layerRole) registerBuiltinRole(def.type, def.layerRole);
}

export function getNode(type: string): NodeDefinition | undefined {
  return REGISTRY.get(type);
}

export function allNodes(): NodeDefinition[] {
  return [...REGISTRY.values()];
}

/** Types offered in the "+ Add object" menu, in registration order. */
export function addableNodeTypes(): string[] {
  return allNodes().filter((d) => d.addable).map((d) => d.type);
}

// --- builtin registrations ---------------------------------------------------
// Legacy object types (room, wall, pillar, roof, …) still live on the per-type
// switches in the renderers; migrate them here opportunistically. `item` (GLB
// furniture) is fully registry-driven — the reference for future ports.
registerNode(itemNode);
