// DECOMPILER — HouseConfig (.wadi JSON) → .wdl source text. The inverse of
import { HARD_KEYWORDS } from "../language/soft-keywords.js";
// toHouseConfig: it walks a canonical config and emits DSL that compiles back to
// (a config deep-equal to) the input. Round-trip is exact for DSL-authored
// configs (see reference-roundtrip test); form-authored configs may use a few
// features the grammar can't express (formula-driven `defaults`, `site ref`,
// configurator title/groups) — those emit their resolved literal value, so the
// house stays geometrically identical but the parametric link on those specific
// fields is dropped.
//
// Design mirror of toHouseConfig.ts: one emit* per object type, dispatched by
// `type`. Every positional/measure field is emitted as `formula ?? literal`
// (formulas live in each object's `formulas` map as "= <expr>" strings).

/* eslint-disable @typescript-eslint/no-explicit-any */
type Obj = Record<string, any>;

// ---- primitives -----------------------------------------------------------

// Number formatting, matching the compiler's numText (integers bare, floats
// trimmed of trailing zeros).
function num(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(6))).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

// A config value that is either a literal number or a "= <expr>" formula string
// (used for vars / point coords / grid `at`).
function val(v: unknown): string {
  if (typeof v === "string") return v.replace(/^=\s*/, "").trim();
  if (typeof v === "number") return num(v);
  return "0";
}

// A field on an object: prefer its formula (from `.formulas`), else the literal.
function fld(o: Obj, key: string): string {
  const f = o.formulas?.[key];
  if (typeof f === "string") return f.replace(/^=\s*/, "").trim();
  return num(Number(o[key] ?? 0));
}
const has = (o: Obj, key: string): boolean =>
  o[key] !== undefined || o.formulas?.[key] !== undefined;

// A double-quoted string literal.
function str(s: string): string {
  return JSON.stringify(String(s));
}

// An object name: bare when it's a valid identifier, else quoted (the grammar's
// NameRef accepts either) — so a name like "Entrance-Varandah" round-trips.
function nameTok(s: unknown): string {
  return /^[A-Za-z_]\w*$/.test(String(s)) ? String(s) : str(String(s));
}

// A simple line writer with indentation.
class W {
  private lines: string[] = [];
  line(indent: number, text: string) {
    this.lines.push("  ".repeat(indent) + text);
  }
  blank() {
    this.lines.push("");
  }
  toString() {
    return this.lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  }
}

// The `Common` fragment (z_offset? enabled? layer?) + optional trailing material.
function commonSuffix(o: Obj, withMaterial = true): string {
  const parts: string[] = [];
  if (has(o, "z_offset")) parts.push(`z_offset ${fld(o, "z_offset")}`);
  if (has(o, "enabled")) parts.push(`enabled ${fld(o, "enabled")}`);
  if (o.layer !== undefined) parts.push(`layer ${str(o.layer)}`);
  if (withMaterial && o.material !== undefined) parts.push(`material ${str(o.material)}`);
  return parts.length ? " " + parts.join(" ") : "";
}

const at = (o: Obj) => `at (${fld(o, "x")}, ${fld(o, "y")})`;
const size = (o: Obj) => `size (${fld(o, "width")}, ${fld(o, "length")})`;

// ---- objects --------------------------------------------------------------

function emitOpening(op: Obj): string {
  let s = `${op.kind} ${nameTok(op.name)} at ${fld(op, "offset")} size (${fld(op, "width")}, ${fld(op, "height")})`;
  if (has(op, "sill_height")) s += ` sill ${fld(op, "sill_height")}`;
  else if (has(op, "sill")) s += ` sill ${fld(op, "sill")}`;
  if (op.open) s += " open";
  if (op.direction !== undefined) s += ` direction ${op.direction}`;
  return s;
}

function emitRoomItem(w: W, indent: number, it: Obj): void {
  // Room-nested item (no x/y — anchored). asset inline, then anchor/gap/rotation/scale.
  const head = it.name ? `item name ${str(it.name)} ` : "item ";
  w.line(indent, head + assetText(it) + roomItemTail(it));
}
function assetText(it: Obj): string {
  const a = it.asset ?? {};
  const d = a.dimensions ?? [0, 0, 0];
  let s = `asset { id ${str(a.id)} src ${str(a.src)} dims (${num(d[0])}, ${num(d[1])}, ${num(d[2])})`;
  if (a.name !== undefined) s += ` name ${str(a.name)}`;
  if (a.category !== undefined) s += ` category ${str(a.category)}`;
  return s + " }";
}
function roomItemTail(it: Obj): string {
  let s = "";
  if (it.anchor !== undefined) s += ` anchor ${it.anchor}`;
  if (has(it, "gap_x") || has(it, "gap_y")) s += ` gap (${fld(it, "gap_x")}, ${fld(it, "gap_y")})`;
  if (has(it, "rotation")) s += ` rotation ${fld(it, "rotation")}`;
  if (has(it, "scale")) s += ` scale ${fld(it, "scale")}`;
  return s + commonSuffix(it, false);
}

