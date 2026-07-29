// Parametric resolver (plans/object-relationships-plan.md, Phase 1).
//
// One directional pass: resolve house `variables` + `points` (which may
// reference each other) via a topological order, then evaluate each object's
// `formulas` and write the resulting numbers into the object's numeric fields.
// Object formulas reference only variables/points (not other objects) in v1,
// so objects need no ordering among themselves.
//
// Design contract:
//   * NEVER throws — any unexpected error returns the original config + a
//     single warning.
//   * FAST PATH — a house with no variables/points and no object formulas is
//     returned by REFERENCE (zero cost, no spurious re-render).
//   * Idempotent — resolving an already-resolved config yields identical
//     numbers.
//   * Only OBJECT numeric fields are written. `variables`/`points` keep their
//     authored value (which may be a "= formula" string) — they are the source
//     of truth, so we must not overwrite them with their resolved number.

import type { HouseConfig } from "../schema/houseConfig";
import { evalFormula, formulaDeps, type Scope } from "./formula";
import type { FormulaWarning } from "./warnings";

export type { FormulaWarning } from "./warnings";

export interface ResolveResult {
  config: HouseConfig;
  warnings: FormulaWarning[];
}

// A house-level symbol (a variable, or a point field "P.x" / "P.y").
interface Sym {
  key: string;
  where: string;
  src: string | null; // formula source (with "=") or null for a literal
  literal: number | null; // literal value or null
  deps: string[];
}

function isFormula(v: unknown): v is string {
  return typeof v === "string" && v.trimStart().startsWith("=");
}

// Collect every house-level symbol from variables + points.
function collectSymbols(config: HouseConfig): Sym[] {
  const syms: Sym[] = [];
  const vars = (config as { variables?: Record<string, number | string> }).variables;
  if (vars) {
    for (const [name, val] of Object.entries(vars)) {
      if (isFormula(val)) {
        syms.push({ key: name, where: `variables/${name}`, src: val, literal: null, deps: formulaDeps(val) });
      } else if (typeof val === "number") {
        syms.push({ key: name, where: `variables/${name}`, src: null, literal: val, deps: [] });
      } else {
        // A non-"=" string in a variable slot is a user error (can't be a number).
        syms.push({ key: name, where: `variables/${name}`, src: null, literal: null, deps: [] });
      }
    }
  }
  const pts = (config as { points?: Record<string, { x: number | string; y: number | string }> }).points;
  if (pts) {
    // A point is just a pair of numbers, so its two coordinates are each
    // referenceable multiple ways (case-insensitive suffix): `.x`/`.w` (first)
    // and `.y`/`.l` (second), in either case. This lets a point double as an
    // in-plan rectangle SIZE reference (P.W / P.L) without a separate structure.
    // (Not `.h` — height is the z axis, distinct from the plan.) All spellings
    // are the SAME symbol value; the synonyms share the primary's `where` tag
    // so an error maps to the edited field.
    const SYNONYMS: Record<"x" | "y", readonly string[]> = {
      x: ["x", "X", "w", "W"],
      y: ["y", "Y", "l", "L"],
    };
    for (const [pname, pt] of Object.entries(pts)) {
      for (const axis of ["x", "y"] as const) {
        const val = pt[axis];
        const where = `points/${pname}.${axis}`;
        for (const alias of SYNONYMS[axis]) {
          const key = `${pname}.${alias}`;
          if (isFormula(val)) {
            syms.push({ key, where, src: val, literal: null, deps: formulaDeps(val) });
          } else if (typeof val === "number") {
            syms.push({ key, where, src: null, literal: val, deps: [] });
          } else {
            syms.push({ key, where, src: null, literal: null, deps: [] });
          }
        }
      }
    }
  }
  return syms;
}

