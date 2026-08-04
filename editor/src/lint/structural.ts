// Structural conventions linter for Wadi houses.
//
// The schema (Zod) + geometry pipeline catch configs that are ILL-FORMED. This
// module catches configs that are well-formed but STRUCTURALLY UNSOUND — they
// compile and render, but the building would not stand up / floats in mid-air /
// is open to the weather. These are the "coding conventions" a house must follow.
//
// The rules here are the executable form of `wadi-skill/architect/reference/
// conventions.md`; each finding carries the convention id (C1, C2, …) so the two
// stay in lockstep. Pure + synchronous (no bpy, no DOM) so it runs in the DSL
// editor, in the `check.sh` CLI, and in Node tests alike.
//
// Vertical model this relies on (see editor/src/three/coords.ts):
//   • A floor's base elevation = the SUM of the previous floors' `height` only.
//     `wall_height` and `slab_thickness` do NOT raise the next floor.
//   • The plinth BLOCK is drawn to its own `height`; if the plinth floor's
//     `height` ≠ that, the floor above floats/sinks by the difference.
//   • `slab_thickness` lifts a floor's walls WITHIN its band (wallZ = base +
//     slab_thickness); with no slab object the walls float by that amount.

import { DEFAULT_GLOBAL_CONFIG } from "../svg2d/config";
import { buildRoomRects, roomSideOpenToWeather, type Side } from "../estimate/wallArea";
import { expandRoomWalls } from "../svg2d/expand";
import type { HouseConfig } from "../schema/houseConfig";

export type LintLevel = "error" | "warn";

export interface LintFinding {
  /** Convention id, e.g. "C1" — matches conventions.md. */
  rule: string;
  level: LintLevel;
  message: string;
  /** floor_number, when the finding is floor-scoped. */
  floor?: number;
  /** object name / id / type, when object-scoped. */
  where?: string;
}

/** Registry of the conventions this linter enforces (kept in sync with the doc). */
export interface ConventionMeta {
  id: string;
  title: string;
  level: LintLevel;
}
export const CONVENTIONS: ConventionMeta[] = [
  { id: "C1", title: "The plinth floor's height must match the plinth block height", level: "error" },
  { id: "C2", title: "A room must wall every exterior side", level: "warn" },
  { id: "C3", title: "A floor with no slab must set slab_thickness to 0", level: "error" },
  { id: "C4", title: "A stacked floor's height should equal wall_height + slab_thickness", level: "warn" },
  { id: "C5", title: "A staircase must land on a floor, not below ground", level: "warn" },
  { id: "C6", title: "Openings on the same wall must not overlap", level: "error" },
  { id: "C7", title: "Furniture items should not overlap", level: "warn" },
];

type Bag = Record<string, unknown>;
const ALL_SIDES: Side[] = ["north", "south", "east", "west"];

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v) || 0;
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function floorLabel(fl: Bag): string {
  const nm = typeof fl.name === "string" && fl.name ? ` "${fl.name}"` : "";
  return `floor ${num(fl.floor_number)}${nm}`;
}
function objLabel(o: Bag): string {
  if (typeof o.name === "string" && o.name) return `"${o.name}"`;
  if (typeof o.id === "string" && o.id) return `"${o.id}"`;
  return String(o.type);
}
function activeObjects(fl: Bag): Bag[] {
  return ((fl.objects as Bag[] | undefined) ?? []).filter((o) => o.enabled !== false);
}

// A room shows exactly the walls it declares; a room with NO `walls` field is
// enclosed on all four sides (matches emitRoomWalls in House3D). This mirrors
// that read so the lint agrees with what the renderer draws.
function declaredSides(walls: unknown): "all" | Set<Side> {
  if (walls == null) return "all";
  if (Array.isArray(walls)) return new Set(walls as Side[]);
  if (typeof walls === "object") return new Set(Object.keys(walls as object) as Side[]);
  return "all";
}

