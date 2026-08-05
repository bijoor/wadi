// Generator: Wadi DSL AST  →  canonical HouseConfig JSON.
//
// The JSON it emits is exactly what editor/src/schema/houseConfig.ts (Zod)
// validates and param/resolve.ts resolves — so the DSL drives the REAL Wadi
// pipeline, and "the model is fully representable in the DSL" is proven by the
// output passing validation + resolution, not by a parallel implementation.

import { EmptyFileSystem } from "langium";
import { createWadiServices } from "../language/wadi-module.js";
import type * as ast from "../language/generated/ast.js";
import {
  isNum,
  isNeg,
  isBinary,
  isRef,
  isCall,
  isJsonObject,
  isJsonArray,
  isJsonNum,
  isJsonStr,
  isJsonBool,
  isJsonNull,
} from "../language/generated/ast.js";

// ---- Formula expressions -------------------------------------------------

/** Render an Expr AST back to a formula source string (no leading '='). */
export function exprToFormula(e: ast.Expr): string {
  if (isNum(e)) return numText(e.value);
  if (isNeg(e)) return `-${wrap(e.operand)}`;
  if (isBinary(e)) return `${wrap(e.left)} ${e.op} ${wrap(e.right)}`;
  if (isCall(e)) return `${refName(e.callee)}(${e.args.map(exprToFormula).join(", ")})`;
  if (isRef(e)) return e.parts.join(".");
  throw new Error(`unhandled expression node: ${(e as { $type: string }).$type}`);
}

// Parenthesize a binary child so precedence round-trips safely.
function wrap(e: ast.Expr): string {
  return isBinary(e) ? `(${exprToFormula(e)})` : exprToFormula(e);
}
function refName(e: ast.Expr): string {
  return isRef(e) ? e.parts.join(".") : exprToFormula(e);
}
function numText(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

/** A pure numeric literal → its number; anything else → a "= …" formula string. */
export function exprToValue(e: ast.Expr): number | string {
  return isNum(e) ? e.value : `= ${exprToFormula(e)}`;
}

/** Split an Expr into a concrete field value + an optional formula string.
 *  Numeric geometry fields must be present as numbers (the schema requires it);
 *  a non-literal expression writes a placeholder + a formula the resolver fills. */
function fieldAndFormula(e: ast.Expr, placeholder: number): { value: number; formula?: string } {
  if (isNum(e)) return { value: e.value };
  return { value: placeholder, formula: `= ${exprToFormula(e)}` };
}

// ---- JSON escape ---------------------------------------------------------

function jsonValue(v: ast.JsonValue): unknown {
  if (isJsonObject(v)) return jsonObject(v);
  if (isJsonArray(v)) return v.items.map(jsonValue);
  if (isJsonNum(v)) return v.neg ? -v.num : v.num;
  if (isJsonStr(v)) return unquote(v.str);
  if (isJsonBool(v)) return v.bool === "true";
  if (isJsonNull(v)) return null;
  throw new Error(`unhandled JSON node: ${(v as { $type: string }).$type}`);
}
function jsonObject(o: ast.JsonObject): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const m of o.members) out[unquote(m.key)] = jsonValue(m.value);
  return out;
}
function unquote(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\(.)/g, (_, c) => (c === "n" ? "\n" : c === "t" ? "\t" : c));
  }
  return s;
}

// ---- Objects -------------------------------------------------------------

// A small geometry accumulator: `put(field, expr, ph)` returns the concrete
// number to store and, when the expr is not a literal, records the "= …"
// formula under `field` in the shared map.
function geom() {
  const formulas: Record<string, string> = {};
  const put = (field: string, e: ast.Expr | undefined, ph = 0): number | undefined => {
    if (!e) return undefined;
    const { value, formula } = fieldAndFormula(e, ph);
    if (formula) formulas[field] = formula;
    return value;
  };
  return { formulas, put };
}

// The optional attribute tail shared by every object (z_offset + the
// enabled/layer/material switches). Present as a structural subset of every
// AST node (missing fields are simply undefined).
interface CommonNode {
  z_offset?: ast.Expr;
  enabled?: ast.Expr;
  layer?: string;
  material?: string;
}
function applyCommon(o: Record<string, unknown>, formulas: Record<string, string>, n: CommonNode): void {
  if (n.z_offset !== undefined) {
    const { value, formula } = fieldAndFormula(n.z_offset, 0);
    o.z_offset = value;
    if (formula) formulas.z_offset = formula;
  }
  if (n.enabled !== undefined) {
    // `enabled` is a boolean/number in the schema; a formula lives under
    // formulas.enabled (the runtime resolves it back onto `enabled`).
    const { value, formula } = fieldAndFormula(n.enabled, 1);
    o.enabled = value;
    if (formula) formulas.enabled = formula;
  }
  if (n.layer) o.layer = unquote(n.layer);
  if (n.material) o.material = unquote(n.material);
}
// Finish an object: attach the formula map iff it has entries.
function done(o: Record<string, unknown>, formulas: Record<string, string>): Record<string, unknown> {
  if (Object.keys(formulas).length) o.formulas = formulas;
  return o;
}

