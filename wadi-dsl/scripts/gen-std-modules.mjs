// Generate the bundled `std-*` DSL modules from their single source of truth, so
// the module a design imports and the engine table it mirrors can never drift.
//
//   std-furniture.wdl  ←  editor/src/furniture/catalog.ts (FURNITURE_CATALOG)
//
// Run:  node wadi-dsl/scripts/gen-std-modules.mjs   (via tsx, from the repo root)
// It writes wadi-dsl/std-modules/*.wdl. Re-run whenever the catalog changes; the
// generated file is committed (it's data, and the MCP/app bundle it directly).

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FURNITURE_CATALOG, REMOTE_FURNITURE_URL } from "../../editor/src/furniture/catalog.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "std-modules");
mkdirSync(outDir, { recursive: true });

// A DSL string literal — the catalog holds only plain ASCII names, but escape defensively.
const q = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
// Trim a float the way the DSL prints it (2.0 → 2), matching furnitureAsset output.
const n = (x) => String(x);

const src = (id) => `${REMOTE_FURNITURE_URL.replace(/\/+$/, "")}/${id}.glb`;

function furnitureModule() {
  const lines = [
    "// std-furniture.wdl — the built-in CC0 furniture pack (Kenney Furniture Kit).",
    "// GENERATED from editor/src/furniture/catalog.ts by wadi-dsl/scripts/gen-std-modules.mjs.",
    "// Do not edit by hand: `import \"std-furniture\" as f` then `item f.\"<id>\"`.",
    "",
  ];
  let category = "";
  for (const a of FURNITURE_CATALOG) {
    if (a.category !== category) {
      category = a.category;
      lines.push(`// ${category}`);
    }
    const [dx, dy, dz] = a.dimensions;
    lines.push(
      `asset ${q(a.id)} src ${q(src(a.id))} dims (${n(dx)}, ${n(dy)}, ${n(dz)}) ` +
        `name ${q(a.name)} category ${q(a.category)}`,
    );
  }
  return lines.join("\n") + "\n";
}

const file = resolve(outDir, "std-furniture.wdl");
writeFileSync(file, furnitureModule());
console.log(`wrote ${file} (${FURNITURE_CATALOG.length} assets)`);