// Topologically order symbols by dependency (deps that aren't symbols are
// ignored here — they surface as eval-time "unknown" errors). Returns the
// order plus the set of keys caught in a cycle.
function topoOrder(syms: Sym[]): { order: Sym[]; cyclic: Set<string> } {
  const byKey = new Map(syms.map((s) => [s.key, s]));
  const state = new Map<string, 0 | 1 | 2>(); // 0/undef=unvisited, 1=on-stack, 2=done
  const order: Sym[] = [];
  const cyclic = new Set<string>();

  const visit = (s: Sym): void => {
    const st = state.get(s.key);
    if (st === 2) return;
    if (st === 1) {
      cyclic.add(s.key);
      return;
    }
    state.set(s.key, 1);
    for (const d of s.deps) {
      const dep = byKey.get(d);
      if (dep) visit(dep);
    }
    // If we became cyclic via a back-edge, still mark done to avoid re-walking.
    state.set(s.key, 2);
    order.push(s);
  };

  for (const s of syms) visit(s);
  return { order, cyclic };
}

// Does a container carry any formulas?
function hasFormulas(c: unknown): boolean {
  const fm = (c as { formulas?: Record<string, string> } | null | undefined)?.formulas;
  return !!fm && Object.keys(fm).length > 0;
}

// Openings are nested one level down (wall.openings / room.walls[side].openings)
// and carry their own `formulas` maps. Yield each opening list on an object so
// detection can walk them; resolution rebuilds immutably in resolveOpenings.
function openingLists(obj: unknown): unknown[][] {
  const o = obj as Record<string, unknown> | null | undefined;
  if (!o) return [];
  if (o.type === "wall" && Array.isArray(o.openings)) return [o.openings as unknown[]];
  if (o.type === "room") {
    const walls = o.walls as Record<string, { openings?: unknown[] }> | undefined;
    if (walls && !Array.isArray(walls) && typeof walls === "object") {
      return Object.values(walls)
        .map((wc) => wc?.openings)
        .filter((ops): ops is unknown[] => Array.isArray(ops));
    }
  }
  return [];
}

function hasOpeningFormulas(obj: unknown): boolean {
  return openingLists(obj).some((ops) => ops.some(hasFormulas));
}

// A roof carries a `segments[]` array, a `slope` object, and a `trusses[]`
// array, each of which can hold its own `formulas` (segment width / overhangs /
// setbacks; slope ridge_h; truss positions_along[i] via pos0/pos1/… keys).
function hasRoofNestedFormulas(obj: unknown): boolean {
  const o = obj as Record<string, unknown> | null | undefined;
  if (o?.type !== "roof") return false;
  const segs = o.segments;
  if (Array.isArray(segs) && segs.some(hasFormulas)) return true;
  const trusses = o.trusses;
  if (Array.isArray(trusses) && trusses.some(hasFormulas)) return true;
  return hasFormulas(o.slope);
}

// A segment's `start`/`end` are [x,y] arrays; their coordinates are driven by
// the synthetic formula keys start_x/start_y/end_x/end_y (there's no scalar field
// to write, so these map INTO the array). Everything else is a plain scalar field.
const SEGMENT_POINT_KEYS: Record<string, ["start" | "end", 0 | 1]> = {
  start_x: ["start", 0],
  start_y: ["start", 1],
  end_x: ["end", 0],
  end_y: ["end", 1],
};

// Resolve one roof segment's formulas — scalar fields write in place; point-coord
// keys write into the start/end arrays. Immutable; same ref when unchanged.
function resolveSegment(
  seg: unknown,
  scope: Scope,
  warnings: FormulaWarning[],
  where: string,
): { value: unknown; changed: boolean } {
  const s = seg as Record<string, unknown> | null | undefined;
  const fm = s?.formulas as Record<string, string> | undefined;
  if (!s || !fm || Object.keys(fm).length === 0) return { value: seg, changed: false };
  let changed = false;
  const next: Record<string, unknown> = { ...s };
  const start = Array.isArray(s.start) ? [...(s.start as number[])] : undefined;
  const end = Array.isArray(s.end) ? [...(s.end as number[])] : undefined;
  for (const [field, src] of Object.entries(fm)) {
    const r = evalFormula(src, scope);
    if (r.value === null) {
      warnings.push({ where: `${where}/${field}`, formula: src, message: r.error ?? "invalid formula" });
      continue;
    }
    const pc = SEGMENT_POINT_KEYS[field];
    if (pc) {
      const arr = pc[0] === "start" ? start : end;
      if (arr && arr[pc[1]] !== r.value) { arr[pc[1]] = r.value; changed = true; }
    } else {
      const v = INTEGER_FIELDS.has(field) ? Math.round(r.value) : r.value;
      if (next[field] !== v) { next[field] = v; changed = true; }
    }
  }
  if (!changed) return { value: seg, changed: false };
  if (start) next.start = start;
  if (end) next.end = end;
  return { value: next, changed: true };
}