function room(r: ast.Room): Record<string, unknown> {
  const { formulas, put } = geom();
  const walls: Record<string, unknown> = {};
  // A `wall` statement may list several sides (`wall east west north`); each
  // named side gets the same per-wall config (openings/heights normally only
  // appear on a single-side statement).
  for (const w of r.walls) {
    const wc = roomWall(w);
    for (const side of w.sides) walls[side] = wc;
  }
  const items = r.items.map(roomItem);
  const o: Record<string, unknown> = {
    type: "room",
    name: unquote(r.name),
    x: put("x", r.x, 0),
    y: put("y", r.y, 0),
    width: put("width", r.w, 1),
    length: put("length", r.l, 1),
  };
  const h = put("height", r.height);
  if (h !== undefined) o.height = h;
  if (Object.keys(walls).length) o.walls = walls;
  if (items.length) o.items = items;
  applyCommon(o, formulas, r);
  return done(o, formulas);
}

function roomWall(w: ast.RoomWall): Record<string, unknown> {
  const { formulas, put } = geom();
  const side: Record<string, unknown> = {};
  const openings = w.openings.map(opening);
  if (openings.length) side.openings = openings;
  const h = put("height", w.height);
  if (h !== undefined) side.height = h;
  const he = put("height_end", w.height_end);
  if (he !== undefined) side.height_end = he;
  return done(side, formulas);
}

function opening(o: ast.Opening): Record<string, unknown> {
  const { formulas, put } = geom();
  const obj: Record<string, unknown> = {
    kind: o.kind,
    name: unquote(o.name),
    offset: put("offset", o.offset, 0),
    width: put("width", o.width, 1),
    height: put("height", o.height, 1),
  };
  const s = put("sill_height", o.sill);
  if (s !== undefined) obj.sill_height = s;
  if (o.open) obj.open = true;
  if (o.direction) obj.direction = o.direction;
  return done(obj, formulas);
}

function roomItem(it: ast.RoomItem): Record<string, unknown> {
  const { formulas, put } = geom();
  const o: Record<string, unknown> = { asset: resolveItemAsset(it) };
  if (it.name) o.name = unquote(it.name);
  if (it.anchor) o.anchor = it.anchor;
  const gx = put("gap_x", it.gap_x);
  if (gx !== undefined) o.gap_x = gx;
  const gy = put("gap_y", it.gap_y);
  if (gy !== undefined) o.gap_y = gy;
  const rot = put("rotation", it.rotation);
  if (rot !== undefined) o.rotation = rot;
  const sc = put("scale", it.scale, 1);
  if (sc !== undefined) o.scale = sc;
  applyCommon(o, formulas, it);
  return done(o, formulas);
}

function wall(w: ast.Wall): Record<string, unknown> {
  const { formulas, put } = geom();
  const o: Record<string, unknown> = {
    type: "wall",
    name: unquote(w.name),
    start_x: put("start_x", w.start_x, 0),
    start_y: put("start_y", w.start_y, 0),
    end_x: put("end_x", w.end_x, 0),
    end_y: put("end_y", w.end_y, 0),
  };
  const h = put("height", w.height, 1);
  if (h !== undefined) o.height = h;
  const he = put("height_end", w.height_end);
  if (he !== undefined) o.height_end = he;
  if (w.facing) o.facing = w.facing;
  const openings = w.openings.map(opening);
  if (openings.length) o.openings = openings;
  applyCommon(o, formulas, w);
  return done(o, formulas);
}

function pillar(p: ast.Pillar): Record<string, unknown> {
  const { formulas, put } = geom();
  const o: Record<string, unknown> = {
    type: "pillar",
    name: unquote(p.name),
    x: put("x", p.x, 0),
    y: put("y", p.y, 0),
  };
  // `auto` (w_auto/l_auto) leaves the dimension unset → wall-thickness default.
  if (!p.w_auto) o.width = put("width", p.w, 1);
  if (!p.l_auto) o.length = put("length", p.l, 1);
  const h = put("height", p.height, 1);
  if (h !== undefined) o.height = h;
  applyCommon(o, formulas, p);
  return done(o, formulas);
}

function beam(b: ast.Beam): Record<string, unknown> {
  const { formulas, put } = geom();
  const o: Record<string, unknown> = {
    type: "beam",
    x: put("x", b.x, 0),
    y: put("y", b.y, 0),
    width: put("width", b.w, 1),
    length: put("length", b.l, 1),
  };
  if (b.name) o.name = unquote(b.name);
  const h = put("height", b.height);
  if (h !== undefined) o.height = h;
  applyCommon(o, formulas, b);
  return done(o, formulas);
}

function floorSlab(s: ast.FloorSlab): Record<string, unknown> {
  const { formulas, put } = geom();
  const o: Record<string, unknown> = {
    type: "floor_slab",
    x: put("x", s.x, 0),
    y: put("y", s.y, 0),
    width: put("width", s.w, 1),
    length: put("length", s.l, 1),
  };
  if (s.name) o.name = unquote(s.name);
  const t = put("thickness", s.thickness);
  if (t !== undefined) o.thickness = t;
  applyCommon(o, formulas, s);
  return done(o, formulas);
}

function plinth(p: ast.Plinth): Record<string, unknown> {
  const { formulas, put } = geom();
  const o: Record<string, unknown> = {
    type: "plinth",
    x: put("x", p.x, 0),
    y: put("y", p.y, 0),
    width: put("width", p.w, 1),
    length: put("length", p.l, 1),
    height: put("height", p.height, 1),
  };
  if (p.name) o.name = unquote(p.name);
  applyCommon(o, formulas, p);
  return done(o, formulas);
}

function ground(g: ast.Ground): Record<string, unknown> {
  const { formulas, put } = geom();
  const o: Record<string, unknown> = {
    type: "ground",
    x: put("x", g.x, 0),
    y: put("y", g.y, 0),
    width: put("width", g.w, 1),
    length: put("length", g.l, 1),
  };
  if (g.name) o.name = unquote(g.name);
  const h = put("height", g.height);
  if (h !== undefined) o.height = h;
  applyCommon(o, formulas, g);
  return done(o, formulas);
}

