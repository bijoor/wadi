// Parity test — legacy flat_roof derivation vs new v2 deriveFlatRoof.
// For every template with a flat_roof object, we run both and assert
// the derived slab footprint + Z match.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  deriveFlatRoofGeometry,
  type FlatRoofConfig,
} from "../flatGeometry";
import { oldRectRoofToSegments } from "./adapters";
import { deriveFlatRoof, flatSlabFootprint } from "./deriveFlat";

const here = path.dirname(fileURLToPath(import.meta.url));
// editor/src/svg2d/roof/v2 → editor/public/templates
const templatesDir = path.resolve(here, "..", "..", "..", "..", "public", "templates");

type LegacyObj = {
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  length?: number;
  overhang?: number;
  slab_thickness?: number;
  parapet_height?: number;
  parapet_thickness?: number;
  [k: string]: unknown;
};

type TemplateFile = {
  name: string;
  path: string;
  json: { floors?: Array<{ objects?: LegacyObj[] }> };
};

function loadTemplates(): TemplateFile[] {
  if (!fs.existsSync(templatesDir)) return [];
  const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith(".json") && f !== "index.json");
  return files.map((f) => {
    const p = path.join(templatesDir, f);
    return {
      name: f,
      path: p,
      json: JSON.parse(fs.readFileSync(p, "utf8")),
    };
  });
}

interface FlatCase {
  templateName: string;
  floorIdx: number;
  objIdx: number;
  legacy: LegacyObj;
}

function findFlatRoofs(templates: TemplateFile[]): FlatCase[] {
  const out: FlatCase[] = [];
  for (const t of templates) {
    const floors = t.json.floors ?? [];
    for (let fi = 0; fi < floors.length; fi++) {
      const objs = floors[fi].objects ?? [];
      for (let oi = 0; oi < objs.length; oi++) {
        if (objs[oi].type === "flat_roof") {
          out.push({ templateName: t.name, floorIdx: fi, objIdx: oi, legacy: objs[oi] });
        }
      }
    }
  }
  return out;
}

const templates = loadTemplates();
const cases = findFlatRoofs(templates);

describe("parity: legacy flat_roof vs deriveFlatRoof", () => {
  it("templates directory is present", () => {
    expect(templates.length).toBeGreaterThan(0);
  });

  if (cases.length === 0) {
    it.skip("no templates contain flat_roof objects", () => {});
    return;
  }

  // Use a synthetic wallTopZ so the parity test doesn't need the full
  // house-config machinery. Both sides receive the same value, so any
  // Z mismatch reflects a real derivation drift.
  const WALL_TOP_Z = 100;

  for (const c of cases) {
    it(`${c.templateName} floor ${c.floorIdx} obj ${c.objIdx} — slab footprint matches`, () => {
      // Legacy path
      const flatCfg = c.legacy as unknown as FlatRoofConfig;
      const legacyGeom = deriveFlatRoofGeometry(
        flatCfg,
        WALL_TOP_Z,
        Number(c.legacy.width ?? 300),
        Number(c.legacy.length ?? 400),
        Number(c.legacy.x ?? 0),
        Number(c.legacy.y ?? 0),
      );

      // v2 path
      const v2Cfg = oldRectRoofToSegments(c.legacy);
      const spec = deriveFlatRoof(v2Cfg, { wallTopZ: WALL_TOP_Z });
      const fp = flatSlabFootprint(spec);
      expect(fp).not.toBeNull();

      // Footprint bounds must match legacy eave_* fields.
      expect(fp!.x_min).toBeCloseTo(legacyGeom.eave_x_west, 6);
      expect(fp!.x_max).toBeCloseTo(legacyGeom.eave_x_east, 6);
      expect(fp!.y_min).toBeCloseTo(legacyGeom.eave_y_north, 6);
      expect(fp!.y_max).toBeCloseTo(legacyGeom.eave_y_south, 6);
      // Slab Z: v2 intentionally DROPS the legacy slab-thickness offset (the
      // flat slab now sits at wall-top like every other roof's eave), so the
      // v2 z is `legacyGeom.eave_z - slab_thickness` = WALL_TOP_Z here.
      expect(fp!.z).toBeCloseTo(WALL_TOP_Z, 6);
    });

    it(`${c.templateName} floor ${c.floorIdx} obj ${c.objIdx} — parapet preserved`, () => {
      const v2Cfg = oldRectRoofToSegments(c.legacy);
      const spec = deriveFlatRoof(v2Cfg, { wallTopZ: WALL_TOP_Z });
      const parapets = spec.planes.filter((p) => p.role === "parapet");
      const expectedParapetHeight = Number(c.legacy.parapet_height ?? 30);
      if (expectedParapetHeight > 0) {
        expect(parapets.length).toBe(4);
      } else {
        expect(parapets.length).toBe(0);
      }
    });
  }
});
