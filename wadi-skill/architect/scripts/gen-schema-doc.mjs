#!/usr/bin/env node
// Generate reference/data-model.md from the Zod schema (editor/src/schema/houseConfig.ts).
// The schema is the single source of truth; this doc is DERIVED so it can never drift.
// Parses the TypeScript source (not just Zod introspection) to capture the // comments,
// which carry the semantics an authoring agent needs (units, corner conventions, z_offset).
//
// Usage:  node gen-schema-doc.mjs <path-to-houseConfig.ts> [<out.md>]
// Re-run whenever the schema changes.

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SCHEMA = process.argv[2];
const OUT = process.argv[3] || null;
if (!SCHEMA) {
  console.error("usage: gen-schema-doc.mjs <houseConfig.ts> [out.md]");
  process.exit(1);
}

// Resolve the `typescript` package. The generator is a maintainer tool run inside
// the wadi repo; TypeScript lives in editor/node_modules. Try, in order: this
// script's own location, the editor package (two dirs above the schema), and cwd.
function loadTS() {
  const bases = [
    import.meta.url,
    pathToFileURL(resolve(dirname(SCHEMA), "../../package.json")).href,
    pathToFileURL(resolve(process.cwd(), "package.json")).href,
  ];
  for (const base of bases) {
    try { return createRequire(base)("typescript"); } catch { /* try next */ }
  }
  console.error('error: cannot resolve the "typescript" package. Run from the wadi repo with editor deps installed (npm --prefix editor i).');
  process.exit(1);
}
const ts = loadTS();
const src = readFileSync(SCHEMA, "utf8");
const sf = ts.createSourceFile(SCHEMA, src, ts.ScriptTarget.Latest, true);

// Some object schemas are GENERATED from `fields` (schema/fields/*) into
// generated/objects.generated.ts, then imported into houseConfig's union under an
// alias (e.g. `floor_slab as floorSlab`). That generated file carries each field's
// doc as a leading `//` comment (emitted by fieldsToZodSource) — the SAME comment
// style as hand-written fields — so we parse it with the identical machinery and
// merge. This keeps a single markdown-format path while the docs still derive from
// `fields`. Resolve the import to find the file + the alias→export name mapping.
function parseGeneratedImport() {
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st)) continue;
    const spec = st.moduleSpecifier;
    if (!ts.isStringLiteral(spec) || !/generated\/objects\.generated/.test(spec.text)) continue;
    const clause = st.importClause?.namedBindings;
    if (!clause || !ts.isNamedImports(clause)) continue;
    // localName (used in the union) → exported name (defined in the generated file)
    const aliasToExport = new Map();
    for (const el of clause.elements) {
      aliasToExport.set(el.name.text, (el.propertyName ?? el.name).text);
    }
    const path = resolve(dirname(SCHEMA), spec.text.replace(/\.js$/, "") + ".ts");
    return { path, aliasToExport };
  }
  return null;
}
const genImport = parseGeneratedImport();
const genSf = genImport
  ? ts.createSourceFile(genImport.path, readFileSync(genImport.path, "utf8"), ts.ScriptTarget.Latest, true)
  : null;

// ── helpers ────────────────────────────────────────────────────────────────
const isZ = (n) => n && ts.isIdentifier(n) && n.text === "z";
// Text / comments are read from each node's OWN source file, so nodes from both the
// schema file and the generated file resolve correctly.
const txt = (n) => n.getText(n.getSourceFile());

// Leading // and /** */ comments immediately above a node, joined to one paragraph.
function leadingComment(node) {
  const full = node.getSourceFile().getFullText();
  const ranges = ts.getLeadingCommentRanges(full, node.getFullStart()) || [];
  if (!ranges.length) return "";
  const lines = [];
  for (const r of ranges) {
    let c = full.slice(r.pos, r.end);
    c = c.replace(/^\/\*+/, "").replace(/\*+\/$/, "").replace(/^\/\//gm, "");
    for (let ln of c.split("\n")) {
      ln = ln.replace(/^\s*\*?\s?/, "").trim();
      if (ln && !/^[-─=]{3,}$/.test(ln)) lines.push(ln);
    }
  }
  // Drop section-divider dash runs (e.g. "---- Title ----") and squeeze whitespace.
  return lines.join(" ").replace(/[-─]{3,}/g, " ").replace(/\s{2,}/g, " ").trim();
}

// Unwrap chained calls (.strict()/.catchall()/.describe()) to the z.object({...}) literal.
function baseObjectLiteral(expr) {
  let e = expr;
  while (e && ts.isCallExpression(e)) {
    const callee = e.expression;
    if (ts.isPropertyAccessExpression(callee)) {
      if (callee.name.text === "object" && isZ(callee.expression)) {
        return e.arguments[0] && ts.isObjectLiteralExpression(e.arguments[0]) ? e.arguments[0] : null;
      }
      e = callee.expression;
    } else break;
  }
  return null;
}
const hasCatchall = (expr) => /\.catchall\(/.test(txt(expr));

// z.enum([...]) → ["a","b"]  (searches the expression subtree)
function enumValues(expr) {
  let found = null;
  const walk = (n) => {
    if (found) return;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
        n.expression.name.text === "enum" && isZ(n.expression.expression)) {
      const arr = n.arguments[0];
      if (arr && ts.isArrayLiteralExpression(arr)) {
        found = arr.elements.filter(ts.isStringLiteral).map((s) => s.text);
      }
      return;
    }
    n.forEachChild(walk);
  };
  walk(expr);
  return found;
}

// z.literal("x") → "x"
function literalValue(expr) {
  let v = null;
  const walk = (n) => {
    if (v !== null) return;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
        n.expression.name.text === "literal" && isZ(n.expression.expression)) {
      const a = n.arguments[0];
      if (a && ts.isStringLiteral(a)) v = a.text;
      return;
    }
    n.forEachChild(walk);
  };
  walk(expr);
  return v;
}