function emitRoom(w: W, indent: number, o: Obj): void {
  let head = `room ${nameTok(o.name)} ${at(o)} ${size(o)}`;
  if (has(o, "height")) head += ` height ${fld(o, "height")}`;
  head += commonSuffix(o);
  const walls = o.walls && !Array.isArray(o.walls) ? (o.walls as Record<string, Obj>) : {};
  const items = Array.isArray(o.items) ? (o.items as Obj[]) : [];
  const wallSides = Object.entries(walls);
  const hasBody = wallSides.length > 0 || items.length > 0;
  if (!hasBody) {
    w.line(indent, head);
    return;
  }
  w.line(indent, head + " {");
  // Emit walls in their ORIGINAL order (so the side order round-trips). Collapse
  // only a RUN of consecutive plain walls into one `wall a b c` line; a wall with
  // openings or a per-side height gets its own statement.
  let run: string[] = [];
  const flush = () => { if (run.length) { w.line(indent + 1, `wall ${run.join(" ")}`); run = []; } };
  for (const [sideName, wobj] of wallSides) {
    const special = (Array.isArray(wobj?.openings) && wobj.openings.length > 0) || has(wobj, "height") || has(wobj, "height_end");
    if (!special) { run.push(sideName); continue; }
    flush();
    let wl = `wall ${sideName}`;
    if (has(wobj, "height")) wl += ` height ${fld(wobj, "height")}`;
    if (has(wobj, "height_end")) wl += ` height_end ${fld(wobj, "height_end")}`;
    const ops = Array.isArray(wobj.openings) ? (wobj.openings as Obj[]) : [];
    if (!ops.length) { w.line(indent + 1, wl); continue; }
    w.line(indent + 1, wl + " {");
    for (const op of ops) w.line(indent + 2, emitOpening(op));
    w.line(indent + 1, "}");
  }
  flush();
  for (const it of items) emitRoomItem(w, indent + 1, it);
  w.line(indent, "}");
}

function emitWall(w: W, indent: number, o: Obj): void {
  let head = `wall ${nameTok(o.name)} from (${fld(o, "start_x")}, ${fld(o, "start_y")}) to (${fld(o, "end_x")}, ${fld(o, "end_y")})`;
  if (has(o, "height")) head += ` height ${fld(o, "height")}`;
  if (has(o, "height_end")) head += ` height_end ${fld(o, "height_end")}`;
  if (o.facing !== undefined) head += ` facing ${o.facing}`;
  head += commonSuffix(o);
  const openings = Array.isArray(o.openings) ? (o.openings as Obj[]) : [];
  if (!openings.length) {
    w.line(indent, head);
    return;
  }
  w.line(indent, head + " {");
  for (const op of openings) w.line(indent + 1, emitOpening(op));
  w.line(indent, "}");
}

function emitPillar(w: W, indent: number, o: Obj): void {
  // A pillar may set only one footprint dimension; the omitted one is `auto`
  // (→ wall-thickness at render). size() would force both to 0.
  const pw = has(o, "width") ? fld(o, "width") : "auto";
  const pl = has(o, "length") ? fld(o, "length") : "auto";
  let s = `pillar ${nameTok(o.name)} ${at(o)} size (${pw}, ${pl})`;
  if (has(o, "height")) s += ` height ${fld(o, "height")}`;
  w.line(indent, s + commonSuffix(o, false));
}

function emitNamedBox(w: W, indent: number, kw: string, o: Obj, opts: { height?: boolean; thickness?: boolean; material?: boolean } = {}): void {
  let s = kw;
  if (o.name !== undefined) s += ` name ${str(o.name)}`;
  s += ` ${at(o)} ${size(o)}`;
  if (opts.thickness && has(o, "thickness")) s += ` thickness ${fld(o, "thickness")}`;
  if (opts.height && has(o, "height")) s += ` height ${fld(o, "height")}`;
  w.line(indent, s + commonSuffix(o, opts.material ?? false));
}