function staircase(s: ast.Staircase): Record<string, unknown> {
  const { formulas, put } = geom();
  const o: Record<string, unknown> = {
    type: "staircase",
    start_x: put("start_x", s.start_x, 0),
    start_y: put("start_y", s.start_y, 0),
    step_rise: put("step_rise", s.step_rise, 1),
    step_tread: put("step_tread", s.step_tread, 1),
    step_width: put("step_width", s.step_width, 1),
    direction: s.direction,
  };
  if (s.name) o.name = unquote(s.name);
  // Placeholder 1 (not 0): these carry a `>0` schema constraint, and when the
  // value is a formula (e.g. a component `param`) the stored placeholder is what
  // schema-validation of the unresolved def sees — 0 would spuriously fail.
  const rh = put("rise_height", s.rise_height, 1);
  if (rh !== undefined) o.rise_height = rh;
  const mr = put("max_run", s.max_run, 1);
  if (mr !== undefined) o.max_run = mr;
  const ld = put("landing_depth", s.landing_depth, 1); // positive() — placeholder 1, not 0
  if (ld !== undefined) o.landing_depth = ld;
  const lt = put("landing_thickness", s.landing_thickness); // nonnegative() — 0 is valid
  if (lt !== undefined) o.landing_thickness = lt;
  if (s.turn) o.turn = s.turn;
  const fg = put("flight_gap", s.flight_gap, 1); // positive() — placeholder 1, not 0
  if (fg !== undefined) o.flight_gap = fg;
  applyCommon(o, formulas, s);
  return done(o, formulas);
}

function kitchen(k: ast.KitchenPlatform): Record<string, unknown> {
  const { formulas, put } = geom();
  const o: Record<string, unknown> = {
    type: "kitchen_platform",
    path: k.pts.map((p) => [p.x, p.y]),
    side: k.side,
    depth: put("depth", k.depth, 1),
    height: put("height", k.height, 1),
  };
  if (k.name) o.name = unquote(k.name);
  const bz = put("base_z", k.base_z);
  if (bz !== undefined) o.base_z = bz;
  applyCommon(o, formulas, k);
  return done(o, formulas);
}

function asset(a: ast.Asset): Record<string, unknown> {
  const o: Record<string, unknown> = {
    id: unquote(a.id),
    src: unquote(a.src),
    dimensions: [a.dx, a.dy, a.dz],
  };
  if (a.name) o.name = unquote(a.name);
  if (a.category) o.category = unquote(a.category);
  return o;
}

// Named asset exports in scope for `item "id"` (bare) resolution: this file's own
// `asset "id" …` decls plus any assets from a bare `import "…"` (no alias). Set once
// per compile in modelToHouseConfig; same-file decls win over bare-imported ones.
let ASSET_INDEX = new Map<string, ast.AssetDecl>();
// Assets from aliased imports (`import "…" as ns`), keyed ns → id → decl, for
// `item ns."id"` resolution.
let NS_ASSET_INDEX = new Map<string, Map<string, ast.AssetDecl>>();

function assetDeclToObj(a: ast.AssetDecl): Record<string, unknown> {
  const o: Record<string, unknown> = {
    id: unquote(a.id),
    src: unquote(a.src),
    dimensions: [a.dx, a.dy, a.dz],
  };
  if (a.assetName) o.name = unquote(a.assetName);
  if (a.category) o.category = unquote(a.category);
  return o;
}

// Resolve an item's asset: the inline `asset { … }` block, or an `assetRef` — a
// bare id (`"bed_double"`) looked up in this file's `asset` decls, or a namespaced
// id (`f."bed_double"`) from an imported module (deferred).
function resolveItemAsset(it: ast.Item | ast.RoomItem): Record<string, unknown> {
  if (it.asset) return asset(it.asset);
  const ref = it.assetRef;
  if (!ref) throw new Error("item has no asset (expected `asset { … }` or an asset id)");
  const id = unquote(ref.id);
  if (ref.ns) {
    const mod = NS_ASSET_INDEX.get(ref.ns);
    if (!mod) {
      const nss = [...NS_ASSET_INDEX.keys()];
      throw new Error(
        `item asset "${ref.ns}.${id}": no import is aliased "${ref.ns}". ` +
          `Add \`import "…" as ${ref.ns}\`` +
          (nss.length ? ` (imported aliases: ${nss.join(", ")}).` : "."),
      );
    }
    const decl = mod.get(id);
    if (!decl) {
      const avail = [...mod.keys()];
      throw new Error(
        `unknown asset "${ref.ns}.${id}" — module "${ref.ns}" declares no "${id}"` +
          (avail.length ? ` (it has: ${avail.join(", ")}).` : "."),
      );
    }
    return assetDeclToObj(decl);
  }
  const decl = ASSET_INDEX.get(id);
  if (!decl) {
    const avail = [...ASSET_INDEX.keys()];
    throw new Error(
      `unknown asset "${id}". Declare it with a top-level \`asset "${id}" src … dims …\`, ` +
        `bare-import a module that provides it, or use a namespaced \`item ns."${id}"\`` +
        (avail.length ? ` (in scope: ${avail.join(", ")}).` : "."),
    );
  }
  return assetDeclToObj(decl);
}

