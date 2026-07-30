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

function room(r: ast.Room): Record<string, unknown> {
  const formulas: Record<string, string> = {};
  const put = (field: string, e: ast.Expr, ph: number) => {
    const { value, formula } = fieldAndFormula(e, ph);
    if (formula) formulas[field] = formula;
    return value;
  };
  const walls: Record<string, unknown> = {};
  for (const w of r.walls) {
    const openings = w.openings.map(opening);
    walls[w.side] = openings.length ? { openings } : {};
  }
  const obj: Record<string, unknown> = {
    type: "room",
    name: r.name,
    x: put("x", r.x, 0),
    y: put("y", r.y, 0),
    width: put("width", r.w, 1),
    length: put("length", r.l, 1),
  };
  if (Object.keys(walls).length) obj.walls = walls;
  if (Object.keys(formulas).length) obj.formulas = formulas;
  return obj;
}

function opening(o: ast.Opening): Record<string, unknown> {
  const formulas: Record<string, string> = {};
  const num = (field: string, e: ast.Expr | undefined, ph = 0): number | undefined => {
    if (!e) return undefined;
    const { value, formula } = fieldAndFormula(e, ph);
    if (formula) formulas[field] = formula;
    return value;
  };
  const obj: Record<string, unknown> = {
    kind: o.kind,
    name: o.name,
    offset: num("offset", o.offset),
    width: num("width", o.width, 1),
    height: num("height", o.height, 1),
  };
  if (o.sill !== undefined) obj.sill_height = num("sill_height", o.sill);
  if (Object.keys(formulas).length) obj.formulas = formulas;
  return obj;
}

function pillar(p: ast.Pillar): Record<string, unknown> {
  const formulas: Record<string, string> = {};
  const put = (field: string, e: ast.Expr | undefined, ph: number): number | undefined => {
    if (!e) return undefined;
    const { value, formula } = fieldAndFormula(e, ph);
    if (formula) formulas[field] = formula;
    return value;
  };
  const obj: Record<string, unknown> = {
    type: "pillar",
    name: p.name,
    x: put("x", p.x, 0),
    y: put("y", p.y, 0),
    width: put("width", p.w, 1),
    length: put("length", p.l, 1),
  };
  const h = put("height", p.height, 1);
  if (h !== undefined) obj.height = h;
  if (Object.keys(formulas).length) obj.formulas = formulas;
  return obj;
}

function floorObject(o: ast.FloorObject): Record<string, unknown> {
  switch (o.$type) {
    case "Room":
      return room(o as ast.Room);
    case "Pillar":
      return pillar(o as ast.Pillar);
    case "Raw": {
      const raw = o as ast.Raw;
      return { type: unquote(raw.type), ...jsonObject(raw.body) };
    }
    default:
      throw new Error(`unhandled object: ${(o as unknown as { $type: string }).$type}`);
  }
}

// ---- Top level -----------------------------------------------------------

export function modelToHouseConfig(model: ast.Model): Record<string, unknown> {
  const cfg: Record<string, unknown> = {};

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
    const inputs = model.configurators[0].inputs.map(configInput);
    cfg.configurator = { inputs };
  }

  cfg.floors = model.floors.map((f) => ({
    floor_number: Math.round(f.number),
    name: unquote(f.name),
    objects: f.objects.map(floorObject),
  }));

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
      return o;
    }
    case "NumberInput": {
      const n = i as ast.NumberInput;
      const o: Record<string, unknown> = { target: n.target, label: unquote(n.label), control: "number" };
      if (n.unit) o.unit = n.unit;
      return o;
    }
    case "ToggleInput": {
      const t = i as ast.ToggleInput;
      return { target: t.target, label: unquote(t.label), control: "toggle" };
    }
    case "SelectInput": {
      const s = i as ast.SelectInput;
      return {
        target: s.target,
        label: unquote(s.label),
        control: "select",
        options: s.options.map((op) => ({ value: op.value, label: op.label })),
      };
    }
    default:
      throw new Error(`unhandled configurator input: ${(i as unknown as { $type: string }).$type}`);
  }
}

// ---- Parse entry point ---------------------------------------------------

export function compileDsl(text: string): Record<string, unknown> {
  const services = createWadiServices(EmptyFileSystem).Wadi;
  const result = services.parser.LangiumParser.parse<ast.Model>(text);
  if (result.lexerErrors.length || result.parserErrors.length) {
    const msgs = [
      ...result.lexerErrors.map((e) => `lex: ${e.message}`),
      ...result.parserErrors.map((e) => `parse: ${e.message}`),
    ];
    throw new Error(`DSL parse failed:\n  ${msgs.join("\n  ")}`);
  }
  return modelToHouseConfig(result.value);
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
let sharedServices: ReturnType<typeof createWadiServices>["Wadi"] | undefined;
export function compileWithDiagnostics(text: string): {
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
    return { config: modelToHouseConfig(result.value), diagnostics: [] };
  } catch (e) {
    return {
      diagnostics: [
        { message: (e as Error).message, startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 2 },
      ],
    };
  }
}
