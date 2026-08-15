// Resolve an opening's `anchor` (start | center | end) into the plain
// start-based `offset` every renderer already consumes. `start` (the default)
// is identity, so configs written before `anchor` existed are byte-unchanged.
//
// This is the single conversion boundary — like expandStaircase for stairs.
// expand.ts calls it once per wall (where the wall length is known), before
// validateOpenings + placement, so the 2D plan, elevation, and 3D CSG renderers
// stay untouched: they keep reading a start-based offset / the resolved x,y.
//
// Anchoring lets an opening hold its position when the wall or room scales,
// without writing a formula:
//   • start  — `offset` = distance from the wall START to the near edge (legacy).
//   • end    — `offset` = distance from the wall END to the far edge; 0 = flush.
//   • center — `offset` = signed shift of the opening CENTRE from the wall
//              midpoint (+ toward the wall end); 0 = centred.

export type OpeningAnchor = "start" | "center" | "end";

/** Effective distance from the wall START to the opening's near edge. */
export function openingStartOffset(
  anchor: OpeningAnchor | undefined,
  offset: number,
  width: number,
  wallLength: number,
): number {
  switch (anchor) {
    case "end":
      return wallLength - width - offset;
    case "center":
      return (wallLength - width) / 2 + offset;
    case "start":
    default:
      return offset;
  }
}

/**
 * Return `openings` with `anchor` resolved into a plain start-based `offset` and
 * the `anchor` key stripped. Non-object entries pass through untouched (they are
 * rejected later by validateOpenings). Openings anchored to `start` (or with no
 * anchor) are returned unchanged apart from dropping a redundant `anchor: "start"`.
 */
export function resolveOpeningAnchors<T extends Record<string, unknown>>(
  openings: readonly T[],
  wallLength: number,
): T[] {
  return openings.map((op) => {
    if (!op || typeof op !== "object") return op;
    const anchor = op.anchor as OpeningAnchor | undefined;
    if (anchor === undefined || anchor === "start") {
      if (!("anchor" in op)) return op;
      const { anchor: _drop, ...rest } = op;
      return rest as T;
    }
    const { anchor: _drop, ...rest } = op;
    return {
      ...rest,
      offset: openingStartOffset(
        anchor,
        Number(op.offset) || 0,
        Number(op.width) || 0,
        wallLength,
      ),
    } as unknown as T;
  });
}