function item(it: ast.Item): Record<string, unknown> {
  const { formulas, put } = geom();
  const o: Record<string, unknown> = {
    type: "item",
    asset: resolveItemAsset(it),
    x: put("x", it.x, 0),
    y: put("y", it.y, 0),
  };
  if (it.name) o.name = unquote(it.name);
  const rot = put("rotation", it.rotation);
  if (rot !== undefined) o.rotation = rot;
  const sc = put("scale", it.scale, 1);
  if (sc !== undefined) o.scale = sc;
  if (it.anchor_to) o.anchor_to = unquote(it.anchor_to);
  if (it.anchor) o.anchor = it.anchor;
  const gx = put("gap_x", it.gap_x);
  if (gx !== undefined) o.gap_x = gx;
  const gy = put("gap_y", it.gap_y);
  if (gy !== undefined) o.gap_y = gy;
  applyCommon(o, formulas, it);
  return done(o, formulas);
}

// A namespace path (dotted alias chain from the host; "" = host) doubles as the
// cfg.components key prefix. Alias/component segments are IDs (no dots), so the
// dotted join is unambiguous. `flatKey` is the exact key a `use` resolves to and
// that expandComponent looks up.
const joinPrefix = (prefix: string, ns: string): string => (prefix ? `${prefix}.${ns}` : ns);
const flatKey = (prefix: string, name: string): string => (prefix ? `${prefix}.${name}` : name);

// The CURRENT module scope, swapped by setScope while serializing objects: the
// host floors use the host scope; each library component is serialized in ITS
// OWN module's scope so its internal `use`/`item` refs resolve — and relocate to
// flat keys — correctly. resolveComponentRef / resolveItemAsset read these.
let CUR_PREFIX = ""; // dotted alias-path of the module being serialized ("" = host)
let CUR_COMP_LOCAL = new Set<string>(); // own + bare-imported component names (`use Comp`)
let CUR_COMP_NS = new Map<string, { prefix: string; names: Set<string> }>(); // alias → child prefix + names

// Resolve a `use [ns.]Comp` to the flat key it looks up in cfg.components — the
// component RELOCATED into the current module's namespace: `flatKey(prefix, Comp)`
// for a same-module/bare-imported component, `flatKey(childPrefix, Comp)` for an
// aliased import. Because this runs in the referrer's scope, a library component's
// internal `use Leg` correctly points at that library's relocated `…Leg` key.
// Errors, at compile time, on an unknown alias or component.
function resolveComponentRef(c: ast.Component): string {
  if (c.ns) {
    const mod = CUR_COMP_NS.get(c.ns);
    if (!mod) {
      const nss = [...CUR_COMP_NS.keys()];
      throw new Error(
        `use ${c.ns}.${c.ref}: no import is aliased "${c.ns}". Add \`import "…" as ${c.ns}\`` +
          (nss.length ? ` (imported aliases: ${nss.join(", ")}).` : "."),
      );
    }
    if (!mod.names.has(c.ref)) {
      throw new Error(
        `unknown component "${c.ns}.${c.ref}" — module "${c.ns}" defines no "${c.ref}"` +
          (mod.names.size ? ` (it has: ${[...mod.names].join(", ")}).` : "."),
      );
    }
    return flatKey(mod.prefix, c.ref);
  }
  if (CUR_COMP_LOCAL.size && !CUR_COMP_LOCAL.has(c.ref)) {
    throw new Error(
      `unknown component "${c.ref}". Define it with \`component ${c.ref} { … }\`, or import a ` +
        `module that provides it and use \`use ns.${c.ref}\`` +
        ` (in scope: ${[...CUR_COMP_LOCAL].join(", ")}).`,
    );
  }
  return flatKey(CUR_PREFIX, c.ref);
}

function componentInstance(c: ast.Component): Record<string, unknown> {
  const { formulas, put } = geom();
  const o: Record<string, unknown> = {
    type: "component",
    ref: resolveComponentRef(c),
    x: put("x", c.x, 0),
    y: put("y", c.y, 0),
  };
  if (c.name) o.name = unquote(c.name);
  const rot = put("rotation", c.rotation);
  if (rot !== undefined) o.rotation = rot;
  if (c.args.length) {
    const params: Record<string, number | string> = {};
    for (const a of c.args) params[a.name] = exprToValue(a.value);
    o.params = params;
  }
  applyCommon(o, formulas, c);
  return done(o, formulas);
}

// ---- Roof (segments carry their own formula map; trusses use pos0/pos1/…) ----

function roof(r: ast.Roof): Record<string, unknown> {
  const { formulas, put } = geom();
  const o: Record<string, unknown> = { type: "roof", roof_type: r.roof_type };
  if (r.name) o.name = unquote(r.name);
  if (r.default_endpoint) o.default_endpoint = r.default_endpoint;
  if (r.slope) {
    const s = r.slope;
    if (s.angle_left !== undefined && s.angle_right !== undefined) {
      const l = exprToValue(s.angle_left);
      const rr = exprToValue(s.angle_right);
      if (l === rr) {
        // An EQUAL pair is just symmetric — emit a plain `slope` so it never
        // engages the per-side (asymmetric) machinery. `slope angle (20,20)`
        // is byte-identical to `slope angle 20`.
        o.slope = { by: "angle", angle_deg: l };
      } else {
        // Asymmetric pair `slope angle (L, R)` → the internal per-side fields.
        o.slope_left = { by: "angle", angle_deg: l };
        o.slope_right = { by: "angle", angle_deg: rr };
      }
    } else if (s.angle_deg !== undefined) {
      o.slope = { by: "angle", angle_deg: exprToValue(s.angle_deg) };
    } else if (s.ridge_h !== undefined) {
      o.slope = { by: "height", ridge_h: exprToValue(s.ridge_h) };
    }
  }
  const mo = put("min_overhang", r.min_overhang);
  if (mo !== undefined) o.min_overhang = mo;
  const st = put("slab_thickness", r.slab_thickness);
  if (st !== undefined) o.slab_thickness = st;
  if (r.parapet_height !== undefined) {
    o.parapet_height = put("parapet_height", r.parapet_height);
    o.parapet_thickness = put("parapet_thickness", r.parapet_thickness);
  }
  const gwt = put("gable_wall_thickness", r.gable_wall_thickness);
  if (gwt !== undefined) o.gable_wall_thickness = gwt;
  if (r.framing) o.framing = jsonObject(r.framing);
  if (r.segments.length) o.segments = r.segments.map(roofSegment);
  if (r.trusses.length) o.trusses = r.trusses.map(roofTruss);
  applyCommon(o, formulas, r);
  return done(o, formulas);
}

