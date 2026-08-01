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

export function lintStructure(config: HouseConfig): LintFinding[] {
  const cfg = config as unknown as Bag;
  const floors = (cfg.floors as Bag[] | undefined) ?? [];
  const defaults = (cfg.defaults as Bag | undefined) ?? {};
  const wallTDefault = num(defaults.wall_thickness ?? DEFAULT_GLOBAL_CONFIG.wall_thickness);
  const slabDefault =
    defaults.slab_thickness != null ? num(defaults.slab_thickness) : DEFAULT_GLOBAL_CONFIG.floor_slab_thickness;

  const findings: LintFinding[] = [];
  // Room footprints across all floors — used for C2's exterior/interior verdict.
  const rects = buildRoomRects(config);

  for (const fl of floors) {
    const objs = activeObjects(fl);
    const fnum = num(fl.floor_number);

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
      for (const side of missing) {
        if (roomSideOpenToWeather(rects, num(o.x), num(o.y), num(o.width), num(o.length), side, wallT)) {
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