// An axis-aligned wall segment: a line (horizontal or vertical) at `at`, spanning
// [lo, hi] along the other axis.
interface Seg {
  horiz: boolean;
  at: number;
  lo: number;
  hi: number;
}
function sideSegment(x: number, y: number, w: number, l: number, side: Side): Seg {
  if (side === "north") return { horiz: true, at: y, lo: x, hi: x + w };
  if (side === "south") return { horiz: true, at: y + l, lo: x, hi: x + w };
  if (side === "west") return { horiz: false, at: x, lo: y, hi: y + l };
  return { horiz: false, at: x + w, lo: y, hi: y + l }; // east
}

// Every wall segment present in the config: each room's DECLARED sides and every
// standalone wall. Used so C2 doesn't flag a room's exterior side that already
// has a wall on its line — e.g. a shared boundary walled by the neighbour, or an
// overlapping room whose wall runs along this side.
function collectWallSegments(floors: Bag[]): Seg[] {
  const segs: Seg[] = [];
  for (const fl of floors) {
    for (const o of activeObjects(fl)) {
      if (o.type === "room") {
        const declared = declaredSides(o.walls);
        const sides: Side[] = declared === "all" ? ALL_SIDES : [...declared];
        const x = num(o.x), y = num(o.y), w = num(o.width), l = num(o.length);
        for (const s of sides) segs.push(sideSegment(x, y, w, l, s));
      } else if (o.type === "wall") {
        const sx = num(o.start_x), sy = num(o.start_y), ex = num(o.end_x), ey = num(o.end_y);
        if (Math.abs(sy - ey) < 1) segs.push({ horiz: true, at: sy, lo: Math.min(sx, ex), hi: Math.max(sx, ex) });
        else if (Math.abs(sx - ex) < 1) segs.push({ horiz: false, at: sx, lo: Math.min(sy, ey), hi: Math.max(sy, ey) });
      }
    }
  }
  return segs;
}

// Is there already a wall on this side's line, covering it? (line coordinate
// within tolerance; a real overlap along the side.)
function sideHasWall(segs: Seg[], seg: Seg): boolean {
  for (const s of segs) {
    if (s.horiz !== seg.horiz) continue;
    if (Math.abs(s.at - seg.at) > 1.5) continue;
    if (Math.min(s.hi, seg.hi) - Math.max(s.lo, seg.lo) > 2) return true;
  }
  return false;
}

// ---- C6/C7 geometry helpers ------------------------------------------------

// One opening, projected onto its wall's world line: `at` = the perpendicular
// coordinate of the wall, [lo, hi] = the span the opening occupies along it.
interface OpSeg {
  horiz: boolean; // wall on a horizontal line (north/south) vs vertical (east/west)
  at: number;
  lo: number;
  hi: number;
  owner: string; // "room "Hall" south" / "wall "W1"" — the wall the opening is cut into
  label: string; // opening kind + name
}
function openLabel(op: Bag): string {
  const kind = typeof op.kind === "string" ? op.kind : "opening";
  const nm = typeof op.name === "string" && op.name ? ` "${op.name}"` : "";
  return `${kind}${nm}`;
}
// Every opening on a floor as a world-line segment. Openings live nested in each
// room's `walls[side].openings` (offset = the near edge measured from the room's
// start corner: north/south from x, east/west from y) and in a standalone wall's
// `openings` (offset from the wall's lower-coordinate end).
function collectOpeningSegs(objs: Bag[]): OpSeg[] {
  const out: OpSeg[] = [];
  for (const o of objs) {
    if (o.type === "room") {
      const walls = o.walls;
      if (!walls || typeof walls !== "object" || Array.isArray(walls)) continue;
      const rx = num(o.x), ry = num(o.y), rw = num(o.width), rl = num(o.length);
      for (const side of ALL_SIDES) {
        const ops = (walls as Record<string, { openings?: Bag[] }>)[side]?.openings;
        if (!Array.isArray(ops)) continue;
        for (const op of ops) {
          const off = num(op.offset), w = num(op.width);
          const owner = `room ${objLabel(o)} ${side}`;
          const label = openLabel(op);
          if (side === "north") out.push({ horiz: true, at: ry, lo: rx + off, hi: rx + off + w, owner, label });
          else if (side === "south") out.push({ horiz: true, at: ry + rl, lo: rx + off, hi: rx + off + w, owner, label });
          else if (side === "west") out.push({ horiz: false, at: rx, lo: ry + off, hi: ry + off + w, owner, label });
          else out.push({ horiz: false, at: rx + rw, lo: ry + off, hi: ry + off + w, owner, label });
        }
      }
    } else if (o.type === "wall") {
      const ops = o.openings;
      if (!Array.isArray(ops)) continue;
      const sx = num(o.start_x), sy = num(o.start_y), ex = num(o.end_x), ey = num(o.end_y);
      const horiz = Math.abs(sy - ey) < 1, vert = Math.abs(sx - ex) < 1;
      if (!horiz && !vert) continue; // diagonal wall — skip
      const start = horiz ? Math.min(sx, ex) : Math.min(sy, ey);
      for (const op of ops as Bag[]) {
        const off = num(op.offset), w = num(op.width);
        out.push({ horiz, at: horiz ? sy : sx, lo: start + off, hi: start + off + w, owner: `wall ${objLabel(o)}`, label: openLabel(op) });
      }
    }
  }
  return out;
}