function roofSegment(s: ast.Segment): Record<string, unknown> {
  const { formulas, put } = geom();
  const seg: Record<string, unknown> = {
    id: unquote(s.id),
    start: [put("start_x", s.sx, 0), put("start_y", s.sy, 0)],
    end: [put("end_x", s.ex, 0), put("end_y", s.ey, 0)],
    width: put("width", s.width, 1),
  };
  if (s.shed_high_side) seg.shed_high_side = s.shed_high_side;
  if (s.start_endpoint) seg.start_endpoint = s.start_endpoint;
  if (s.end_endpoint) seg.end_endpoint = s.end_endpoint;
  if (s.hip_setback_start !== undefined) {
    seg.hip_setback_start = put("hip_setback_start", s.hip_setback_start);
    seg.hip_setback_end = put("hip_setback_end", s.hip_setback_end);
  }
  if (s.gable_overhang_start !== undefined) {
    seg.gable_overhang_start = put("gable_overhang_start", s.gable_overhang_start);
    seg.gable_overhang_end = put("gable_overhang_end", s.gable_overhang_end);
  }
  if (s.hip_ridge_extension_start !== undefined) {
    seg.hip_ridge_extension_start = put("hip_ridge_extension_start", s.hip_ridge_extension_start);
    seg.hip_ridge_extension_end = put("hip_ridge_extension_end", s.hip_ridge_extension_end);
  }
  const mo = put("min_overhang", s.min_overhang);
  if (mo !== undefined) seg.min_overhang = mo;
  // Per-side overhang overrides (each falls back to `overhang`). start/end apply
  // to shed + gable ends; low/high are shed eaves; left/right are pitched eaves.
  for (const side of ["overhang_start", "overhang_end", "overhang_low", "overhang_high", "overhang_left", "overhang_right"] as const) {
    const v = put(side, s[side]);
    if (v !== undefined) seg[side] = v;
  }
  if (s.tie_beam_count !== undefined) seg.tie_beam_count = Math.round(s.tie_beam_count);
  return done(seg, formulas);
}

function roofTruss(t: ast.Truss): Record<string, unknown> {
  const formulas: Record<string, string> = {};
  const positions = t.positions.map((e, i) => {
    const { value, formula } = fieldAndFormula(e, 0);
    if (formula) formulas[`pos${i}`] = formula;
    return value;
  });
  const o: Record<string, unknown> = {
    segment_id: unquote(t.segment_id),
    type: t.type,
    positions_along: positions,
  };
  return done(o, formulas);
}

function floorObject(o: ast.FloorObject): Record<string, unknown> {
  switch (o.$type) {
    case "Room":
      return room(o);
    case "Wall":
      return wall(o);
    case "Pillar":
      return pillar(o);
    case "Beam":
      return beam(o);
    case "FloorSlab":
      return floorSlab(o);
    case "Plinth":
      return plinth(o);
    case "Ground":
      return ground(o);
    case "Staircase":
      return staircase(o);
    case "KitchenPlatform":
      return kitchen(o);
    case "Item":
      return item(o);
    case "Component":
      return componentInstance(o);
    case "Roof":
      return roof(o);
    case "Raw":
      return { type: unquote(o.type), ...jsonObject(o.body) };
    default:
      throw new Error(`unhandled object: ${(o as { $type: string }).$type}`);
  }
}

// ---- Component library definitions --------------------------------------

function componentDef(d: ast.ComponentDef): Record<string, unknown> {
  const def: Record<string, unknown> = { objects: d.objects.map(floorObject) };
  if (d.goal) def.goal = unquote(d.goal);
  if (d.params.length) {
    def.params = d.params.map((p) => {
      const pp: Record<string, unknown> = { name: p.name };
      if (p.default !== undefined) pp.default = p.default;
      if (p.label) pp.label = unquote(p.label);
      return pp;
    });
  }
  if (d.vars.length) {
    const v: Record<string, number | string> = {};
    for (const x of d.vars) v[x.name] = exprToValue(x.value);
    def.variables = v;
  }
  if (d.points.length) {
    const pts: Record<string, unknown> = {};
    for (const p of d.points) pts[p.name] = { x: exprToValue(p.x), y: exprToValue(p.y) };
    def.points = pts;
  }
  return def;
}

// ---- Top level -----------------------------------------------------------

// Resolve an `import "<ref>"` to the module's `.wdl` source text, or undefined if
// the ref isn't on the search path. Supplied by the host (MCP embeds std-*; the
// CLI/app read a modules folder). A design with no imports needs no resolver.
export type ResolveModule = (ref: string) => string | undefined;

