// Bill of Materials estimator: floor slabs, roof surface, compound walls,
// wells, solar panels, reinforcement steel, and room-wall brickwork (via
// wallArea.ts). Pure + synchronous — no bpy, no DOM — mirrors the style of
// wallArea.ts so it can run in the viewer panel builder, in Node tests, or a CLI.

import { computeWallAreas, type AreaUnits } from "./wallArea";
import { computeMergedV2Spec } from "../svg2d/roof/v2/computeFromHouse";
import type { HouseConfig } from "../svg2d/expand";

type Bag = Record<string, unknown>;
const num = (v: unknown, d = 0): number =>
  (typeof v === "number" && isFinite(v) ? v : d);

// Convert volume in project-units³ → m³.
// 1 sq project-unit = u.toSqm(1) m², so 1 project-unit = sqrt(u.toSqm(1)) m,
// and 1 cu project-unit = u.toSqm(1)^(3/2) m³.
function toCubicM(u: AreaUnits, volU: number): number {
  return volU * Math.pow(u.toSqm(1), 1.5);
}

// Signed area magnitude of a 3-D polygon via fan triangulation from vertex 0.
function poly3DArea(verts: ReadonlyArray<readonly [number, number, number]>): number {
  if (verts.length < 3) return 0;
  let ax = 0, ay = 0, az = 0;
  const [x0, y0, z0] = verts[0];
  for (let i = 1; i < verts.length - 1; i++) {
    const [x1, y1, z1] = verts[i];
    const [x2, y2, z2] = verts[i + 1];
    ax += (y1 - y0) * (z2 - z0) - (z1 - z0) * (y2 - y0);
    ay += (z1 - z0) * (x2 - x0) - (x1 - x0) * (z2 - z0);
    az += (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  }
  return 0.5 * Math.sqrt(ax * ax + ay * ay + az * az);
}

// ---- report types ----------------------------------------------------------

export interface QuantityRow {
  label: string;
  area?: string;     // formatted, e.g. "1,200 sq ft"
  volume?: string;   // e.g. "8.40 m³"
  count?: string;    // e.g. "4,200 bricks" or "14 panels"
  capacity?: string; // e.g. "3.5 kWp"
  notes?: string;
}

export interface QuantitySection {
  title: string;
  rows: QuantityRow[];
  subtotal?: string; // e.g. "Total: 42.00 m³"
}

export interface QuantityReport {
  sections: QuantitySection[];
  units: AreaUnits;
}

// ---- formatters ------------------------------------------------------------

const fmtVol  = (m3: number): string => m3.toFixed(2) + " m³";
const fmtBricks = (m3: number): string =>
  Math.round(m3 * 500).toLocaleString() + " bricks";
function fmtArea(u: AreaUnits, areaU: number): string {
  return Math.round(u.toDisplay(areaU)).toLocaleString() + " " + u.sqLabel;
}
function linearUnit(u: AreaUnits): string {
  return u.sqLabel.replace("sq ", "").replace("²", "");
}

// ---- section builders ------------------------------------------------------

function buildSlabSection(
  config: HouseConfig,
  u: AreaUnits,
): { section: QuantitySection; totalM3: number } {
  const defaults = (config as Bag).defaults as Bag | undefined;
  const defSlab = num(defaults?.slab_thickness);
  const floors = ((config as Bag).floors ?? []) as Bag[];
  const rows: QuantityRow[] = [];
  let totalM3 = 0;

  for (let fi = 0; fi < floors.length; fi++) {
    const fl = floors[fi];
    const slabT = num(fl.slab_thickness, defSlab);
    if (slabT <= 0) continue;
    let areaU = 0;
    for (const o of ((fl.objects ?? []) as Bag[])) {
      if (o.type !== "room" || o.enabled === false) continue;
      areaU += num(o.width) * num(o.length);
    }
    if (areaU <= 0) continue;
    const m3 = toCubicM(u, areaU * slabT);
    totalM3 += m3;
    rows.push({
      label: `Concrete slab — ${String(fl.name ?? `Floor ${fi}`)}`,
      area: fmtArea(u, areaU),
      volume: fmtVol(m3),
    });
  }

  return {
    section: {
      title: "Concrete (floor slabs)",
      rows: rows.length > 0 ? rows : [{ label: "No slabs (slab_thickness = 0 on all floors)" }],
      subtotal: totalM3 > 0 ? `Total: ${fmtVol(totalM3)}` : undefined,
    },
    totalM3,
  };
}

function buildBrickworkRoomSection(config: HouseConfig, u: AreaUnits): QuantitySection {
  const defaults = (config as Bag).defaults as Bag | undefined;
  const wallT = num(defaults?.wall_thickness, 8);
  const r = computeWallAreas(config);
  const extM3 = toCubicM(u, r.external.net * wallT);
  const intM3 = toCubicM(u, r.internal.net * wallT);

  return {
    title: "Brickwork (room walls)",
    rows: [
      {
        label: "External walls",
        area: fmtArea(u, r.external.net),
        volume: fmtVol(extM3),
        count: fmtBricks(extM3),
        notes: "Net of openings",
      },
      {
        label: "Internal walls",
        area: fmtArea(u, r.internal.net),
        volume: fmtVol(intM3),
        count: fmtBricks(intM3),
      },
    ],
    subtotal: `Total: ${fmtVol(extM3 + intM3)}`,
  };
}

function buildCompoundWallSection(config: HouseConfig, u: AreaUnits): QuantitySection {
  const rows: QuantityRow[] = [];
  let totalM3 = 0;

  for (const fl of ((config as Bag).floors ?? []) as Bag[]) {
    for (const o of ((fl.objects ?? []) as Bag[])) {
      if (o.type !== "compound_wall" || o.enabled === false) continue;
      const w = num(o.width), l = num(o.length), h = num(o.height);
      const m3 = toCubicM(u, w * l * h);
      totalM3 += m3;
      const lu = linearUnit(u);
      rows.push({
        label: String(o.name ?? "Compound wall"),
        volume: fmtVol(m3),
        count: fmtBricks(m3),
        notes: `${(w / u.perUnit).toFixed(1)}×${(l / u.perUnit).toFixed(1)}×${(h / u.perUnit).toFixed(1)} ${lu}`,
      });
    }
  }

  if (rows.length === 0) rows.push({ label: "No compound walls defined" });
  return {
    title: "Brickwork (compound walls)",
    rows,
    subtotal: totalM3 > 0
      ? `Total: ${fmtVol(totalM3)} / ${Math.round(totalM3 * 500).toLocaleString()} bricks`
      : undefined,
  };
}

// Roof surface roles that count as tile / sheeting area (excludes masonry
// gable walls and parapets, which are brickwork rather than roofing).
const ROOF_SURFACE_ROLES = new Set(["slope", "hip_face", "flat_slab"]);

function buildRoofSection(config: HouseConfig, u: AreaUnits): QuantitySection {
  let totalU = 0;
  try {
    const spec = computeMergedV2Spec(config, { filter: "all" });
    for (const p of spec.planes) {
      if (!ROOF_SURFACE_ROLES.has(p.role)) continue;
      const v = p.vertices;
      if (!v || v.length < 3) continue;
      totalU += poly3DArea(v as ReadonlyArray<readonly [number, number, number]>);
    }
  } catch {
    // roof spec failure must not blank the rest of the BOM
  }

  const rows: QuantityRow[] = totalU > 0
    ? [{ label: "Roof surface area", area: fmtArea(u, totalU), notes: "Inclined area — tiles / sheeting" }]
    : [{ label: "No roof defined" }];

  return {
    title: "Roof (tiles / sheeting)",
    rows,
    subtotal: totalU > 0 ? `Total: ${fmtArea(u, totalU)}` : undefined,
  };
}

const WELL_RING_T = 1.5; // project units — standard masonry ring wall

function buildWellSection(config: HouseConfig, u: AreaUnits): QuantitySection {
  const rows: QuantityRow[] = [];

  for (const fl of ((config as Bag).floors ?? []) as Bag[]) {
    for (const o of ((fl.objects ?? []) as Bag[])) {
      if (o.type !== "well" || o.enabled === false) continue;
      const shape = String(o.shape ?? "circular");
      const ph = num(o.parapet_height, 10);
      const perim = shape === "circular"
        ? Math.PI * num(o.diameter, 30)
        : 2 * (num(o.width, 30) + num(o.length ?? o.width, 30));
      const m3 = toCubicM(u, perim * ph * WELL_RING_T);
      const lu = linearUnit(u);
      rows.push({
        label: String(o.name ?? "Well"),
        volume: fmtVol(m3),
        notes: `${shape}, parapet ${(ph / u.perUnit).toFixed(1)} ${lu}`,
      });
    }
  }

  if (rows.length === 0) rows.push({ label: "No wells defined" });
  return { title: "Masonry (wells)", rows };
}

function buildSolarSection(config: HouseConfig): QuantitySection {
  const rows: QuantityRow[] = [];
  let totalKw = 0;

  for (const fl of ((config as Bag).floors ?? []) as Bag[]) {
    for (const o of ((fl.objects ?? []) as Bag[])) {
      if (o.type !== "solar_panel" || o.enabled === false) continue;
      const kw = num(o.capacity_kw);
      const panels = o.panel_count !== undefined ? num(o.panel_count) : undefined;
      totalKw += kw;
      rows.push({
        label: String(o.name ?? "Solar array"),
        capacity: kw > 0 ? kw.toFixed(1) + " kWp" : "—",
        count: panels !== undefined ? `${panels} panels` : undefined,
        notes: `mount: ${String(o.mount ?? "roof")}, azimuth ${num(o.azimuth, 180)}°`,
      });
    }
  }

  if (rows.length === 0) rows.push({ label: "No solar panels defined" });
  return {
    title: "Solar (PV arrays)",
    rows,
    subtotal: totalKw > 0 ? `Total installed: ${totalKw.toFixed(1)} kWp` : undefined,
  };
}

function buildSteelSection(concreteM3: number): QuantitySection {
  const kg = Math.round(concreteM3 * 24); // 1% of concrete × 2,400 kg/m³
  return {
    title: "Reinforcement steel (approx.)",
    rows: [
      {
        label: "Reinforcement steel",
        count: kg > 0 ? kg.toLocaleString() + " kg" : "—",
        notes: "1% of concrete vol × 2,400 kg/m³ → 24 kg/m³",
      },
    ],
  };
}

// ---- main ------------------------------------------------------------------

export function computeQuantities(config: HouseConfig): QuantityReport {
  const u = computeWallAreas(config).units;
  const { section: slabs, totalM3: slabM3 } = buildSlabSection(config, u);

  return {
    sections: [
      slabs,
      buildBrickworkRoomSection(config, u),
      buildCompoundWallSection(config, u),
      buildRoofSection(config, u),
      buildWellSection(config, u),
      buildSolarSection(config),
      buildSteelSection(slabM3),
    ],
    units: u,
  };
}