// A truss entry's `positions_along` is a number[]; each index is driven by a
// synthetic formula key `pos<i>` (no scalar field to write, so it maps INTO the
// array — like a segment's start/end coords). Immutable; same ref when unchanged.
function resolveTruss(
  truss: unknown,
  scope: Scope,
  warnings: FormulaWarning[],
  where: string,
): { value: unknown; changed: boolean } {
  const t = truss as Record<string, unknown> | null | undefined;
  const fm = t?.formulas as Record<string, string> | undefined;
  if (!t || !fm || Object.keys(fm).length === 0) return { value: truss, changed: false };
  const positions = Array.isArray(t.positions_along) ? [...(t.positions_along as number[])] : [];
  let changed = false;
  for (const [field, src] of Object.entries(fm)) {
    const r = evalFormula(src, scope);
    if (r.value === null) {
      warnings.push({ where: `${where}/${field}`, formula: src, message: r.error ?? "invalid formula" });
      continue;
    }
    const m = /^pos(\d+)$/.exec(field);
    if (m) {
      const idx = Number(m[1]);
      if (idx < positions.length && positions[idx] !== r.value) { positions[idx] = r.value; changed = true; }
    }
  }
  return changed ? { value: { ...t, positions_along: positions }, changed: true } : { value: truss, changed: false };
}

function resolveRoofNested(
  obj: unknown,
  scope: Scope,
  warnings: FormulaWarning[],
  where: string,
): { value: unknown; changed: boolean } {
  const o = obj as Record<string, unknown>;
  if (o?.type !== "roof") return { value: obj, changed: false };
  let changed = false;
  const patch: Record<string, unknown> = {};
  if (Array.isArray(o.segments)) {
    let segChanged = false;
    const next = (o.segments as unknown[]).map((s, i) => {
      const r = resolveSegment(s, scope, warnings, `${where}/seg${i}`);
      if (r.changed) segChanged = true;
      return r.value;
    });
    if (segChanged) { patch.segments = next; changed = true; }
  }
  if (Array.isArray(o.trusses)) {
    let tChanged = false;
    const next = (o.trusses as unknown[]).map((t, i) => {
      const r = resolveTruss(t, scope, warnings, `${where}/truss${i}`);
      if (r.changed) tChanged = true;
      return r.value;
    });
    if (tChanged) { patch.trusses = next; changed = true; }
  }
  if (o.slope && typeof o.slope === "object") {
    const r = applyContainerFormulas(o.slope, scope, warnings, `${where}/slope`);
    if (r.changed) { patch.slope = r.value; changed = true; }
  }
  return changed ? { value: { ...o, ...patch }, changed: true } : { value: obj, changed: false };
}

// Resolve every opening's `formulas` on an object (wall / room). Rebuilds the
// object (and its walls dict) immutably only when something actually changed.
function resolveOpenings(
  obj: unknown,
  scope: Scope,
  warnings: FormulaWarning[],
  where: string,
): { value: unknown; changed: boolean } {
  const o = obj as Record<string, unknown>;
  if (o?.type === "wall" && Array.isArray(o.openings)) {
    let changed = false;
    const next = (o.openings as unknown[]).map((op, i) => {
      const r = applyContainerFormulas(op, scope, warnings, `${where}/opening${i}`);
      if (r.changed) changed = true;
      return r.value;
    });
    return changed ? { value: { ...o, openings: next }, changed: true } : { value: obj, changed: false };
  }
  if (o?.type === "room") {
    const walls = o.walls as Record<string, { openings?: unknown[] }> | undefined;
    if (!walls || Array.isArray(walls) || typeof walls !== "object") return { value: obj, changed: false };
    let changed = false;
    const nextWalls: Record<string, unknown> = {};
    for (const [side, wc] of Object.entries(walls)) {
      const ops = wc?.openings;
      if (!Array.isArray(ops)) { nextWalls[side] = wc; continue; }
      let sideChanged = false;
      const nextOps = ops.map((op, i) => {
        const r = applyContainerFormulas(op, scope, warnings, `${where}/${side}/opening${i}`);
        if (r.changed) sideChanged = true;
        return r.value;
      });
      nextWalls[side] = sideChanged ? { ...wc, openings: nextOps } : wc;
      if (sideChanged) changed = true;
    }
    return changed ? { value: { ...o, walls: nextWalls }, changed: true } : { value: obj, changed: false };
  }
  return { value: obj, changed: false };
}