// One module's resolution scope, as seen from inside that module — used both to
// resolve its `item`/`use` refs and to relocate its component refs to flat keys.
interface ModuleScope {
  prefix: string; // dotted alias-path from the host ("" = host)
  assetsBare: Map<string, ast.AssetDecl>; // own + bare-imported assets (own wins)
  assetsByNs: Map<string, Map<string, ast.AssetDecl>>; // aliased-import assets
  compLocal: Set<string>; // own + bare-imported component names (`use Comp`)
  compByNs: Map<string, { prefix: string; names: Set<string> }>; // alias → child prefix + names
}
// A module ready to emit: its components (keyed flatKey(scope.prefix, name)),
// serialized in `scope`. One per transitively-imported module instance.
interface LinkedModule {
  scope: ModuleScope;
  components: Map<string, ast.ComponentDef>;
}
// The whole linked import graph for one compile.
interface ModuleGraph {
  host: ModuleScope; // the entry model's scope (prefix "")
  imported: LinkedModule[]; // every transitively-imported module, in discovery (post-)order
}

// The host scope for a model with NO imports resolved — the default when
// modelToHouseConfig is called without a graph (only valid if the model imports
// nothing; otherwise its `item`/`use` refs fail to resolve, as before).
function hostScopeNoImports(model: ast.Model): ModuleScope {
  return {
    prefix: "",
    assetsBare: new Map(model.assets.map((a) => [unquote(a.id), a])),
    assetsByNs: new Map(),
    compLocal: new Set(model.components.map((d) => d.name)),
    compByNs: new Map(),
  };
}
const EMPTY_GRAPH = (model: ast.Model): ModuleGraph => ({ host: hostScopeNoImports(model), imported: [] });

// Point the serialization globals at `s` before emitting that module's objects.
function setScope(s: ModuleScope): void {
  ASSET_INDEX = s.assetsBare;
  NS_ASSET_INDEX = s.assetsByNs;
  CUR_PREFIX = s.prefix;
  CUR_COMP_LOCAL = s.compLocal;
  CUR_COMP_NS = s.compByNs;
}

export function modelToHouseConfig(
  model: ast.Model,
  graph: ModuleGraph = EMPTY_GRAPH(model),
): Record<string, unknown> {
  const cfg: Record<string, unknown> = {};

  // Serialize the house body (floors + host components) in the host scope; each
  // imported library component is later re-scoped to its own module (setScope).
  setScope(graph.host);

  if (model.convention) cfg.coord_convention = model.convention;

  if (model.units) {
    const u: Record<string, unknown> = { system: model.units.system };
    if (model.units.per_unit !== undefined) u.per_unit = model.units.per_unit;
    cfg.units = u;
  }

  // site (reference + plot; a formula plot dim goes into site.formulas)
  {
    const s = model.site;
    const site: Record<string, unknown> = {
      reference_x: s?.ref_x ?? 0,
      reference_y: s?.ref_y ?? 0,
      plot_width: 1,
      plot_length: 1,
    };
    const formulas: Record<string, string> = {};
    if (s) {
      const pw = fieldAndFormula(s.plot_width, 1);
      const pl = fieldAndFormula(s.plot_length, 1);
      site.plot_width = pw.value;
      site.plot_length = pl.value;
      if (pw.formula) formulas.plot_width = pw.formula;
      if (pl.formula) formulas.plot_length = pl.formula;
    }
    if (Object.keys(formulas).length) site.formulas = formulas;
    cfg.site = site;
  }

  if (model.defaults) {
    const d = model.defaults;
    const defaults: Record<string, unknown> = {};
    if (d.floor_height !== undefined) defaults.floor_height = d.floor_height;
    if (d.wall_height !== undefined) defaults.wall_height = d.wall_height;
    if (d.slab_thickness !== undefined) defaults.slab_thickness = d.slab_thickness;
    if (d.wall_thickness !== undefined) defaults.wall_thickness = d.wall_thickness;
    if (Object.keys(defaults).length) cfg.defaults = defaults;
  }

  if (model.vars.length) {
    const variables: Record<string, number | string> = {};
    for (const v of model.vars) variables[v.name] = exprToValue(v.value);
    cfg.variables = variables;
  }

  if (model.points.length) {
    const points: Record<string, unknown> = {};
    for (const p of model.points) points[p.name] = { x: exprToValue(p.x), y: exprToValue(p.y) };
    cfg.points = points;
  }

  if (model.grids.length) {
    const grids: Record<string, unknown> = {};
    for (const g of model.grids) {
      const line = (l: ast.GridLine) => {
        const o: Record<string, unknown> = { name: String(l.name), at: exprToValue(l.at) };
        if (l.thickness) o.thickness = exprToValue(l.thickness);
        if (l.role) o.role = l.role;
        return o;
      };
      grids[g.name] = { x: g.xlines.map(line), y: g.ylines.map(line) };
    }
    cfg.grids = grids;
  }

  if (model.configurators.length) {
    const c = model.configurators[0];
    const section: Record<string, unknown> = {};
    if (c.title) section.title = unquote(c.title);
    if (c.description) section.description = unquote(c.description);
    // Walk items in source order: a group contributes a `groups[]` entry and
    // tags each of its inputs with the group id; a bare input carries no group.
    const groups: Record<string, unknown>[] = [];
    const inputs: Record<string, unknown>[] = [];
    const usedIds = new Set<string>();
    const groupId = (label: string): string => {
      const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "group";
      let id = /^[a-z_]/.test(base) ? base : `g_${base}`;
      for (let k = 2; usedIds.has(id); k++) id = `${base}_${k}`;
      usedIds.add(id);
      return id;
    };
    for (const item of c.items) {
      if (item.$type === "ConfigGroup") {
        const g = item as ast.ConfigGroup;
        const label = unquote(g.label);
        const id = groupId(label);
        const gobj: Record<string, unknown> = { id, label };
        if (g.description) gobj.description = unquote(g.description);
        groups.push(gobj);
        for (const i of g.inputs) inputs.push({ ...configInput(i), group: id });
      } else {
        inputs.push(configInput(item as ast.ConfigInput));
      }
    }
    if (groups.length) section.groups = groups;
    section.inputs = inputs;
    cfg.configurator = section;
  }

  if (model.layers.length) {
    cfg.layers = model.layers.map((l) => {
      const o: Record<string, unknown> = { id: unquote(l.id), label: unquote(l.label) };
      if (l.color) o.color = unquote(l.color);
      if (l.group) o.group = unquote(l.group);
      return o;
    });
  }

  // Component library — a flat dict keyed by relocated name. Order preserves the
  // pre-nesting output for existing (flat) designs: bare-imported modules (merged
  // into the host namespace, prefix "") first, then the host's own components
  // (which win on a bare-name clash), then namespaced modules — with any deeper,
  // transitively-imported modules appended. Each module's components serialize in
  // ITS scope (setScope) so their inner `use`/`item` refs resolve and relocate.
  {
    const comps: Record<string, unknown> = {};
    const emit = (m: LinkedModule) => {
      setScope(m.scope);
      for (const [name, d] of m.components) comps[flatKey(m.scope.prefix, name)] = componentDef(d);
    };
    for (const m of graph.imported) if (m.scope.prefix === "") emit(m); // bare (host namespace)
    setScope(graph.host);
    for (const d of model.components) comps[d.name] = componentDef(d); // host's own (bare keys)
    for (const m of graph.imported) if (m.scope.prefix !== "") emit(m); // namespaced + deeper
    if (Object.keys(comps).length) cfg.components = comps;
  }

  // Floors serialize in the host scope (the emit() loop above left it elsewhere).
  setScope(graph.host);
  cfg.floors = model.floors.map((f) => {
    const floor: Record<string, unknown> = {
      floor_number: Math.round(f.number),
      name: unquote(f.name),
      objects: f.objects.map(floorObject),
    };
    // Per-floor overrides of the house defaults (all optional).
    if (f.height !== undefined) floor.height = f.height;
    if (f.wall_height !== undefined) floor.wall_height = f.wall_height;
    if (f.slab_thickness !== undefined) floor.slab_thickness = f.slab_thickness;
    if (f.enabled !== undefined) floor.enabled = exprToValue(f.enabled);
    return floor;
  });

  return cfg;
}

