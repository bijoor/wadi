// Aggregates geometry warnings from the TWO independent producers that run per
// render — expansion (House3D: dropped openings, bad walls) and roof derivation
// (V2RoofMesh: a roof that failed to build). Each pushes its own bucket; the
// merged union is published on window.__geometryWarnings and announced via the
// `wadi-geometry-warnings` CustomEvent that the viewer shell's banner listens
// for. Deduped so identical re-renders don't re-fire. Kept out of React's render
// pass (a module-level side effect, called from effects / memo tails).
//
// Before this, House3D owned the whole channel and a roof failure was only
// console.warn'd — so a broken roof rendered as NOTHING with no banner.

let expansion: string[] = [];
let roof: string[] = [];
let lastKey = "";

function publish(): void {
  const merged = [...expansion, ...roof];
  const key = merged.join("\n");
  if (key === lastKey) return;
  lastKey = key;
  if (typeof window === "undefined") return;
  const w = window as unknown as { __geometryWarnings?: string[]; __expandError?: unknown };
  w.__geometryWarnings = merged;
  // Back-compat: keep __expandError populated (an existing debug badge reads it).
  w.__expandError = merged.length ? merged[0] : null;
  window.dispatchEvent(new CustomEvent("wadi-geometry-warnings", { detail: merged }));
}

/** Expansion-stage warnings (House3D): dropped openings, unexpandable walls. */
export function setExpansionWarnings(warnings: string[]): void {
  expansion = warnings;
  publish();
}

/** Roof-derivation warnings (V2RoofMesh): a roof segment that failed to build. */
export function setRoofWarnings(warnings: string[]): void {
  roof = warnings;
  publish();
}