function emitStaircase(w: W, indent: number, o: Obj): void {
  let s = "staircase";
  if (o.name !== undefined) s += ` name ${str(o.name)}`;
  s += ` at (${fld(o, "start_x")}, ${fld(o, "start_y")}) step (${fld(o, "step_rise")}, ${fld(o, "step_tread")}, ${fld(o, "step_width")}) direction ${o.direction}`;
  if (o.climb !== undefined) s += ` climb ${o.climb}`;
  if (has(o, "rise_height")) s += ` total_height ${fld(o, "rise_height")}`;
  if (has(o, "max_run")) s += ` max_run ${fld(o, "max_run")}`;
  if (has(o, "landing_depth")) s += ` landing_depth ${fld(o, "landing_depth")}`;
  if (has(o, "landing_thickness")) s += ` landing_thickness ${fld(o, "landing_thickness")}`;
  if (o.turn !== undefined) s += ` turn ${o.turn}`;
  if (has(o, "flight_gap")) s += ` flight_gap ${fld(o, "flight_gap")}`;
  w.line(indent, s + commonSuffix(o));
}

function emitKitchen(w: W, indent: number, o: Obj): void {
  let s = "kitchen";
  if (o.name !== undefined) s += ` name ${str(o.name)}`;
  const path = (o.path ?? []).map((p: number[]) => `(${num(p[0])}, ${num(p[1])})`).join(", ");
  s += ` path (${path}) side ${o.side} depth ${fld(o, "depth")} height ${fld(o, "height")}`;
  if (has(o, "base_z")) s += ` base_z ${fld(o, "base_z")}`;
  w.line(indent, s + commonSuffix(o));
}

function emitItem(w: W, indent: number, o: Obj): void {
  let s = "item";
  if (o.name !== undefined) s += ` name ${str(o.name)}`;
  s += " " + assetText(o) + ` ${at(o)}`;
  if (has(o, "rotation")) s += ` rotation ${fld(o, "rotation")}`;
  if (has(o, "scale")) s += ` scale ${fld(o, "scale")}`;
  if (o.anchor_to !== undefined) s += ` anchor_to ${str(o.anchor_to)}`;
  if (o.anchor !== undefined) s += ` anchor ${o.anchor}`;
  if (has(o, "gap_x") || has(o, "gap_y")) s += ` gap (${fld(o, "gap_x")}, ${fld(o, "gap_y")})`;
  w.line(indent, s + commonSuffix(o, false));
}

function emitRigOp(o: Obj): string {
  const n = str(o.node);
  const v3 = (a: unknown) => {
    const t = (a as number[]) ?? [0, 0, 0];
    return `(${num(t[0])}, ${num(t[1])}, ${num(t[2])})`;
  };
  switch (o.op) {
    case "translate":
    case "rotate":
    case "scale":
      return `${o.op} ${n} ${v3(o.by)}`;
    case "visible":
      return `visible ${n} ${num(o.value)}`;
    case "material":
      return `material ${n} color ${str(o.color)}`;
    case "array": {
      let s = `array ${n} count ${num(o.count)}`;
      const steps: string[] = [];
      for (const k of ["translate", "rotate", "scale", "about"]) if (o[k]) steps.push(`${k} ${v3(o[k])}`);
      if (steps.length) s += ` step { ${steps.join(" ")} }`;
      return s;
    }
    default:
      return `visible ${n} 1`;
  }
}

function emitModel(w: W, indent: number, o: Obj): void {
  let s = "model";
  if (o.name !== undefined) s += ` name ${str(o.name)}`;
  s += " " + assetText(o) + ` ${at(o)}`;
  if (has(o, "rotation")) s += ` rotation ${fld(o, "rotation")}`;
  if (has(o, "scale")) s += ` scale ${fld(o, "scale")}`;
  s += commonSuffix(o, false);
  const rig = (o.rig as Obj[] | undefined) ?? [];
  if (!rig.length) {
    w.line(indent, s);
    return;
  }
  w.line(indent, s + " {");
  for (const op of rig) w.line(indent + 1, emitRigOp(op));
  w.line(indent, "}");
}

function emitComponentUse(w: W, indent: number, o: Obj): void {
  // config: { type:"component", ref:"[ns.]Name", name?, params?, x, y, ... }.
  // The config inlines imported components (keyed "ns.Name") and drops the import
  // source, so we decompile to a SELF-CONTAINED file: strip the namespace and
  // reference the (now-local) component by its base name.
  let s = `use ${baseName(o.ref)}`;
  if (o.name !== undefined) s += ` as ${str(o.name)}`;
  s += ` ${at(o)}`;
  if (has(o, "rotation")) s += ` rotation ${fld(o, "rotation")}`;
  const params = o.params ?? {};
  const args = Object.entries(params);
  if (args.length) s += ` with { ${args.map(([k, v]) => `${k} = ${val(v)}`).join(", ")} }`;
  w.line(indent, s + commonSuffix(o, false));
}