// ── collect top-level schema declarations ───────────────────────────────────
// name -> { kind, node, objLiteral?, catchall?, enum?, members?, discriminator?, typeLiteral? }
const decls = new Map();
function collectDecls(sourceFile) {
  for (const st of sourceFile.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || !d.initializer) continue;
      const name = d.name.text;
      const init = d.initializer;
      const t = txt(init);
      // discriminated union
      const duMatch = /z\.discriminatedUnion\(/.test(t);
      if (duMatch && ts.isCallExpression(init)) {
        const arr = init.arguments[1];
        const members = arr && ts.isArrayLiteralExpression(arr)
          ? arr.elements.filter(ts.isIdentifier).map((i) => i.text) : [];
        decls.set(name, { kind: "union", members });
        continue;
      }
      const obj = baseObjectLiteral(init);
      if (obj) {
        decls.set(name, {
          kind: "object", objLiteral: obj, catchall: hasCatchall(init),
          typeLiteral: null, comment: leadingComment(st),
        });
        continue;
      }
      const ev = enumValues(init);
      if (ev && /^z\.enum\(/.test(t)) {
        decls.set(name, { kind: "enum", values: ev, comment: leadingComment(st) });
        continue;
      }
      // simple alias (numOrFormula / formulaMap / enabledField / positive / …)
      decls.set(name, { kind: "alias", text: t.replace(/\s+/g, " ").trim() });
    }
  }
}
collectDecls(sf);
if (genSf) collectDecls(genSf); // generated primitives (beam, floor_slab, …)
// Register each generated schema under the ALIAS the union references it by
// (`floor_slab as floorSlab`), so union-member lookup below finds it unchanged.
if (genImport) {
  for (const [alias, exportName] of genImport.aliasToExport) {
    if (alias !== exportName && decls.has(exportName)) decls.set(alias, decls.get(exportName));
  }
}

// resolve each object's `type` literal (discriminator value)
for (const [, info] of decls) {
  if (info.kind !== "object") continue;
  for (const p of info.objLiteral.properties) {
    if (ts.isPropertyAssignment(p) && p.name.getText() === "type") {
      info.typeLiteral = literalValue(p.initializer);
    }
  }
}

// name of every schema that is a placeable object (member of the discriminated union)
const unionMembers = decls.get("object")?.members || [];

// ── type classification ─────────────────────────────────────────────────────
// Known alias names → friendly rendering + optional link target.
const ALIAS = {
  side: "enum: `north` `south` `east` `west`",
  numOrFormula: "number, or `\"= formula\"` string",
  formulaMap: "map: field name → `\"= formula\"` string",
  enabledField: "boolean or number (`false`/`0` = hidden)",
  positive: "number > 0",
  nonNegative: "number ≥ 0",
};
const LINK = {
  itemAsset: "ItemAsset", itemAnchor: "ItemAnchor", opening: "Opening",
  roomWallSide: "RoomWallSide", roomItem: "RoomItem", componentDef: "ComponentDef",
  componentParam: "ComponentParam", houseDefaults: "houseDefaults", houseUnits: "units",
  layerDef: "LayerDef", configuratorInput: "ConfiguratorInput",
  configuratorSection: "configurator", site: "site", floor: "floor",
  wallHeightsEntry: "wall_heights entry", object: "Object types",
  // Floors' `objects` array is `z.array(objectSchema)` (the built-in union OR a
  // registered-object fallback, since P1e). Link it to the object-types section.
  objectSchema: "Object types",
};
const anchor = (label) => `[${label}](#${String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")})`;