function configInput(i: ast.ConfigInput): Record<string, unknown> {
  switch (i.$type) {
    case "SliderInput": {
      const s = i as ast.SliderInput;
      const o: Record<string, unknown> = {
        target: s.target,
        label: unquote(s.label),
        control: "slider",
        min: s.min,
        max: s.max,
      };
      if (s.unit) o.unit = s.unit;
      if (s.step !== undefined) o.step = s.step;
      if (s.description) o.description = unquote(s.description);
      return o;
    }
    case "NumberInput": {
      const n = i as ast.NumberInput;
      const o: Record<string, unknown> = { target: n.target, label: unquote(n.label), control: "number" };
      if (n.unit) o.unit = n.unit;
      if (n.description) o.description = unquote(n.description);
      return o;
    }
    case "ToggleInput": {
      const t = i as ast.ToggleInput;
      const o: Record<string, unknown> = { target: t.target, label: unquote(t.label), control: "toggle" };
      if (t.description) o.description = unquote(t.description);
      return o;
    }
    case "SelectInput": {
      const s = i as ast.SelectInput;
      const o: Record<string, unknown> = {
        target: s.target,
        label: unquote(s.label),
        control: "select",
        // Option label is an ID (kept as-is) or a quoted display string (unquoted).
        options: s.options.map((op) => ({ value: op.value, label: unquote(op.label) })),
      };
      if (s.description) o.description = unquote(s.description);
      return o;
    }
    default:
      throw new Error(`unhandled configurator input: ${(i as unknown as { $type: string }).$type}`);
  }
}

// ---- Parse entry point ---------------------------------------------------

type WadiServices = ReturnType<typeof createWadiServices>["Wadi"];

// Parse .wdl text into a Model, throwing on lex/parse errors. Shared by the main
// compile and by import-linking (imported modules parse the same way).
function parseModel(services: WadiServices, text: string, what = "DSL"): ast.Model {
  const result = services.parser.LangiumParser.parse<ast.Model>(text);
  if (result.lexerErrors.length || result.parserErrors.length) {
    const msgs = [
      ...result.lexerErrors.map((e) => `lex: ${e.message}`),
      ...result.parserErrors.map((e) => `parse: ${e.message}`),
    ];
    throw new Error(`${what} parse failed:\n  ${msgs.join("\n  ")}`);
  }
  return result.value;
}