function slopeText(o: Obj): string | null {
  if (o.slope_left && o.slope_right) {
    return `slope angle (${num(o.slope_left.angle_deg)}, ${num(o.slope_right.angle_deg)})`;
  }
  if (o.slope) {
    return o.slope.by === "height" ? `slope height ${num(o.slope.ridge_h)}` : `slope angle ${num(o.slope.angle_deg)}`;
  }
  return null;
}

function emitSegment(w: W, indent: number, s: Obj): void {
  const start = s.start ?? [0, 0], end = s.end ?? [0, 0];
  let line = `segment ${str(s.id)} from (${fld2(s, "start", 0, start[0])}, ${fld2(s, "start", 1, start[1])}) to (${fld2(s, "end", 0, end[0])}, ${fld2(s, "end", 1, end[1])}) width ${fld(s, "width")}`;
  if (s.shed_high_side !== undefined) line += ` high_side ${s.shed_high_side}`;
  if (s.start_endpoint !== undefined) line += ` start_endpoint ${s.start_endpoint}`;
  if (s.end_endpoint !== undefined) line += ` end_endpoint ${s.end_endpoint}`;
  if (has(s, "hip_setback_start") || has(s, "hip_setback_end"))
    line += ` hip_setback (${fld(s, "hip_setback_start")}, ${fld(s, "hip_setback_end")})`;
  if (has(s, "gable_overhang_start") || has(s, "gable_overhang_end"))
    line += ` gable_overhang (${fld(s, "gable_overhang_start")}, ${fld(s, "gable_overhang_end")})`;
  if (has(s, "hip_ridge_extension_start") || has(s, "hip_ridge_extension_end"))
    line += ` hip_ridge_extension (${fld(s, "hip_ridge_extension_start")}, ${fld(s, "hip_ridge_extension_end")})`;
  for (const k of ["min_overhang", "overhang_start", "overhang_end", "overhang_low", "overhang_high", "overhang_left", "overhang_right"] as const) {
    if (has(s, k)) line += ` ${k === "min_overhang" ? "overhang" : k} ${fld(s, k)}`;
  }
  if (has(s, "tie_beam_count")) line += ` tie_beams ${num(Number(s.tie_beam_count))}`;
  w.line(indent, line);
}
// start/end are [x,y] arrays; formulas (if any) would be keyed e.g. "start_x".
function fld2(s: Obj, base: "start" | "end", i: 0 | 1, literal: number): string {
  const key = `${base}_${i === 0 ? "x" : "y"}`;
  const f = s.formulas?.[key];
  if (typeof f === "string") return f.replace(/^=\s*/, "").trim();
  return num(Number(literal));
}

function emitRoof(w: W, indent: number, o: Obj): void {
  let head = "roof";
  if (o.name !== undefined) head += ` name ${str(o.name)}`;
  head += ` ${o.roof_type}`;
  if (o.default_endpoint !== undefined) head += ` endpoint ${o.default_endpoint}`;
  const sl = slopeText(o);
  if (sl) head += " " + sl;
  if (has(o, "min_overhang")) head += ` overhang ${fld(o, "min_overhang")}`;
  if (has(o, "slab_thickness")) head += ` slab_thickness ${fld(o, "slab_thickness")}`;
  if (has(o, "parapet_height") || has(o, "parapet_thickness")) head += ` parapet ${fld(o, "parapet_height")} x ${fld(o, "parapet_thickness")}`;
  if (has(o, "gable_wall_thickness")) head += ` gable_wall_thickness ${fld(o, "gable_wall_thickness")}`;
  if (o.framing && typeof o.framing === "object") head += ` framing ${JSON.stringify(o.framing)}`;
  head += commonSuffix(o, false);
  if (o.material !== undefined) head += ` material ${str(o.material)}`;
  const segs = Array.isArray(o.segments) ? (o.segments as Obj[]) : [];
  const trusses = Array.isArray(o.trusses) ? (o.trusses as Obj[]) : [];
  w.line(indent, head + " {");
  for (const s of segs) emitSegment(w, indent + 1, s);
  for (const t of trusses) {
    const pos = (t.positions_along ?? []).map((p: number) => num(p)).join(", ");
    w.line(indent + 1, `truss ${str(t.segment_id)} ${t.type} at (${pos})`);
  }
  w.line(indent, "}");
}