// Fields that are semantically whole numbers: a formula may resolve to a
// fractional value (e.g. num_steps = "= floor_height / step_rise"), but every
// consumer expects an integer, so we round here — the single point where a
// formula result is written — rather than in each renderer.
const INTEGER_FIELDS = new Set(["num_steps", "tie_beam_count"]);

// Evaluate a container's `formulas` map against `scope`, writing resolved
// numbers into the container's own fields. Returns the same reference when
// nothing changed (or there are no formulas). Used uniformly for objects,
// floors, site, plinth and defaults.
function applyContainerFormulas<T>(
  container: T,
  scope: Scope,
  warnings: FormulaWarning[],
  where: string,
): { value: T; changed: boolean } {
  const c = container as Record<string, unknown> | null | undefined;
  const fm = c?.formulas as Record<string, string> | undefined;
  if (!c || !fm || Object.keys(fm).length === 0) return { value: container, changed: false };
  const next: Record<string, unknown> = { ...c };
  let changed = false;
  for (const [field, src] of Object.entries(fm)) {
    const r = evalFormula(src, scope);
    if (r.value === null) {
      warnings.push({ where: `${where}/${field}`, formula: src, message: r.error ?? "invalid formula" });
      continue;
    }
    const resolved = INTEGER_FIELDS.has(field) ? Math.round(r.value) : r.value;
    if (next[field] !== resolved) {
      next[field] = resolved;
      changed = true;
    }
  }
  return { value: changed ? (next as T) : container, changed };
}