// Convert a metric length to project units using the config's own display units
// (checkWdl doesn't set the render-time global that svg2d/format reads, so do it
// locally). Default 10 units = 1 ft (feet_inches), matching the item footprint.
const FEET_PER_METER = 3.280839895;
const FEET_PER_DISPLAY: Record<string, number> = {
  feet_inches: 1, feet: 1, meters: 3.280839895, centimeters: 0.032808399, millimeters: 0.003280839,
};
function itemMetersToUnits(m: number, units?: { system?: string; per_unit?: number }): number {
  const perUnit = units?.per_unit ?? 10;
  const fpu = FEET_PER_DISPLAY[units?.system ?? "feet_inches"] ?? 1;
  return m * (perUnit / fpu) * FEET_PER_METER;
}
// Axis-aligned footprint (plan) of a resolved item, accounting for yaw — the same
// rotated-bbox half-extents anchorItem uses, so it agrees with the drawn piece.
interface Box { x0: number; y0: number; x1: number; y1: number; }
function itemBox(it: Bag, units?: { system?: string; per_unit?: number }): Box | null {
  const asset = it.asset as { dimensions?: [number, number, number] } | undefined;
  if (!asset?.dimensions) return null;
  const scale = it.scale != null ? num(it.scale) : 1;
  const fw = itemMetersToUnits(asset.dimensions[0], units) * scale;
  const fd = itemMetersToUnits(asset.dimensions[2], units) * scale;
  const th = (num(it.rotation) * Math.PI) / 180;
  const c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th));
  const hx = (fw / 2) * c + (fd / 2) * s;
  const hy = (fw / 2) * s + (fd / 2) * c;
  const cx = num(it.x), cy = num(it.y);
  return { x0: cx - hx, y0: cy - hy, x1: cx + hx, y1: cy + hy };
}