function emitRaw(w: W, indent: number, o: Obj): void {
  const { type, ...body } = o;
  w.line(indent, `raw ${str(type)} ${JSON.stringify(body)}`);
}

// A generic field key emits BARE unless it collides with a HARD leader keyword
// (`at`, `size`, an object type) — those must be quoted (FieldKey STRING). Field-
// marker keywords (`total_height`, `radius`, `direction`, …) are SOFT (lexed as ID),
// so they read bare. x/y are bare-allowed by FieldKey too.
const keyTok = (k: string): string =>
  /^[A-Za-z_]\w*$/.test(k) && !HARD_KEYWORDS.has(k) ? k : str(k);

// A generic field's value: its formula (unwrapped) if any, else a quoted string
// or a number. Distinct from `fld`, which coerces every value to a number.
function genFieldVal(o: Obj, key: string, v: unknown): string {
  const f = o.formulas?.[key];
  if (typeof f === "string") return f.replace(/^=\s*/, "").trim();
  if (typeof v === "string") return str(v);
  if (typeof v === "number") return num(v);
  return "0";
}

// Generic primitive emit (§2.6): `type name? { key value … } <common>` — the
// framework path any object type can decompile through with no bespoke emitter.
// Only SCALAR (string/number) fields are expressible; anything nested (arrays /
// objects, e.g. roof segments) falls back to the raw JSON escape.
function emitObjectDecl(w: W, indent: number, o: Obj): void {
  const RESERVED = new Set(["type", "name", "formulas", "z_offset", "enabled", "layer"]);
  const entries = Object.entries(o).filter(([k]) => !RESERVED.has(k));
  const scalar = entries.every(
    ([, v]) => v === null || typeof v === "string" || typeof v === "number",
  );
  if (!scalar) return emitRaw(w, indent, o);
  let head = String(o.type);
  if (o.name !== undefined) head += ` ${nameTok(o.name)}`;
  const suffix = commonSuffix(o, false); // z_offset/enabled/layer (material is a field here)
  if (entries.length === 0) {
    w.line(indent, head + suffix);
    return;
  }
  w.line(indent, head + " {");
  for (const [k, v] of entries) w.line(indent + 1, `${keyTok(k)} ${genFieldVal(o, k, v)}`);
  w.line(indent, "}" + suffix);
}

// Bespoke `spiral_staircase` emit (a PROMOTED primitive): `at (x, y)` placement +
// named clauses, no braces — the inverse of the SpiralStaircase grammar rule.
function emitSpiralStaircase(w: W, indent: number, o: Obj): void {
  let s = "spiral_staircase";
  if (o.name !== undefined) s += ` ${nameTok(o.name)}`;
  s += ` ${at(o)} radius ${fld(o, "radius")} total_height ${fld(o, "total_height")}`;
  for (const f of ["turns", "steps", "tread_thickness", "pole_radius"]) {
    if (has(o, f)) s += ` ${f} ${fld(o, f)}`;
  }
  w.line(indent, s + commonSuffix(o, false));
}

function emitFloorObject(w: W, indent: number, o: Obj): void {
  switch (o.type) {
    case "room": return emitRoom(w, indent, o);
    case "wall": return emitWall(w, indent, o);
    case "pillar": return emitPillar(w, indent, o);
    case "beam": return emitNamedBox(w, indent, "beam", o, { height: true });
    case "floor_slab": return emitNamedBox(w, indent, "slab", o, { thickness: true });
    case "plinth": return emitNamedBox(w, indent, "plinth", o, { height: true, material: true });
    case "ground": return emitNamedBox(w, indent, "ground", o, { height: true, material: true });
    case "staircase": return emitStaircase(w, indent, o);
    case "spiral_staircase": return emitSpiralStaircase(w, indent, o);
    case "kitchen_platform": return emitKitchen(w, indent, o);
    case "item": return emitItem(w, indent, o);
    case "model": return emitModel(w, indent, o);
    case "component": return emitComponentUse(w, indent, o);
    case "roof": return emitRoof(w, indent, o);
    // Any other (contributed) type decompiles through the generic ObjectDecl path,
    // which itself falls back to `raw` for non-scalar fields.
    default: return emitObjectDecl(w, indent, o);
  }
}

// ---- header / parametric-core sections ------------------------------------