// substring inside the balanced (...) starting at the first "(" from `from`.
function inside(str, from) {
  const open = str.indexOf("(", from);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < str.length; i++) {
    if (str[i] === "(") depth++;
    else if (str[i] === ")") { if (--depth === 0) return str.slice(open + 1, i); }
  }
  return str.slice(open + 1);
}
// split a "a, b" arg list on top-level commas only.
function splitTopComma(s) {
  const out = []; let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim());
}

function typeName(text) {
  // normalise: collapse whitespace, and glue "z .record" → "z.record"
  let base = text.replace(/\s+/g, " ").replace(/\s+\./g, ".").trim();
  base = base.replace(/\.optional\(\)/g, "").replace(/\.describe\([^)]*\)/g, "").trim();

  const lit = /^z\.literal\(("[^"]*"|'[^']*')\)/.exec(base);
  if (lit) return "literal `" + lit[1].replace(/['"]/g, "") + "`";
  if (/^z\.number\(\)\.int\(\)\.nonnegative\(\)/.test(base)) return "integer ≥ 0";
  if (/^z\.number\(\)\.int\(\)/.test(base)) return "integer";
  if (/^z\.number\(\)\.positive\(\)/.test(base)) return "number > 0";
  if (/^z\.number\(\)\.nonnegative\(\)/.test(base)) return "number ≥ 0";
  if (/^positive\(\)/.test(base)) return "number > 0";
  if (/^nonNegative\(\)/.test(base)) return "number ≥ 0";
  if (/^z\.number\(\)/.test(base)) return "number";
  if (/^z\.string\(\)\.min\(1\)/.test(base)) return "string (non-empty)";
  if (/^z\.string\(\)/.test(base)) return "string";
  if (/^z\.boolean\(\)/.test(base)) return "boolean";
  if (/^z\.unknown\(\)/.test(base)) return "any (freeform)";
  if (/^z\.enum\(/.test(base)) {
    const arr = base.match(/\[([^\]]*)\]/);
    const vals = arr ? arr[1].split(",").map((x) => x.trim().replace(/['"]/g, "")).filter(Boolean) : [];
    return "enum: " + vals.map((v) => "`" + v + "`").join(" ");
  }
  if (/^z\.array\(/.test(base)) return "array of " + typeName(inside(base, 0));
  if (/^z\.tuple\(/.test(base)) {
    return "tuple `" + inside(base, 0).replace(/positive\(\)/g, "n>0").replace(/z\.number\(\)/g, "n").replace(/\s+/g, "") + "`";
  }
  if (/^z\.record\(/.test(base)) {
    const [k, v] = splitTopComma(inside(base, 0));
    return "map: " + typeName(k || "") + " → " + typeName(v || "");
  }
  if (/^z\.object\(/.test(base)) return "inline object";
  if (/^z\.union\(/.test(base)) return "union — see notes";
  if (ALIAS[base]) return ALIAS[base];
  if (LINK[base]) return anchor(LINK[base]);
  return "`" + base + "`";
}

function classify(initText) {
  return { type: typeName(initText), optional: /\.optional\(\)/.test(initText) };
}

// ── field rows for an object literal ────────────────────────────────────────
// Fields shown once up top. Of these, only formulas/enabled/layer are IDENTICAL on every
// object; type/name/material/z_offset genuinely differ (requiredness or per-object comment)
// so they keep their own notes in each object's table.
const CROSS = new Set(["type", "name", "enabled", "layer", "formulas", "material", "z_offset"]);
const SHARED_TERSE = new Set(["formulas", "enabled", "layer"]);

function fields(objLiteral) {
  const rows = [];
  for (const p of objLiteral.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const name = p.name.getText();
    const { type, optional } = classify(txt(p.initializer));
    rows.push({ name, type, optional, comment: leadingComment(p) });
  }
  return rows;
}

// Canonical rendering of the shared-tail fields (formulas/enabled/layer), taken from
// `room` (which keeps the nice `formulaMap`/`enabledField` aliases). Generated
// primitives encode the tail raw (`z.record(z.string(),z.string())` etc.), so their
// per-object rows would otherwise render it differently — mirror the canonical type
// so every object's shared rows read identically.
const sharedCanonType = {};
function renderTable(rows, { perObject = false } = {}) {
  let md = "| field | type | req | notes |\n|---|---|---|---|\n";
  for (const r of rows) {
    const req = r.optional ? "" : "**yes**";
    let note = r.comment || "";
    let type = r.type;
    if (perObject && SHARED_TERSE.has(r.name)) {
      note = "*(shared — see top)*";
      type = sharedCanonType[r.name] ?? type;
    }
    note = note.replace(/\|/g, "\\|").replace(/\n/g, " ");
    md += `| \`${r.name}\` | ${type} | ${req} | ${note} |\n`;
  }
  return md;
}

// ── build the document ──────────────────────────────────────────────────────
let out = "";
const p = (s = "") => (out += s + "\n");

p("# Wadi data model (`.wadi` / `house_config.json`)");
p();
p("> **Generated from `editor/src/schema/houseConfig.ts` — do not edit by hand.**");
p("> Regenerate: `node scripts/gen-schema-doc.mjs <path/to/houseConfig.ts> reference/data-model.md`");
p("> Some primitives (beam, floor_slab, pillar, plinth, ground) are generated from their");
p("> `fields` (schema/fields/\\*) into generated/objects.generated.ts — run `npm run gen-primitives`");
p("> in editor/ first if you changed those, so the generated schemas (which this doc reads) are current.");
p("> The Zod schema is the single source of truth; this file mirrors it (structure + the");
p("> semantics carried in its comments) so it can't drift.");
p();
p("A `.wadi` file is one JSON object matching **HouseConfig**. Geometry is in **project");
p("units** (a unitless grid; by default `units.per_unit = 10` means 10 units = 1 ft).");
p("Plan coordinates are **Inkscape-style**: origin top-left, **X → right, Y → down**.");
p("See `coordinate-system.md` for the coordinate/units detail and `parametric-conventions.md`");
p("for variables/points/formulas.");
p();

// cross-cutting fields
p("## Fields shared by (almost) every object");
p();
p("These appear on most object types; documented once here, marked *(cross-cutting)* below.");
p();
const anyObj = decls.get("room");
const crossRows = fields(anyObj.objLiteral).filter((r) => CROSS.has(r.name));
// Record room's canonical shared-tail types so every per-object table renders them
// identically (generated primitives encode the tail raw — see renderTable).
for (const r of crossRows) if (SHARED_TERSE.has(r.name)) sharedCanonType[r.name] = r.type;
p(renderTable(crossRows));
p();
p("- `type` — the discriminated-union tag; selects the object shape (values below).");
p("- `formulas` — per-field `\"= expression\"` overrides; the resolver evaluates each into the");
p("  matching numeric field. See `parametric-conventions.md`.");
p("- `z_offset` — vertical lift above the floor base (slab top). On-slab objects (room, wall,");
p("  staircase, kitchen_platform) default it to the floor's slab thickness; slab/beam/pillar/");
p("  roof default to 0.");
p();

// top-level HouseConfig
p("## Top level — HouseConfig");
p();
const hc = decls.get("HouseConfig");
if (hc?.objLiteral) p(renderTable(fields(hc.objLiteral)));
p();

// floor
p("## floor");
p();
const fl = decls.get("floor");
if (fl?.objLiteral) p(renderTable(fields(fl.objLiteral)));
p();

// object types
p("## Object types (`floors[].objects[]`)");
p();
p("Every entry in a floor's `objects` array is one of these, tagged by `type`:");
p();
for (const m of unionMembers) {
  const info = decls.get(m);
  if (!info?.objLiteral) continue;
  const title = info.typeLiteral || m;
  p(`### \`${title}\``);
  if (info.comment) p("\n" + info.comment + "\n");
  if (info.catchall) p("\n> **Freeform:** extra fields are allowed (`.catchall`) and validated at derivation time. See `roof-v2-guide.md`.\n");
  p(renderTable(fields(info.objLiteral), { perObject: true }));
  p();
}

// shared / nested schemas
p("## Shared & nested schemas");
p();
const SHARED = [
  ["site", "site"], ["houseDefaults", "houseDefaults"], ["houseUnits", "units"],
  ["opening", "Opening"], ["roomWallSide", "RoomWallSide"], ["roomItem", "RoomItem"],
  ["itemAsset", "ItemAsset"], ["componentDef", "ComponentDef"], ["componentParam", "ComponentParam"],
  ["layerDef", "LayerDef"], ["configuratorSection", "configurator"], ["configuratorInput", "ConfiguratorInput"],
];
for (const [key, title] of SHARED) {
  const info = decls.get(key);
  if (!info?.objLiteral) continue;
  p(`### ${title}`);
  if (info.comment) p("\n" + info.comment + "\n");
  p(renderTable(fields(info.objLiteral)));
  p();
}
// enums of interest
const ia = decls.get("itemAnchor");
if (ia?.kind === "enum") {
  p("### ItemAnchor");
  if (ia.comment) p("\n" + ia.comment + "\n");
  p("Enum: " + ia.values.map((v) => "`" + v + "`").join(" "));
  p();
}

const md = out.trimEnd() + "\n";
if (OUT) { writeFileSync(OUT, md); console.error("wrote " + OUT + " (" + md.split("\n").length + " lines)"); }
else process.stdout.write(md);