// Resolve the house-level symbol table (variables + point fields) into a flat
// numeric scope, topologically, with cycle detection. Exposed so the editor can
// evaluate a single field's formula against the same scope the resolver uses
// (for per-field error reporting). Returns an empty scope when there are no
// variables/points.
export function buildScope(config: HouseConfig): { scope: Scope; warnings: FormulaWarning[] } {
  const warnings: FormulaWarning[] = [];
  const scope: Scope = {};
  const syms = collectSymbols(config);
  const { order, cyclic } = topoOrder(syms);
  for (const s of order) {
    if (cyclic.has(s.key)) {
      warnings.push({ where: s.where, formula: s.src ?? "", message: "circular reference" });
      continue;
    }
    if (s.src === null) {
      if (s.literal !== null) scope[s.key] = s.literal;
      else warnings.push({ where: s.where, formula: "", message: "not a number or formula" });
      continue;
    }
    const r = evalFormula(s.src, scope);
    if (r.value === null) {
      warnings.push({ where: s.where, formula: s.src, message: r.error ?? "invalid formula" });
    } else {
      scope[s.key] = r.value;
    }
  }
  // Grid line positions become referenceable symbols so objects can place
  // themselves on the grid via ordinary formulas (plans/grid-convention.md):
  //   `<gridId>.x<lineName>` / `<gridId>.y<lineName>`  (e.g. `main.x1`, `main.yA`).
  // A room is then just `x: "= main.x1", width: "= main.x5 - main.x1"` (centreline
  // convention → no wall math). Resolved AFTER variables/points (grid `at`
  // formulas reference them).
  if ((config as { grids?: unknown }).grids) {
    const defaultT =
      ((config as { defaults?: { wall_thickness?: number } }).defaults?.wall_thickness) ?? 8;
    const grids = resolveGrids(config, scope, warnings, defaultT);
    for (const [id, g] of grids) {
      for (const [name, pos] of g.x) scope[`${id}.x${name}`] = pos;
      for (const [name, pos] of g.y) scope[`${id}.y${name}`] = pos;
    }
  }

  // A point's synonym symbols (.x/.w, .y/.l) share a `where`, so a bad point
  // coord yields two identical warnings — collapse duplicates.
  const seen = new Set<string>();
  const deduped = warnings.filter((w) => {
    const k = `${w.where}|${w.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { scope, warnings: deduped };
}

// Cache the resolved scope + warnings per config version (config is an
// immutable reference that changes on every mutation), so many fields checking
// their own formula in one render pass share a single scope build.
const scopeCache = new WeakMap<object, { scope: Scope; warnings: FormulaWarning[] }>();
function buildScopeCached(
  config: HouseConfig | null | undefined,
): { scope: Scope; warnings: FormulaWarning[] } {
  if (!config || typeof config !== "object") return { scope: {}, warnings: [] };
  const cached = scopeCache.get(config);
  if (cached) return cached;
  const res = buildScope(config);
  scopeCache.set(config, res);
  return res;
}

export function scopeForConfig(config: HouseConfig | null | undefined): Scope {
  return buildScopeCached(config).scope;
}

// Resolve every grid's line positions into numbers, for UI (Grids panel live
// values + drawing the grid on the 2D plan). Same computation buildScope uses to
// publish `main.x1`-style symbols, exposed as the structured per-grid map.
export function resolvedGridsForConfig(
  config: HouseConfig | null | undefined,
): Map<string, ResolvedGrid> {
  if (!config || typeof config !== "object" || !(config as { grids?: unknown }).grids) return new Map();
  const { scope, warnings } = buildScopeCached(config);
  const defaultT =
    (config as { defaults?: { wall_thickness?: number } }).defaults?.wall_thickness ?? 8;
  return resolveGrids(config, scope, warnings.slice(), defaultT);
}

// Error message for a house-level symbol (a variable or point field) by its
// `where` tag (e.g. "variables/colB", "points/P1.x"), or null when it resolves
// cleanly. Lets the Variables/Points panel flag a bad entry.
export function symbolError(
  config: HouseConfig | null | undefined,
  where: string,
): string | null {
  const w = buildScopeCached(config).warnings.find((x) => x.where === where);
  return w ? w.message : null;
}

// Error message for a single formula evaluated against the config's scope, or
// null when it resolves cleanly. Used by the editor to flag a field whose
// formula references an unknown variable or has a syntax error.
export function formulaFieldError(
  config: HouseConfig | null | undefined,
  src: string | undefined,
): string | null {
  if (!src) return null;
  const r = evalFormula(src, scopeForConfig(config));
  return r.value === null ? (r.error ?? "invalid formula") : null;
}

// ---- Grid expansion (plans/grid-convention.md) ------------------------------
// A grid is named X/Y wall CENTRELINES. Objects bind via `grid`+`cell` (rooms /
// slabs / plinth / ground) or `grid`+`node` (pillars); we derive their outer
// footprint from the centrelines + wall thickness so authors never write room
// coordinate formulas or count walls.

export interface ResolvedGrid {
  x: Map<string, number>; // line name -> centreline position
  y: Map<string, number>;
  xt: Map<string, number>; // line name -> wall thickness on that line
  yt: Map<string, number>;
}

// Resolve every grid's line positions (and per-line thickness) into numbers.
function resolveGrids(
  config: HouseConfig,
  scope: Scope,
  warnings: FormulaWarning[],
  defaultT: number,
): Map<string, ResolvedGrid> {
  const out = new Map<string, ResolvedGrid>();
  const grids = (config as { grids?: Record<string, unknown> }).grids;
  if (!grids) return out;
  const num = (v: unknown, where: string): number | null => {
    if (typeof v === "number") return v;
    if (isFormula(v)) {
      const r = evalFormula(v, scope);
      if (r.value === null) {
        warnings.push({ where, formula: v, message: r.error ?? "invalid formula" });
        return null;
      }
      return r.value;
    }
    return null;
  };
  for (const [id, gRaw] of Object.entries(grids as Record<string, unknown>)) {
    const g = gRaw as { x?: unknown[]; y?: unknown[] };
    const rg: ResolvedGrid = { x: new Map(), y: new Map(), xt: new Map(), yt: new Map() };
    for (const axis of ["x", "y"] as const) {
      const lines = (axis === "x" ? g.x : g.y) as
        | Array<{ name?: string; at?: unknown; thickness?: unknown }>
        | undefined;
      const posMap = axis === "x" ? rg.x : rg.y;
      const thickMap = axis === "x" ? rg.xt : rg.yt;
      for (const ln of lines ?? []) {
        if (!ln || typeof ln.name !== "string") continue;
        const pos = num(ln.at, `grids/${id}/${axis}/${ln.name}`);
        if (pos !== null) posMap.set(ln.name, pos);
        const t =
          ln.thickness === undefined
            ? defaultT
            : (num(ln.thickness, `grids/${id}/${axis}/${ln.name}/thickness`) ?? defaultT);
        thickMap.set(ln.name, t);
      }
    }
    out.set(id, rg);
  }
  return out;
}

export function resolveParametric(config: HouseConfig): ResolveResult {
  try {
    const vars = (config as { variables?: Record<string, unknown> }).variables;
    const pts = (config as { points?: Record<string, unknown> }).points;
    const hasVars = !!vars && Object.keys(vars).length > 0;
    const hasPts = !!pts && Object.keys(pts).length > 0;
    const hasContainerFormulas =
      hasFormulas(config.site) ||
      hasFormulas((config as { defaults?: unknown }).defaults) ||
      config.floors.some(
        (f) =>
          hasFormulas(f) ||
          f.objects.some(
            (o) => hasFormulas(o) || hasOpeningFormulas(o) || hasRoofNestedFormulas(o),
          ),
      );
    // Fast path: non-parametric house → same reference, no work.
    if (!hasVars && !hasPts && !hasContainerFormulas) {
      return { config, warnings: [] };
    }

    // Resolve the house-level symbol table (variables + points + grid symbols).
    const { scope, warnings } = buildScope(config);

    // 4. Apply formulas into fields — objects, each floor's own fields, and the
    // house-level site / plinth / defaults containers. Same-reference is
    // preserved wherever nothing changed, so the config identity only changes
    // for the parts that actually moved.
    let anyFloorChanged = false;
    const mappedFloors = config.floors.map((f, fi) => {
      let objectsChanged = false;
      const objects = f.objects.map((o, oi) => {
        // Object formulas (x/y/width/length …) resolve against the scope, which
        // now includes the grid line symbols (see buildScope) — so a grid-bound
        // room is just formulas referencing `<grid>.x<name>` / `.y<name>`.
        const res = applyContainerFormulas(o, scope, warnings, `floor${fi}/obj${oi}`);
        // Nested one level down, with their own formulas: wall/room openings,
        // and roof segments + slope.
        const opRes = resolveOpenings(res.value, scope, warnings, `floor${fi}/obj${oi}`);
        const roofRes = resolveRoofNested(opRes.value, scope, warnings, `floor${fi}/obj${oi}`);
        if (res.changed || opRes.changed || roofRes.changed) objectsChanged = true;
        return roofRes.value as typeof o;
      });
      // Apply the floor's OWN formulas (height / wall_height / slab_thickness)
      // to a container carrying the possibly-updated objects.
      const base = objectsChanged ? { ...f, objects } : f;
      const res = applyContainerFormulas(base, scope, warnings, `floor${fi}`);
      const finalFloor = res.value;
      if (finalFloor !== f) anyFloorChanged = true;
      return finalFloor;
    });
    const floors = anyFloorChanged ? mappedFloors : config.floors;

    const siteRes = applyContainerFormulas(config.site, scope, warnings, "site");
    const defaultsRes = applyContainerFormulas(
      (config as { defaults?: unknown }).defaults,
      scope,
      warnings,
      "defaults",
    );

    const changed =
      anyFloorChanged || siteRes.changed || defaultsRes.changed;
    if (!changed) return { config, warnings };

    const outConfig = { ...config } as HouseConfig & Record<string, unknown>;
    if (anyFloorChanged) outConfig.floors = floors;
    if (siteRes.changed) outConfig.site = siteRes.value as HouseConfig["site"];
    if (defaultsRes.changed) outConfig.defaults = defaultsRes.value as HouseConfig["defaults"];
    return { config: outConfig as HouseConfig, warnings };
  } catch (e) {
    return {
      config,
      warnings: [{ where: "(resolver)", formula: "", message: (e as Error).message }],
    };
  }
}