function emitVars(w: W, indent: number, vars: Record<string, unknown>): void {
  for (const [name, v] of Object.entries(vars)) w.line(indent, `var ${name} = ${val(v)}`);
}
function emitPoints(w: W, indent: number, points: Record<string, Obj>): void {
  for (const [name, p] of Object.entries(points)) w.line(indent, `point ${name} { x = ${val(p.x)}, y = ${val(p.y)} }`);
}
function emitGrids(w: W, indent: number, grids: Record<string, Obj>): void {
  const line = (l: Obj) => {
    let s = `${l.name} @ ${val(l.at)}`;
    if (l.thickness !== undefined) s += ` thick ${val(l.thickness)}`;
    if (l.role !== undefined) s += ` role ${l.role}`;
    return s;
  };
  for (const [name, g] of Object.entries(grids)) {
    w.line(indent, `grid ${name} {`);
    w.line(indent + 1, `x : ${(g.x ?? []).map(line).join(", ")}`);
    w.line(indent + 1, `y : ${(g.y ?? []).map(line).join(", ")}`);
    w.line(indent, `}`);
  }
}
const isId = (s: unknown): boolean => typeof s === "string" && /^[A-Za-z_]\w*$/.test(s);

// One configurator input → its DSL line, or null if the target isn't a plain
// identifier (dotted targets are hoisted to vars up front; anything still dotted
// here couldn't be mapped and is dropped — the configurator is UI metadata, not
// geometry). control is inferred by shape when the config omits it.
function configInputLine(i: Obj): string | null {
  if (!isId(i.target)) return null;
  const note = i.description ? ` note ${str(i.description)}` : "";
  const unit = i.unit ? ` ${i.unit}` : "";
  const ctrl = (i.control as string) ?? (Array.isArray(i.options) ? "select" : i.min !== undefined ? "slider" : "number");
  switch (ctrl) {
    case "slider":
      if (i.min === undefined || i.max === undefined) return null;
      return `slider ${i.target} ${str(i.label)}${unit} [${num(i.min)}..${num(i.max)}${i.step !== undefined ? ` step ${num(i.step)}` : ""}]${note}`;
    case "toggle":
      return `toggle ${i.target} ${str(i.label)}${note}`;
    case "select": {
      const opts = (i.options ?? []) as Obj[];
      if (!opts.length) return null;
      // Bare-identifier labels stay bare (Thin); anything else is a quoted display
      // string ("10 ft (standard)") — both are valid SelectOption labels now.
      const optText = opts.map((o) => `${isId(o.label) ? o.label : str(String(o.label))} = ${num(o.value)}`).join(", ");
      return `select ${i.target} ${str(i.label)} { ${optText} }${note}`;
    }
    default:
      return `number ${i.target} ${str(i.label)}${unit}${note}`;
  }
}

function emitConfigurator(w: W, indent: number, cfgr: Obj): void {
  // Emit the full owner-facing template: title, note, named group sections (each
  // wrapping its inputs), per-input notes, human-readable select labels.
  const inputs = Array.isArray(cfgr.inputs) ? (cfgr.inputs as Obj[]) : [];
  const groupsDef = Array.isArray(cfgr.groups) ? (cfgr.groups as Obj[]) : [];
  // group id → its definition. The id is an internal key (may be any string, even
  // a keyword like "size"); only the group LABEL is emitted (as `group "…"`).
  const byId = new Map<string, Obj>(groupsDef.map((g) => [String(g.id), g]));

  // Partition inputs → ungrouped (in order) + per-group (group-def order, then any
  // referenced-but-undeclared group in first-seen order).
  const ungrouped: Obj[] = [];
  const grouped = new Map<string, Obj[]>();
  const order: string[] = groupsDef.map((g) => String(g.id));
  for (const i of inputs) {
    const g = typeof i.group === "string" && i.group ? i.group : null;
    if (g) {
      if (!grouped.has(g)) { grouped.set(g, []); if (!byId.has(g)) order.push(g); }
      grouped.get(g)!.push(i);
    } else ungrouped.push(i);
  }

  // Render body first so an all-dropped configurator emits nothing.
  const body: [number, string][] = [];
  for (const i of ungrouped) { const l = configInputLine(i); if (l) body.push([indent + 1, l]); }
  for (const gid of order) {
    const lines = (grouped.get(gid) ?? []).map(configInputLine).filter((x): x is string => x !== null);
    if (!lines.length) continue; // grammar: a group needs ≥1 input
    const g = byId.get(gid);
    const gnote = g?.description ? ` note ${str(g.description)}` : "";
    body.push([indent + 1, `group ${str(g?.label ?? gid)}${gnote} {`]);
    for (const l of lines) body.push([indent + 2, l]);
    body.push([indent + 1, `}`]);
  }
  if (!body.some(([, t]) => !t.endsWith("{") && t !== "}")) return; // no real input line

  w.line(indent, "configurator {");
  if (cfgr.title) w.line(indent + 1, `title ${str(cfgr.title)}`);
  if (cfgr.description) w.line(indent + 1, `note ${str(cfgr.description)}`);
  for (const [ind, text] of body) w.line(ind, text);
  w.line(indent, "}");
}