// Link a model's `import` graph, TRANSITIVELY. For each module (starting at the
// host, prefix "") build its resolution scope and recurse into its own imports,
// so a library may itself import libraries. Each imported module is relocated
// into a namespace `prefix` (the dotted alias chain from the host) under which
// its components are emitted and its inner `use`/`item` refs resolve — this is
// what makes nested / cross-library components work. Cycle-guarded; modules are
// parsed once per ref and shared.
function linkModuleGraph(
  model: ast.Model,
  services: WadiServices,
  resolveModule?: ResolveModule,
): ModuleGraph {
  const imported: LinkedModule[] = [];
  const parsed = new Map<string, ast.Model>(); // memoize parse by module ref

  const build = (m: ast.Model, prefix: string, path: string[]): ModuleScope => {
    const scope: ModuleScope = {
      prefix,
      assetsBare: new Map(),
      assetsByNs: new Map(),
      compLocal: new Set(m.components.map((d) => d.name)),
      compByNs: new Map(),
    };
    for (const imp of m.imports ?? []) {
      const ref = unquote(imp.ref);
      if (path.includes(ref)) {
        throw new Error(`import cycle: ${[...path, ref].join(" → ")}`);
      }
      if (!resolveModule) {
        throw new Error(
          `import "${ref}": imports need a module resolver, but none is available in this context.`,
        );
      }
      let sub = parsed.get(ref);
      if (!sub) {
        const src = resolveModule(ref);
        if (src === undefined) {
          throw new Error(`import "${ref}": module not found on the search path.`);
        }
        sub = parseModel(services, src, `imported module "${ref}"`);
        parsed.set(ref, sub);
      }
      const childPrefix = imp.ns ? joinPrefix(prefix, imp.ns) : prefix;
      const childScope = build(sub, childPrefix, [...path, ref]);
      // Register the sub-module for emission (components keyed at childPrefix),
      // serialized in its own scope. Post-order: deeper modules first.
      imported.push({ scope: childScope, components: new Map(sub.components.map((d) => [d.name, d])) });
      const subAssets = new Map(sub.assets.map((a) => [unquote(a.id), a]));
      if (imp.ns) {
        scope.compByNs.set(imp.ns, { prefix: childPrefix, names: new Set(sub.components.map((d) => d.name)) });
        scope.assetsByNs.set(imp.ns, subAssets);
      } else {
        // Bare import merges into this module's own namespace (own decls win).
        for (const d of sub.components) scope.compLocal.add(d.name);
        for (const [id, a] of subAssets) if (!scope.assetsBare.has(id)) scope.assetsBare.set(id, a);
      }
    }
    // Own assets win over bare-imported ones on a name clash.
    for (const a of m.assets) scope.assetsBare.set(unquote(a.id), a);
    return scope;
  };

  const host = build(model, "", []);
  return { host, imported };
}

export interface CompileOptions {
  /** Resolve `import "<ref>"` to the module's .wdl text. Required if the design imports. */
  resolveModule?: ResolveModule;
}

export function compileDsl(text: string, opts: CompileOptions = {}): Record<string, unknown> {
  const services = createWadiServices(EmptyFileSystem).Wadi;
  const model = parseModel(services, text);
  const graph = linkModuleGraph(model, services, opts.resolveModule);
  return modelToHouseConfig(model, graph);
}

/** A module's public surface (for discovery): its exported asset declarations
 *  (for `item`) and component definitions (for `use`, with their `goal`). */
export interface ModuleExports {
  assets: Array<{
    id: string;
    src: string;
    dimensions: [number, number, number];
    name?: string;
    category?: string;
  }>;
  components: Array<{
    name: string;
    goal?: string;
    params: Array<{ name: string; default?: number; label?: string }>;
  }>;
}
export function moduleExports(text: string): ModuleExports {
  const services = createWadiServices(EmptyFileSystem).Wadi;
  const model = parseModel(services, text);
  return {
    assets: model.assets.map((a) => assetDeclToObj(a) as ModuleExports["assets"][number]),
    components: model.components.map((d) => ({
      name: d.name,
      ...(d.goal ? { goal: unquote(d.goal) } : {}),
      params: d.params.map((p) => ({
        name: p.name,
        ...(p.default !== undefined ? { default: p.default } : {}),
        ...(p.label ? { label: unquote(p.label) } : {}),
      })),
    })),
  };
}

// A Monaco-shaped diagnostic (1-based line/column, half-open end column).
export interface DslDiagnostic {
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/** Browser-friendly compile: never throws — returns the config (when the source
 *  is valid) and a list of positioned diagnostics for a code editor's markers.
 *  Used by the DSL playground; keeps the parser services warm across calls. */
let sharedServices: WadiServices | undefined;
export function compileWithDiagnostics(
  text: string,
  opts: CompileOptions = {},
): {
  config?: Record<string, unknown>;
  diagnostics: DslDiagnostic[];
} {
  sharedServices ??= createWadiServices(EmptyFileSystem).Wadi;
  const result = sharedServices.parser.LangiumParser.parse<ast.Model>(text);
  const diagnostics: DslDiagnostic[] = [];
  for (const e of result.lexerErrors) {
    const line = e.line ?? 1;
    const col = e.column ?? 1;
    diagnostics.push({
      message: e.message,
      startLineNumber: line,
      startColumn: col,
      endLineNumber: line,
      endColumn: col + (e.length ?? 1),
    });
  }
  for (const e of result.parserErrors) {
    const t = e.token;
    const sl = t.startLine ?? 1;
    const sc = t.startColumn ?? 1;
    diagnostics.push({
      message: e.message,
      startLineNumber: sl,
      startColumn: sc,
      endLineNumber: t.endLine ?? sl,
      endColumn: (t.endColumn ?? sc) + 1,
    });
  }
  if (diagnostics.length) return { diagnostics };
  try {
    const graph = linkModuleGraph(result.value, sharedServices, opts.resolveModule);
    return { config: modelToHouseConfig(result.value, graph), diagnostics: [] };
  } catch (e) {
    return {
      diagnostics: [
        { message: (e as Error).message, startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 2 },
      ],
    };
  }
}
