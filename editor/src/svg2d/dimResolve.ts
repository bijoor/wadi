// Intelligent-dimensioning resolver — module-level state mirroring
// config.ts::setActiveDimFlags / setTextScale (a "set once per render pass"
// override). Used ONLY by the 2D Layout composite: `compositeSheet` calls
// beginDimResolve() before rendering and endDimResolve() in its finally, and
// each per-view renderer calls resetDimView() at the top of its pass.
//
// While INACTIVE (the standalone Floor Plan / Elevation tabs and the parity
// harness) every hook here is a strict no-op — resolveDim() returns the input
// offset unchanged and never skips — so those drawings stay byte-identical.
//
// Two behaviours, independently toggled:
//   • dedup   (Phase 2): skip a dimension whose (orientation + endpoints)
//              was already drawn in this view. Generalises floorPlan's
//              perimeter-skip to every chain so an inner chain re-measuring a
//              wall an outer chain already measured collapses. Keyed on
//              endpoints, NOT length, so two distinct equal-length walls stay.
//   • overlap (Phase 3): keep a registry of occupied label boxes and, for a
//              chain that opts into bumping (setDimBump), push its offset out
//              by `increment` until its label clears every registered box.
//              Chains that are already packed externally (outer / floor-extent
//              / opening) register their box but keep their offset
//              (register-don't-bump) so they aren't double-adjusted — emit
//              order (outer before inner) then lets inner bump around them.
//
// Label boxes are compared within ONE view's coordinate space only; the
// registry is cleared by resetDimView() between views, so a plan dimension can
// never be mistaken for an elevation one.

import { normalizeEdgeKey } from "./edges";

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface ResolveState {
  dedup: boolean;
  overlap: boolean;
  seen: Set<string>;
  boxes: Box[];
  // Per-block bump budget for the overlap pass. 0 → register-don't-bump.
  bumpLevels: number;
  bumpIncrement: number;
}

let state: ResolveState | null = null;

export function beginDimResolve(opts: { dedup: boolean; overlap: boolean }): void {
  // Nothing to do if neither behaviour is requested — leave the resolver
  // inactive so the render stays on the strict no-op path.
  if (!opts.dedup && !opts.overlap) {
    state = null;
    return;
  }
  state = {
    dedup: opts.dedup,
    overlap: opts.overlap,
    seen: new Set(),
    boxes: [],
    bumpLevels: 0,
    bumpIncrement: 0,
  };
}

export function endDimResolve(): void {
  state = null;
}

export function dimResolveActive(): boolean {
  return state !== null;
}

// Clear the per-view registry (seen keys + occupied boxes) at the top of each
// view's render so boxes are never compared across coordinate spaces. Also
// resets the bump budget. No-op when inactive.
export function resetDimView(): void {
  if (!state) return;
  state.seen = new Set();
  state.boxes = [];
  state.bumpLevels = 0;
  state.bumpIncrement = 0;
}

// Set the bump budget for the dimension calls that follow. A block that owns
// its own packing (outer perimeter, floor-extent, openings) leaves this at the
// default 0 so its boxes are registered but never moved; the inner-dimension
// block raises it so those single-offset dims fan out into stacked levels
// around everything already registered. No-op when inactive.
export function setDimBump(maxLevels: number, increment: number): void {
  if (!state) return;
  state.bumpLevels = Math.max(0, maxLevels);
  state.bumpIncrement = increment;
}

// Approximate the axis-aligned bounding box of a dimension's TEXT label, in
// the same coordinate space the SVG is drawn in. Mirrors the label-centre
// formulas in dimensions.ts (horizontal: centred at ((x1+x2)/2, textY);
// vertical: rotated −90° about (textX, (y1+y2)/2)). Font metrics are
// approximate — width ≈ chars × fontSize × 0.6 — so boxes are kept generous.
export function estimateLabelBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offset: number,
  isHorizontal: boolean,
  text: string,
  fontSize: number,
  gapAbove: number,
  gapBelow: number,
): Box {
  const textW = Math.max(1, text.length) * fontSize * 0.6;
  if (isHorizontal) {
    const dimY = y1 + offset;
    const textY = offset < 0 ? dimY - gapAbove : dimY + fontSize + gapBelow;
    const cx = (x1 + x2) / 2;
    // Baseline sits at textY; the glyph body extends up by ~fontSize.
    return { x0: cx - textW / 2, y0: textY - fontSize, x1: cx + textW / 2, y1: textY };
  }
  // Vertical: text rotated −90° about (textX, cy) → its long axis runs along
  // y, its short axis (≈fontSize) along x.
  const dimX = x1 + offset;
  const textX = offset < 0 ? dimX - fontSize - gapBelow : dimX + fontSize + gapBelow;
  const cy = (y1 + y2) / 2;
  return { x0: textX - fontSize / 2, y0: cy - textW / 2, x1: textX + fontSize / 2, y1: cy + textW / 2 };
}

function boxesOverlap(a: Box, b: Box): boolean {
  // A small negative slack (shrink) would allow near-touching; use 0 tolerance
  // so labels that merely graze are treated as clear.
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

export interface ResolveArgs {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  offset: number;
  isHorizontal: boolean;
  text: string;
  fontSize: number;
  gapAbove: number;
  gapBelow: number;
}

// Decide whether to draw this dimension and at what offset. Returns the input
// offset unchanged (and skip=false) whenever the resolver is inactive.
export function resolveDim(args: ResolveArgs): { skip: boolean; offset: number } {
  if (!state) return { skip: false, offset: args.offset };

  if (state.dedup) {
    const key =
      (args.isHorizontal ? "H|" : "V|") +
      normalizeEdgeKey(args.x1, args.y1, args.x2, args.y2);
    if (state.seen.has(key)) return { skip: true, offset: args.offset };
    state.seen.add(key);
  }

  let offset = args.offset;
  if (state.overlap) {
    const dir = offset < 0 ? -1 : 1;
    const inc = state.bumpIncrement || 0;
    let box = estimateLabelBox(
      args.x1, args.y1, args.x2, args.y2, offset, args.isHorizontal,
      args.text, args.fontSize, args.gapAbove, args.gapBelow,
    );
    if (state.bumpLevels > 0 && inc > 0) {
      let level = 0;
      while (level < state.bumpLevels && state.boxes.some((b) => boxesOverlap(box, b))) {
        offset += dir * inc;
        level += 1;
        box = estimateLabelBox(
          args.x1, args.y1, args.x2, args.y2, offset, args.isHorizontal,
          args.text, args.fontSize, args.gapAbove, args.gapBelow,
        );
      }
    }
    // Register the (possibly bumped) box so later dims steer around it.
    state.boxes.push(box);
  }

  return { skip: false, offset };
}