// The self-describing catalog metadata block. Fields emit in the grammar's order.
function emitTemplate(w: W, indent: number, t: Obj): void {
  const lines: string[] = [];
  if (t.title) lines.push(`title ${str(t.title)}`);
  if (t.description) lines.push(`description ${str(t.description)}`);
  if (t.style) lines.push(`style ${str(t.style)}`);
  if (t.roof) lines.push(`roof ${str(t.roof)}`);
  if (Array.isArray(t.tags) && t.tags.length)
    lines.push(`tags ${(t.tags as unknown[]).map((s) => str(String(s))).join(", ")}`);
  // Cover-image PATHS only (relative to the .wdl). Never emit inline data URLs into
  // source — those live only in the compiled .wadi's top-level `thumbnails`.
  if (Array.isArray(t.thumbnails)) {
    const paths = (t.thumbnails as unknown[]).filter(
      (s): s is string => typeof s === "string" && !s.startsWith("data:"),
    );
    if (paths.length) lines.push(`thumbnails ${paths.map((s) => str(s)).join(", ")}`);
  }
  if (t.minWidthFt !== undefined && t.minLengthFt !== undefined)
    lines.push(`min_plot (${num(t.minWidthFt)}, ${num(t.minLengthFt)})`);
  if (!lines.length) return;
  w.line(indent, "template {");
  for (const l of lines) w.line(indent + 1, l);
  w.line(indent, "}");
}

// Hoist dotted configurator targets (`House.W`) to variables: the grammar binds a
// knob to a `var` (target=ID), not a point field. For each dotted target we
// synthesize a var holding the point coord's current value, rewrite the point to
// reference that var, and retarget the knob — geometry is unchanged (the var
// resolves to the same number, and existing `House.W` formula refs still resolve
// through the point). Mutates the (already-cloned) config.
function hoistConfiguratorTargets(config: Obj): void {
  const cfgr = config.configurator;
  if (!cfgr || !Array.isArray(cfgr.inputs)) return;
  const points = (config.points ??= {}) as Record<string, Obj>;
  const vars = (config.variables ??= {}) as Record<string, unknown>;
  const coordKey = (field: string): "x" | "y" | null => {
    const f = field.toLowerCase();
    if (f === "w" || f === "x" || f === "width") return "x";
    if (f === "l" || f === "y" || f === "length") return "y";
    return null;
  };
  const taken = new Set(Object.keys(vars));
  for (const input of cfgr.inputs as Obj[]) {
    const t = input.target;
    if (typeof t !== "string" || !t.includes(".")) continue;
    const dot = t.indexOf(".");
    const pt = t.slice(0, dot), field = t.slice(dot + 1);
    const key = coordKey(field);
    if (!key || !points[pt]) continue; // unmappable — configInputLine will drop it
    const cur = points[pt][key];
    // Already hoisted (the coord is `= <var>`)? just point the knob at that var.
    const m = typeof cur === "string" && cur.match(/^=\s*([A-Za-z_]\w*)\s*$/);
    if (m) { input.target = m[1]; continue; }
    let base = isId(field) ? field : `${pt}_${field}`;
    let name = base, k = 2;
    while (taken.has(name)) name = `${base}_${k++}`;
    taken.add(name);
    vars[name] = cur ?? 0;         // var takes the point's current value…
    points[pt][key] = `= ${name}`; // …and the point now references it
    input.target = name;           // knob drives the var
  }
}
function emitLayers(w: W, indent: number, layers: Obj[]): void {
  for (const l of layers) {
    let s = `layer ${str(l.id)} ${str(l.label ?? l.name ?? l.id)}`;
    if (l.color !== undefined) s += ` color ${str(l.color)}`;
    if (l.group !== undefined) s += ` group ${str(l.group)}`;
    w.line(indent, s);
  }
}

// "kb.Kitchen" → "Kitchen"; "Bench" → "Bench". Namespaces are flattened because a
// decompiled file is self-contained (no imports).
function baseName(ref: string): string {
  return ref.includes(".") ? ref.slice(ref.lastIndexOf(".") + 1) : ref;
}