export function lintStructure(config: HouseConfig): LintFinding[] {
  const cfg = config as unknown as Bag;
  const floors = (cfg.floors as Bag[] | undefined) ?? [];
  const defaults = (cfg.defaults as Bag | undefined) ?? {};
  const wallTDefault = num(defaults.wall_thickness ?? DEFAULT_GLOBAL_CONFIG.wall_thickness);
  const slabDefault =
    defaults.slab_thickness != null ? num(defaults.slab_thickness) : DEFAULT_GLOBAL_CONFIG.floor_slab_thickness;
  const floorHeightDefault =
    defaults.floor_height != null ? num(defaults.floor_height) : DEFAULT_GLOBAL_CONFIG.floor_height;
  const wallHeightDefault =
    defaults.wall_height != null ? num(defaults.wall_height) : DEFAULT_GLOBAL_CONFIG.wall_height;

  const findings: LintFinding[] = [];
  // Room footprints across all floors — used for C2's exterior/interior verdict.
  const rects = buildRoomRects(config);
  // Every declared wall segment — so C2 can tell a truly-open exterior side from
  // one already walled by a neighbour / overlapping room / standalone wall.
  const wallSegs = collectWallSegments(floors);

  // Furniture (C7) is resolved: anchored/room-nested items only get x/y after
  // expansion. Expand once, leniently, and index the flattened items per floor;
  // if the geometry is too broken to expand, skip the furniture check (the
  // geometry pipeline reports that separately).
  const units = cfg.units as { system?: string; per_unit?: number } | undefined;
  let expandedFloors: Bag[] = [];
  try {
    expandedFloors = ((expandRoomWalls(config, undefined, { lenient: true }) as unknown as Bag).floors as Bag[]) ?? [];
  } catch {
    expandedFloors = [];
  }

  // Running base elevation of each floor (sum of the heights below it) — the same
  // stack computeFloorZBands uses, for the C5 staircase-depth check.
  let baseZ = 0;

  for (let fi = 0; fi < floors.length; fi++) {
    const fl = floors[fi];
    const objs = activeObjects(fl);
    const fnum = num(fl.floor_number);
    const floorBaseZ = baseZ;
    baseZ += fl.height != null ? num(fl.height) : floorHeightDefault;

    // ---- C1: the plinth floor's height must match the plinth block height ----
    // Floor N+1 sits at the running sum of floor `height`s; the plinth block
    // rises to its own `height`. They must be equal or the floor above floats.
    const plinths = objs.filter((o) => o.type === "plinth");
    if (plinths.length) {
      const fh = fl.height;
      if (fh == null) {
        findings.push({
          rule: "C1",
          level: "error",
          floor: fnum,
          message:
            `${cap(floorLabel(fl))} carries a plinth but sets no explicit floor \`height\`; it falls back to the ` +
            `default (${DEFAULT_GLOBAL_CONFIG.floor_height}), so the floor above will not sit on the plinth. ` +
            `Set this floor's \`height\` equal to the plinth height.`,
        });
      }
      for (const p of plinths) {
        const ph = p.height;
        if (ph == null) continue; // plinth with no height follows the floor height — consistent
        if (fh != null && Math.abs(num(fh) - num(ph)) > 1e-3) {
          const diff = num(fh) - num(ph);
          findings.push({
            rule: "C1",
            level: "error",
            floor: fnum,
            where: objLabel(p),
            message:
              `${cap(floorLabel(fl))}: floor \`height\` (${num(fh)}) ≠ plinth ${objLabel(p)} height (${num(ph)}). ` +
              `The floor above ${diff > 0 ? "floats" : "sinks into the plinth by"} ${Math.abs(diff)} units. ` +
              `Make the floor height and the plinth height equal.`,
          });
        }
      }
    }

    // ---- C3: a floor with no slab must set slab_thickness to 0 ----
    // slab_thickness lifts this floor's walls within the band (wallZ = base +
    // slab_thickness). With no slab object there is no deck to sit on, so the
    // walls float by that amount.
    const hasSlab = objs.some((o) => o.type === "floor_slab");
    const deckObjs = objs.filter((o) => o.type === "room" || o.type === "wall");
    if (!hasSlab && deckObjs.length) {
      const explicit = fl.slab_thickness;
      const eff = explicit != null ? num(explicit) : slabDefault;
      if (eff !== 0) {
        findings.push({
          rule: "C3",
          level: "error",
          floor: fnum,
          message:
            `${cap(floorLabel(fl))} has ${deckObjs.length} wall/room object${deckObjs.length === 1 ? "" : "s"} ` +
            `but no floor slab, yet slab_thickness is ${eff}${explicit == null ? " (default)" : ""}. ` +
            `The walls float ${eff} units above the floor base. Set \`slab_thickness 0\` on this floor, or add a \`slab\`.`,
        });
      }
    }

    // ---- C4: a stacked floor's height should equal wall_height + slab_thickness ----
    // The next floor sits at base + height; this floor's walls stand on the deck
    // and reach base + slab_thickness + wall_height. When those differ, the floor
    // above leaves a gap over the walls (or the walls poke through it). Only
    // applies to an OCCUPIED floor that carries a floor above it; the plinth floor
    // is governed by C1 instead.
    const hasFloorAbove = fi < floors.length - 1;
    if (deckObjs.length && hasFloorAbove && !plinths.length) {
      const h = fl.height != null ? num(fl.height) : floorHeightDefault;
      const wh = fl.wall_height != null ? num(fl.wall_height) : wallHeightDefault;
      const st = fl.slab_thickness != null ? num(fl.slab_thickness) : slabDefault;
      const gap = h - (wh + st);
      if (Math.abs(gap) > 1e-3) {
        findings.push({
          rule: "C4",
          level: "warn",
          floor: fnum,
          message:
            `${cap(floorLabel(fl))}: floor height (${h}) ≠ wall_height (${wh}) + slab_thickness (${st}) = ${wh + st}. ` +
            (gap > 0
              ? `The floor above leaves a ${gap}-unit gap over the walls. `
              : `The walls poke ${Math.abs(gap)} units through the floor above. `) +
            `Set height = wall_height + slab_thickness (or adjust them) unless the gap is intentional.`,
        });
      }
    }

    // ---- C5: a staircase must land on a floor, not below ground ----
    // Staircases are TOP-anchored: put them on the UPPER floor and they DESCEND to
    // the floor below. Placed on the wrong floor (or with too big a height), the
    // expanded flight lands BELOW the ground plane — it draws in 2D plans but is
    // buried (invisible) in 3D, with no other error. Recompute the bottom z the
    // way expand.ts/stairExpand do and flag a below-ground landing.
    for (const o of objs) {
      if (o.type !== "staircase") continue;
      const riser = num(o.step_rise);
      if (riser <= 0) continue;
      const belowH =
        fi > 0 && floors[fi - 1].height != null ? num(floors[fi - 1].height) : floorHeightDefault;
      const riseHeight = o.rise_height != null && num(o.rise_height) > 0 ? num(o.rise_height) : belowH;
      const totalRise = Math.max(1, Math.round(riseHeight / riser)) * riser;
      const slabT = fl.slab_thickness != null ? num(fl.slab_thickness) : slabDefault;
      const topZ = o.z_offset != null ? num(o.z_offset) : slabT;
      const bottomZ = floorBaseZ + (topZ - totalRise);
      if (bottomZ < -1) {
        findings.push({
          rule: "C5",
          level: "warn",
          floor: fnum,
          where: objLabel(o),
          message:
            `Staircase ${objLabel(o)} on ${floorLabel(fl)} descends to z=${Math.round(bottomZ)} — below the ground ` +
            `plane, so it draws in 2D plans but is buried (invisible) in 3D. Staircases are TOP-anchored: place them ` +
            `on the UPPER floor and they DESCEND to the floor below (\`direction\` is the descent). Move it up a floor ` +
            `or reduce total_height.`,
        });
      }
    }

    // ---- C2: a room must wall every EXTERIOR side ----
    // A side that faces outside (no room beyond it) but carries no wall leaves
    // the room open to the weather. Interior (shared) sides may be omitted.
    for (const o of objs) {
      if (o.type !== "room") continue;
      const declared = declaredSides(o.walls);
      if (declared === "all") continue;
      const missing = ALL_SIDES.filter((s) => !declared.has(s));
      if (!missing.length) continue;
      const wallT = num(o.wall_thickness ?? o.thickness ?? wallTDefault);
      const rx = num(o.x), ry = num(o.y), rw = num(o.width), rl = num(o.length);
      for (const side of missing) {
        // Already walled on this line (by a neighbour / overlapping room / standalone
        // wall)? Then it isn't open, even though this room doesn't declare it.
        if (sideHasWall(wallSegs, sideSegment(rx, ry, rw, rl, side))) continue;
        if (roomSideOpenToWeather(rects, rx, ry, rw, rl, side, wallT)) {
          findings.push({
            rule: "C2",
            level: "warn",
            floor: fnum,
            where: objLabel(o),
            message:
              `Room ${objLabel(o)} on ${floorLabel(fl)}: the ${side} side faces outside but has no wall — ` +
              `the room is open to the weather there. Add \`wall ${side}\` unless this side is intentionally ` +
              `open (e.g. a verandah).`,
          });
        }
      }
    }

    // ---- C6: openings on the same wall must not overlap ----
    // Two openings whose spans overlap along a wall can't both be cut — the hole
    // merges/collides. Openings from TWO rooms sharing a boundary wall land on the
    // same world line, so this catches that too. Adjacent (touching) openings are
    // fine; only a real overlap (> 1 unit) is flagged.
    {
      const segs = collectOpeningSegs(objs);
      const OVERLAP = 1; // units; ignore float-noise / edge-touching
      for (let a = 0; a < segs.length; a++) {
        for (let b = a + 1; b < segs.length; b++) {
          const A = segs[a], B = segs[b];
          if (A.horiz !== B.horiz) continue;
          if (Math.abs(A.at - B.at) > 1.5) continue; // different wall lines
          const overlap = Math.min(A.hi, B.hi) - Math.max(A.lo, B.lo);
          if (overlap <= OVERLAP) continue;
          const by = Math.round(overlap);
          findings.push({
            rule: "C6",
            level: "error",
            floor: fnum,
            where: A.owner,
            message:
              A.owner === B.owner
                ? `${cap(floorLabel(fl))}: ${A.label} and ${B.label} overlap by ~${by} units on ${A.owner}. ` +
                  `Two openings can't occupy the same span of a wall — move or narrow one.`
                : `${cap(floorLabel(fl))}: ${A.label} on ${A.owner} overlaps ${B.label} on ${B.owner} by ~${by} units — ` +
                  `they sit on the same shared wall and collide. Offset or resize one.`,
          });
        }
      }
    }

    // ---- C7: furniture items should not overlap (warning) ----
    // Overlapping footprints are usually a placement mistake, but can be intended
    // (a rug under a table, stacked items), so this is a warning, not an error.
    // Uses the RESOLVED items (anchored ones only have coords post-expansion).
    {
      const expObjs = ((expandedFloors[fi]?.objects as Bag[] | undefined) ?? []).filter(
        (o) => o.type === "item" && o.enabled !== false,
      );
      const boxes = expObjs.map((o) => ({ o, box: itemBox(o, units) })).filter((e) => e.box) as {
        o: Bag; box: Box;
      }[];
      const MARGIN = 2; // units; both axes must overlap by more than this
      for (let a = 0; a < boxes.length; a++) {
        for (let b = a + 1; b < boxes.length; b++) {
          const A = boxes[a], B = boxes[b];
          const ox = Math.min(A.box.x1, B.box.x1) - Math.max(A.box.x0, B.box.x0);
          const oy = Math.min(A.box.y1, B.box.y1) - Math.max(A.box.y0, B.box.y0);
          if (ox <= MARGIN || oy <= MARGIN) continue;
          findings.push({
            rule: "C7",
            level: "warn",
            floor: fnum,
            where: objLabel(A.o),
            message:
              `${cap(floorLabel(fl))}: furniture ${objLabel(A.o)} and ${objLabel(B.o)} overlap ` +
              `(~${Math.round(ox)}×${Math.round(oy)} units). Reposition one if that isn't intentional.`,
          });
        }
      }
    }
  }

  return findings;
}

/** Convenience: split findings by level. */
export function partitionFindings(findings: LintFinding[]): { errors: LintFinding[]; warnings: LintFinding[] } {
  return {
    errors: findings.filter((f) => f.level === "error"),
    warnings: findings.filter((f) => f.level === "warn"),
  };
}

/** Human one-line render of a finding (used by CLIs and the editor status). */
export function formatFinding(f: LintFinding): string {
  const icon = f.level === "error" ? "✖" : "⚠";
  return `${icon} [${f.rule}] ${f.message}`;
}
