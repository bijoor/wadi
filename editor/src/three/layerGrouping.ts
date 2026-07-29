// Pure helpers for the Layers editor: treat the flat config.layers array as an
// ORDERED list of GROUPS, each an ordered list of layers. Group identity is the
// `group` field (blank → "Ungrouped"); group order + within-group order are the
// array order. Every op returns a NEW normalized flat array (groups contiguous),
// so the editor can round-trip through config.layers without drift.

import type { LayerDef } from "./layers";

export const UNGROUPED = "Ungrouped";

export function groupNameOf(l: LayerDef): string {
  return l.group && l.group.trim() ? l.group : UNGROUPED;
}

export interface LayerGroupBlock {
  name: string;
  layers: LayerDef[];
}

/** Bucket layers into ordered groups (first-appearance order). */
export function toGroups(layers: LayerDef[]): LayerGroupBlock[] {
  const order: string[] = [];
  const map = new Map<string, LayerDef[]>();
  for (const l of layers) {
    const g = groupNameOf(l);
    let arr = map.get(g);
    if (!arr) {
      arr = [];
      map.set(g, arr);
      order.push(g);
    }
    arr.push(l);
  }
  return order.map((name) => ({ name, layers: map.get(name)! }));
}

/** Flatten groups back to a normalized flat array (each layer's `group` set to
 *  its block; "Ungrouped" → undefined). Groups stay contiguous. */
export function fromGroups(grps: LayerGroupBlock[]): LayerDef[] {
  return grps.flatMap((g) =>
    g.layers.map((l) => ({ ...l, group: g.name === UNGROUPED ? undefined : g.name })),
  );
}

/** Move a whole group up (-1) or down (+1) relative to the other groups. */
export function moveGroup(layers: LayerDef[], name: string, dir: -1 | 1): LayerDef[] {
  const grps = toGroups(layers);
  const i = grps.findIndex((g) => g.name === name);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= grps.length) return layers;
  [grps[i], grps[j]] = [grps[j], grps[i]];
  return fromGroups(grps);
}

/** Move a layer up/down WITHIN its own group. */
export function moveLayerInGroup(layers: LayerDef[], id: string, dir: -1 | 1): LayerDef[] {
  const grps = toGroups(layers);
  for (const g of grps) {
    const i = g.layers.findIndex((l) => l.id === id);
    if (i < 0) continue;
    const j = i + dir;
    if (j < 0 || j >= g.layers.length) return layers;
    [g.layers[i], g.layers[j]] = [g.layers[j], g.layers[i]];
    return fromGroups(grps);
  }
  return layers;
}

/** Move a layer into another group (appended at the end). Target may be new.
 *  Empty source groups are dropped. */
export function moveLayerToGroup(layers: LayerDef[], id: string, targetGroup: string): LayerDef[] {
  const tgtName = targetGroup && targetGroup.trim() ? targetGroup : UNGROUPED;
  const grps = toGroups(layers);
  let moved: LayerDef | undefined;
  for (const g of grps) {
    const i = g.layers.findIndex((l) => l.id === id);
    if (i >= 0) {
      moved = g.layers.splice(i, 1)[0];
      break;
    }
  }
  if (!moved) return layers;
  let tgt = grps.find((g) => g.name === tgtName);
  if (!tgt) {
    tgt = { name: tgtName, layers: [] };
    grps.push(tgt);
  }
  tgt.layers.push(moved);
  return fromGroups(grps.filter((g) => g.layers.length > 0));
}

/** Rename a group (updates every layer in it). If the new name already exists,
 *  the two groups MERGE (source appended to the existing one). */
export function renameGroup(layers: LayerDef[], oldName: string, newName: string): LayerDef[] {
  const nn = newName.trim();
  if (!nn || nn === oldName) return layers;
  const grps = toGroups(layers);
  const src = grps.find((g) => g.name === oldName);
  if (!src) return layers;
  const existing = grps.find((g) => g.name === nn);
  if (existing && existing !== src) {
    existing.layers.push(...src.layers);
    return fromGroups(grps.filter((g) => g !== src));
  }
  src.name = nn;
  return fromGroups(grps);
}