function emitComponentDef(w: W, indent: number, name: string, def: Obj): void {
  let head = `component ${baseName(name)}`;
  if (def.goal !== undefined) head += ` goal ${str(def.goal)}`;
  // `expose as <ns.type>` promotes this component to a typed primitive (P0).
  const ex = def.expose as Obj | undefined;
  if (ex && typeof ex.type === "string") {
    head += ` expose as ${ex.type}`;
    if (ex.layer !== undefined) head += ` layer ${str(ex.layer)}`;
    if (ex.label !== undefined) head += ` label ${str(ex.label)}`;
  }
  w.line(indent, head + " {");
  if (def.params) for (const p of def.params as Obj[]) {
    let s = `param ${p.name}`;
    if (p.default !== undefined) s += ` = ${num(p.default)}`;
    if (p.label !== undefined) s += ` label ${str(p.label)}`;
    if (p.kind !== undefined) s += ` kind ${p.kind}`;
    if (p.unit !== undefined) s += ` unit ${str(p.unit)}`;
    w.line(indent + 1, s);
  }
  if (def.variables) emitVars(w, indent + 1, def.variables);
  if (def.points) emitPoints(w, indent + 1, def.points);
  for (const o of (def.objects ?? []) as Obj[]) emitFloorObject(w, indent + 1, o);
  w.line(indent, "}");
}

// ---- top level ------------------------------------------------------------

export function emitWdl(config: Obj, houseName = "House"): string {
  // Clone up front: hoistConfiguratorTargets mutates the config (synthesises vars,
  // rewrites points), and callers pass their own object.
  config = structuredClone(config);
  hoistConfiguratorTargets(config);
  const w = new W();
  const name = (typeof config.name === "string" && /^[A-Za-z_]\w*$/.test(config.name)) ? config.name : houseName;

  // Top-level component library (before `house`).
  if (config.components && typeof config.components === "object") {
    for (const [cname, def] of Object.entries(config.components as Record<string, Obj>)) emitComponentDef(w, 0, cname, def);
    w.blank();
  }

  w.line(0, `house ${name} {`);
  if (config.coord_convention === "center" || config.coord_convention === "outer")
    w.line(1, `convention ${config.coord_convention}`);
  if (config.units?.system)
    w.line(1, `units ${config.units.system}${config.units.per_unit !== undefined ? ` per_unit ${num(config.units.per_unit)}` : ""}`);
  if (config.site) {
    const s = config.site;
    let sl = `site { plot (${fld(s, "plot_width")}, ${fld(s, "plot_length")})`;
    if (s.reference_x || s.reference_y) sl += ` ref (${num(s.reference_x ?? 0)}, ${num(s.reference_y ?? 0)})`;
    w.line(1, sl + " }");
  }
  if (config.defaults) {
    const d = config.defaults;
    const parts: string[] = [];
    for (const k of ["floor_height", "wall_height", "slab_thickness", "wall_thickness"] as const)
      if (d[k] !== undefined) parts.push(`${k} ${num(d[k])}`);
    if (parts.length) w.line(1, `defaults { ${parts.join(" ")} }`);
  }
  if (config.template) emitTemplate(w, 1, config.template as Obj);
  if (config.variables && Object.keys(config.variables).length) { w.blank(); emitVars(w, 1, config.variables); }
  if (config.points && Object.keys(config.points).length) emitPoints(w, 1, config.points);
  if (config.grids && Object.keys(config.grids).length) { w.blank(); emitGrids(w, 1, config.grids); }
  if (config.configurator) { w.blank(); emitConfigurator(w, 1, config.configurator); }
  if (Array.isArray(config.layers) && config.layers.length) { w.blank(); emitLayers(w, 1, config.layers); }

  for (const floor of (config.floors ?? []) as Obj[]) {
    w.blank();
    let fh = `floor ${num(floor.floor_number)} ${str(floor.name)}`;
    if (floor.height !== undefined) fh += ` height ${num(floor.height)}`;
    if (floor.wall_height !== undefined) fh += ` wall_height ${num(floor.wall_height)}`;
    if (floor.slab_thickness !== undefined) fh += ` slab_thickness ${num(floor.slab_thickness)}`;
    if (floor.enabled !== undefined) fh += ` enabled ${val(floor.enabled === true ? 1 : floor.enabled === false ? 0 : floor.enabled)}`;
    w.line(1, fh + " {");
    for (const o of (floor.objects ?? []) as Obj[]) emitFloorObject(w, 2, o);
    w.line(1, "}");
  }

  w.line(0, "}");
  return w.toString();
}
