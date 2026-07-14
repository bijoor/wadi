// TypeScript port of svg_2d.py::generate_elevation_view. Aims for
// byte-identical output vs. the checked-in Python reference SVGs in
// ../docs/elevation_{front,back,left,right}.svg.
//
// Numeric formatting: Python emits `f"{v}"` where `v` may be int or
// float. Every value in this port must be traced to its numeric provenance
// to pick between `f()` (int-style) and `fFloat()` (Python-float-style
// with trailing `.0` on whole values). Because most quantities here
// derive from float arithmetic (division, math.tan, subtraction from
// total_height which is float, etc.), the majority of emissions use
// `fFloat`. Integer literals (0, wall widths from JSON ints) stay `f`.
//
// The Python debug-dump of `objects_debug_*.json` is intentionally NOT
// reproduced — that side effect is disk I/O we don't want in the browser.

import { DEFAULT_GLOBAL_CONFIG } from "./config";
import { f, fFloat } from "./format";
import { svgDrawDimensionLine } from "./dimensions";
import { deriveAllHipRoofs } from "./roofGeometry";
import { deriveAllGableRoofs } from "./roof/gableGeometry";
import type { HouseConfig } from "./expand";

type Obj = Record<string, unknown>;

interface FloorConfig {
  floor_number?: number;
  name?: string;
  objects?: Obj[];
}

interface DrawObject {
  type: string;
  name: string;
  depth: number;
  priority: number;
  x: number;
  width: number;
  height: number;
  height_end?: number;
  z: number;
  fill?: string;
  num_steps?: number;
  openings?: Obj[];
  coord_key?: string | null;
  floor_height_expected?: number;
}

interface FloorLevel {
  name: string;
  z?: number;
  z_bottom?: number;
  z_top?: number;
  height: number;
}

interface ElevationOpening {
  type: string;
  x: number;
  z_bottom: number;
  width: number;
  height: number;
  sill_height: number;
  wall_start: number;
  wall_width: number;
  wall_name: string;
}

interface WallCustom {
  name: string;
  x: number;
  width: number;
  z: number;
  height_start: number;
  height_end: number;
  is_sloping: boolean;
  expected_height: number;
}

export function generateElevationView(
  houseConfig: HouseConfig & Record<string, unknown>,
  viewType: "front" | "back" | "left" | "right",
  scale = 2.0,
): string {
  const site = (houseConfig.site as Record<string, unknown> | undefined) ?? {};
  void site;
  const plinthConfig =
    (houseConfig.plinth as Record<string, unknown> | undefined) ?? {};
  const floors = (houseConfig.floors as FloorConfig[] | undefined) ?? [];
  const GC = DEFAULT_GLOBAL_CONFIG;

  // Per-roof derivation (Python's setdefault semantics per roof, but
  // each roof gets its OWN derived geometry — Phase 2 lets each roof
  // have its own x/y/width/length so applying one derivation to all
  // roofs would draw them at wrong positions.
  try {
    const derivedRoofs = deriveAllHipRoofs(houseConfig, GC);
    for (const dh of derivedRoofs) {
      const target = dh.config as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(dh.geom)) {
        if (!(k in target)) target[k] = v;
      }
    }
  } catch {
    // legacy hip_roof configs continue to work
  }
  // Same for gable roofs — populate the derived geometry onto each
  // gable_roof object so the draw loop below can read absolute
  // eave/ridge coords.
  try {
    const derivedGables = deriveAllGableRoofs(houseConfig, GC);
    for (const dg of derivedGables) {
      const target = dg.config as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(dg.geom)) {
        if (!(k in target)) target[k] = v;
      }
    }
  } catch {
    // partial gable configs skipped
  }

  const buildingWidth = (plinthConfig.width as number | undefined) ?? 0;
  const buildingLength = (plinthConfig.length as number | undefined) ?? 0;
  const wallThickness = GC.wall_thickness;

  let width: number;
  let viewName: string;
  if (viewType === "front" || viewType === "back") {
    width = buildingWidth;
    viewName = viewType === "front" ? "Front Elevation" : "Back Elevation";
  } else {
    width = buildingLength;
    viewName = viewType === "left" ? "Left Elevation" : "Right Elevation";
  }

  const plinthHeight =
    (plinthConfig.height as number | undefined) ?? GC.plinth_height;
  let totalHeight = plinthHeight;

  for (const floorConfig of floors) {
    const floorNum = floorConfig.floor_number ?? 0;
    // Per-floor override wins over the GlobalConfig default.
    // Fallback chain: per-floor override → house-level defaults →
    // global default.
    const houseDefaults = (houseConfig as { defaults?: { floor_height?: number } }).defaults;
    const floorHeight =
      (floorConfig.height as number | undefined) ??
      houseDefaults?.floor_height ??
      GC.floor_height ??
      100;
    totalHeight += floorHeight;
  }

  // Check for roof
  for (const floorConfig of floors) {
    for (const obj of (floorConfig.objects ?? []) as Obj[]) {
      if (obj.type === "gable_roof") {
        // Prefer the derived absolute ridge top set by deriveAllGableRoofs:
        //   ridgeTop = eave_z + wall_top_above_eave + ridge_h + roof_thickness
        // Fall back to the legacy Python `ridge_z` if present.
        const eaveZ = obj.eave_z as number | undefined;
        const wte = obj.wall_top_above_eave as number | undefined;
        const rh = obj.ridge_h as number | undefined;
        if (eaveZ !== undefined && rh !== undefined) {
          const ridgeTop = eaveZ + (wte ?? 0) + rh + GC.roof_thickness;
          totalHeight = Math.max(totalHeight, ridgeTop);
        } else {
          const ridgeZ = (obj.ridge_z as number | undefined) ?? 0;
          totalHeight = Math.max(totalHeight, ridgeZ);
        }
      } else if (obj.type === "hip_roof") {
        const spanX = (obj.eave_x_east as number) - (obj.eave_x_west as number);
        const spanY = (obj.eave_y_south as number) - (obj.eave_y_north as number);
        const uniform = obj.slope_angle as number | undefined;
        const angEw = (obj.slope_angle_ew as number | undefined) ?? uniform;
        const angNs = (obj.slope_angle_ns as number | undefined) ?? uniform;
        let h: number;
        if (((obj.ridge_axis as string | undefined) ?? "y") === "y") {
          h = (spanX / 2.0) * Math.tan(((angEw as number) * Math.PI) / 180);
        } else {
          h = (spanY / 2.0) * Math.tan(((angNs as number) * Math.PI) / 180);
        }
        totalHeight = Math.max(totalHeight, (obj.eave_z as number) + h);
      }
    }
  }

  const dimCfg = GC.dimensions;
  let horizontalMargin: number;
  let verticalMargin: number;
  let titleSpace: number;
  if (dimCfg.show_outer_dimensions) {
    horizontalMargin = 150;
    verticalMargin = 150;
    titleSpace = 60;
  } else {
    horizontalMargin = 50;
    verticalMargin = 50;
    titleSpace = 40;
  }

  const svgWidth = width * scale + 2 * horizontalMargin;
  const svgHeight = totalHeight * scale + 2 * verticalMargin + titleSpace;

  // Python: `f"{svgWidth}"` — svgWidth = width*scale + 2*margin. scale=2.0
  // (float) → svgWidth is float. Emit via fFloat.

  const zToY = (z: number): number => totalHeight - z;

  const worldToSvgX = (coord: number, objWidth = 0): number => {
    if (viewType === "front") return width - (coord + objWidth);
    if (viewType === "right") return width - (coord + objWidth);
    return coord;
  };

  const contentTopMargin = verticalMargin + titleSpace;
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${fFloat(svgWidth)}" height="${fFloat(svgHeight)}" viewBox="0 0 ${fFloat(svgWidth)} ${fFloat(svgHeight)}">
<title>${viewName}</title>
<defs>
    <style>
        text { font-family: Arial, sans-serif; }
    </style>
</defs>
<g transform="translate(${f(horizontalMargin)}, ${f(contentTopMargin)}) scale(${fFloat(scale)}, ${fFloat(scale)})">

`;

  // Ground line
  const groundY = zToY(0);
  svg += `<line x1="0" y1="${fFloat(groundY)}" x2="${f(width)}" y2="${fFloat(groundY)}" stroke="#666" stroke-width="2" stroke-dasharray="5,5"/>\n`;

  // Plinth
  const plinthBottomY = zToY(0);
  const plinthTopY = zToY(plinthHeight);
  svg += `<rect x="0" y="${fFloat(plinthTopY)}" width="${f(width)}" height="${fFloat(plinthBottomY - plinthTopY)}" fill="#A0826D" stroke="#000" stroke-width="1"/>\n`;

  let currentZ = plinthHeight;

  const floorLevels: FloorLevel[] = [
    { name: "Ground Level", z: 0, height: plinthHeight },
    { name: "Plinth Top", z: plinthHeight, height: 0 },
  ];

  const elevationOpenings: ElevationOpening[] = [];
  const wallsWithCustomHeights: WallCustom[] = [];
  let roofSvg = "";

  const slabThickness = GC.floor_slab_thickness;
  const beamSize = GC.beam_size;
  const typePriority = GC.elevation_rendering_priority;

  const allObjectsToDraw: DrawObject[] = [];

  for (const floorConfig of floors) {
    const floorNum = floorConfig.floor_number ?? 0;
    // Fallback chain: per-floor override → house-level defaults →
    // global default.
    const houseDefaults = (houseConfig as { defaults?: { floor_height?: number } }).defaults;
    const floorHeight =
      (floorConfig.height as number | undefined) ??
      houseDefaults?.floor_height ??
      GC.floor_height ??
      100;

    const floorObjectsWithDepth: [number, number, Obj][] = [];

    for (const obj of (floorConfig.objects ?? []) as Obj[]) {
      const objType = obj.type as string;
      let depth = 0;
      const priority = typePriority[objType] ?? 2;

      if (viewType === "front") {
        if (["floor_slab", "beam", "staircase"].includes(objType)) {
          depth = (obj.y as number | undefined) ?? 0;
        } else if (objType === "room") {
          depth = (obj.y as number | undefined) ?? 0;
        } else if (objType === "wall") {
          depth = Math.min(
            (obj.start_y as number | undefined) ?? 0,
            (obj.end_y as number | undefined) ?? 0,
          );
        } else if (objType === "pillar") {
          depth = (obj.y as number | undefined) ?? 0;
        }
      } else if (viewType === "back") {
        if (["floor_slab", "beam", "staircase"].includes(objType)) {
          depth = -((obj.y as number | undefined) ?? 0);
        } else if (objType === "room") {
          depth = -((obj.y as number | undefined) ?? 0);
        } else if (objType === "wall") {
          depth = -Math.max(
            (obj.start_y as number | undefined) ?? 0,
            (obj.end_y as number | undefined) ?? 0,
          );
        } else if (objType === "pillar") {
          depth = -((obj.y as number | undefined) ?? 0);
        }
      } else if (viewType === "left") {
        if (["floor_slab", "beam", "staircase"].includes(objType)) {
          depth = (obj.x as number | undefined) ?? 0;
        } else if (objType === "room") {
          depth = (obj.x as number | undefined) ?? 0;
        } else if (objType === "wall") {
          depth = Math.min(
            (obj.start_x as number | undefined) ?? 0,
            (obj.end_x as number | undefined) ?? 0,
          );
        } else if (objType === "pillar") {
          depth = (obj.x as number | undefined) ?? 0;
        }
      } else if (viewType === "right") {
        if (["floor_slab", "beam", "staircase"].includes(objType)) {
          depth = -((obj.x as number | undefined) ?? 0);
        } else if (objType === "room") {
          depth = -((obj.x as number | undefined) ?? 0);
        } else if (objType === "wall") {
          depth = -Math.max(
            (obj.start_x as number | undefined) ?? 0,
            (obj.end_x as number | undefined) ?? 0,
          );
        } else if (objType === "pillar") {
          depth = -((obj.x as number | undefined) ?? 0);
        }
      }

      if (objType === "door" || objType === "window") continue;
      floorObjectsWithDepth.push([depth, priority, obj]);
    }

    // Sort by depth then priority (stable sort in Python since 3.7)
    floorObjectsWithDepth.sort((a, b) => {
      if (a[0] !== b[0]) return a[0] - b[0];
      return a[1] - b[1];
    });

    // Pre-group doors/windows by parent wall
    const wallOpenings: Record<string, Obj[]> = {};
    for (const obj of (floorConfig.objects ?? []) as Obj[]) {
      if (obj.type === "door" || obj.type === "window") {
        let wallKey: string;
        if ("room" in obj) {
          const roomName = obj.room as string;
          const direction = ((obj.direction as string | undefined) ?? "").toLowerCase();
          wallKey = `${roomName}_${direction}`;
        } else if ("wall_name" in obj || "wall" in obj) {
          wallKey =
            ((obj.wall_name as string | undefined) ?? (obj.wall as string | undefined)) ??
            "";
        } else {
          continue;
        }
        if (!(wallKey in wallOpenings)) wallOpenings[wallKey] = [];
        wallOpenings[wallKey].push(obj);
      }
    }

    const objectsToDraw: DrawObject[] = [];

    const slabZ = currentZ;
    const wallZ = currentZ + slabThickness;
    const wallTop = wallZ + floorHeight;

    const floorName = floorConfig.name ?? `Floor ${floorNum}`;
    floorLevels.push({
      name: floorName,
      z_bottom: wallZ,
      z_top: wallTop,
      height: floorHeight,
    });

    for (const [_d, _p, obj] of floorObjectsWithDepth) {
      void _d;
      void _p;
      const objType = obj.type as string;

      if (objType === "floor_slab") {
        const slabX = obj.x as number;
        const slabY = obj.y as number;
        const slabWidth = obj.width as number;
        const slabLength = obj.length as number;
        const slabThick = (obj.thickness as number | undefined) ?? slabThickness;

        let objX: number, objW: number, objDepth: number;
        if (viewType === "left") {
          objX = slabY; objW = slabLength; objDepth = -slabX;
        } else if (viewType === "right") {
          objX = slabY; objW = slabLength; objDepth = slabX + slabWidth;
        } else if (viewType === "front") {
          objX = slabX; objW = slabWidth; objDepth = -slabY;
        } else if (viewType === "back") {
          objX = slabX; objW = slabWidth; objDepth = slabY + slabLength;
        } else continue;

        objectsToDraw.push({
          type: "floor_slab",
          name: `Slab_${(obj.name as string | undefined) ?? ""}`,
          depth: objDepth,
          priority: typePriority.floor_slab ?? 1,
          x: objX,
          width: objW,
          height: slabThick,
          z: slabZ,
          fill: "#808080",
        });
      } else if (objType === "beam") {
        const beamX = obj.x as number;
        const beamY = obj.y as number;
        const beamWidth = (obj.width as number | undefined) ?? beamSize;
        const beamLength = (obj.length as number | undefined) ?? beamSize;
        const beamHeight = (obj.height as number | undefined) ?? beamSize;
        const beamOrient = (obj.orientation as string | undefined) ?? "horizontal";

        let objX: number, objW: number, objDepth: number;
        if (viewType === "left") {
          if (["horizontal", "ns"].includes(beamOrient)) {
            objX = beamY; objW = beamLength; objDepth = -beamX;
          } else continue;
        } else if (viewType === "right") {
          if (["horizontal", "ns"].includes(beamOrient)) {
            objX = beamY; objW = beamLength; objDepth = beamX + beamWidth;
          } else continue;
        } else if (viewType === "front") {
          if (["horizontal", "ew"].includes(beamOrient)) {
            objX = beamX; objW = beamWidth; objDepth = -beamY;
          } else continue;
        } else if (viewType === "back") {
          if (["horizontal", "ew"].includes(beamOrient)) {
            objX = beamX; objW = beamWidth; objDepth = beamY + beamLength;
          } else continue;
        } else continue;

        const beamZ =
          slabZ + Number(obj.z_offset_ft ?? 0.0) * 10.0;

        objectsToDraw.push({
          type: "beam",
          name: `Beam_${(obj.name as string | undefined) ?? ""}`,
          depth: objDepth,
          priority: typePriority.beam ?? 0,
          x: objX,
          width: objW,
          height: beamHeight,
          z: beamZ,
          fill: "#654321",
        });
      } else if (objType === "staircase") {
        let stairX: number, stairY: number, stairWidth: number, stairLength: number;
        let numSteps: number;

        if ("start_x" in obj) {
          const startX = obj.start_x as number;
          const startY = obj.start_y as number;
          const stepWidth = (obj.step_width as number | undefined) ?? 30;
          const stepTread = (obj.step_tread as number | undefined) ?? 10;
          numSteps = (obj.num_steps as number | undefined) ?? 10;
          const compassDir = (obj.direction as string | undefined) ?? "north";
          if (compassDir === "north") {
            stairX = startX; stairY = startY - numSteps * stepTread;
            stairWidth = stepWidth; stairLength = numSteps * stepTread;
          } else if (compassDir === "south") {
            stairX = startX; stairY = startY;
            stairWidth = stepWidth; stairLength = numSteps * stepTread;
          } else if (compassDir === "east") {
            stairX = startX; stairY = startY;
            stairWidth = numSteps * stepTread; stairLength = stepWidth;
          } else {
            stairX = startX - numSteps * stepTread; stairY = startY;
            stairWidth = numSteps * stepTread; stairLength = stepWidth;
          }
        } else {
          stairX = obj.x as number;
          stairY = obj.y as number;
          stairWidth = obj.width as number;
          stairLength = obj.length as number;
          const ns = obj.num_steps as number | undefined;
          numSteps = ns ?? Math.max(3, Math.floor(stairLength / 10));
        }

        const stepRise = (obj.step_rise as number | undefined) ?? 7;
        const totalRise = numSteps * stepRise;

        let objX: number, objW: number, objDepth: number;
        if (viewType === "left") {
          objX = stairY; objW = stairLength; objDepth = -stairX;
        } else if (viewType === "right") {
          objX = stairY; objW = stairLength; objDepth = stairX + stairWidth;
        } else if (viewType === "front") {
          objX = stairX; objW = stairWidth; objDepth = -stairY;
        } else if (viewType === "back") {
          objX = stairX; objW = stairWidth; objDepth = stairY + stairLength;
        } else continue;

        objectsToDraw.push({
          type: "staircase",
          name: `Stair_${(obj.name as string | undefined) ?? ""}`,
          depth: objDepth,
          priority: typePriority.staircase ?? 2, // Python's config-side dict has no 'staircase' key
          x: objX,
          width: objW,
          height: totalRise,
          z: wallZ,
          num_steps: numSteps,
          fill: "#C19A6B",
        });
      } else if (objType === "room") {
        const roomName = (obj.name as string | undefined) ?? "";
        const wallsRaw =
          (obj.walls as string[] | undefined) ??
          ["north", "south", "east", "west"];
        const wallsList = wallsRaw.map((w) => w.toLowerCase());
        const wallHeights =
          (obj.wall_heights as Record<string, unknown> | undefined) ?? {};
        const roomX = obj.x as number;
        const roomY = obj.y as number;
        const roomWidth = obj.width as number;
        const roomLength = obj.length as number;

        for (const direction of wallsList) {
          const wallKey = `${roomName}_${direction}`;
          const whEntry =
            wallHeights[direction] ??
            (obj.height as number | undefined) ??
            floorHeight;
          const wallHeight =
            typeof whEntry === "object" && whEntry !== null
              ? ((whEntry as { height?: number }).height ?? floorHeight)
              : (whEntry as number);

          if (viewType === "left" || viewType === "right") {
            if (direction === "west") {
              const depth =
                viewType === "left" ? -roomX : -(roomX + wallThickness);
              objectsToDraw.push({
                type: "wall",
                name: wallKey,
                depth,
                priority: typePriority.wall ?? 2,
                x: roomY,
                width: roomLength,
                height: wallHeight,
                z: wallZ,
                openings: wallOpenings[wallKey] ?? [],
                coord_key: "y",
                floor_height_expected: floorHeight,
              });
            } else if (direction === "east") {
              const depth =
                viewType === "right"
                  ? roomX + roomWidth
                  : -(roomX + roomWidth - wallThickness);
              objectsToDraw.push({
                type: "wall",
                name: wallKey,
                depth,
                priority: typePriority.wall ?? 2,
                x: roomY,
                width: roomLength,
                height: wallHeight,
                z: wallZ,
                openings: wallOpenings[wallKey] ?? [],
                coord_key: "y",
                floor_height_expected: floorHeight,
              });
            }
          } else if (viewType === "front" || viewType === "back") {
            if (direction === "north") {
              const depth = viewType === "front" ? -roomY : roomY;
              objectsToDraw.push({
                type: "wall",
                name: wallKey,
                depth,
                priority: typePriority.wall ?? 2,
                x: roomX,
                width: roomWidth,
                height: wallHeight,
                z: wallZ,
                openings: wallOpenings[wallKey] ?? [],
                coord_key: "x",
                floor_height_expected: floorHeight,
              });
            } else if (direction === "south") {
              const depth =
                viewType === "back"
                  ? roomY + roomLength
                  : -(roomY + roomLength);
              objectsToDraw.push({
                type: "wall",
                name: wallKey,
                depth,
                priority: typePriority.wall ?? 2,
                x: roomX,
                width: roomWidth,
                height: wallHeight,
                z: wallZ,
                openings: wallOpenings[wallKey] ?? [],
                coord_key: "x",
                floor_height_expected: floorHeight,
              });
            }
          }
        }
      } else if (objType === "wall") {
        const wallName = (obj.name as string | undefined) ?? "";
        const startX = obj.start_x as number;
        const startY = obj.start_y as number;
        const endX = obj.end_x as number;
        const endY = obj.end_y as number;
        const wallHeightVal = (obj.height as number | undefined) ?? floorHeight;
        const wallHeightEnd =
          (obj.height_end as number | undefined) ?? wallHeightVal;

        const isHorizontal = Math.abs(endY - startY) < 1;
        const isVertical = Math.abs(endX - startX) < 1;

        if ((viewType === "front" || viewType === "back") && isHorizontal) {
          const wallLength = Math.abs(endX - startX);
          const wallPos = Math.min(startX, endX);
          const depth = viewType === "front" ? -startY : startY;
          objectsToDraw.push({
            type: "wall",
            name: wallName,
            depth,
            priority: typePriority.wall ?? 2,
            x: wallPos,
            width: wallLength,
            height: wallHeightVal,
            height_end: wallHeightEnd,
            z: wallZ,
            openings: wallOpenings[wallName] ?? [],
            coord_key: "x",
            floor_height_expected: floorHeight,
          });
        } else if ((viewType === "left" || viewType === "right") && isVertical) {
          const wallLength = Math.abs(endY - startY);
          const wallPos = Math.min(startY, endY);
          const depth = viewType === "left" ? -startX : startX;
          objectsToDraw.push({
            type: "wall",
            name: wallName,
            depth,
            priority: typePriority.wall ?? 2,
            x: wallPos,
            width: wallLength,
            height: wallHeightVal,
            height_end: wallHeightEnd,
            z: wallZ,
            openings: wallOpenings[wallName] ?? [],
            coord_key: "y",
            floor_height_expected: floorHeight,
          });
        }
      } else if (objType === "pillar") {
        const defaultSize = wallThickness;
        const pillarWidth =
          (obj.width as number | undefined) ??
          (obj.size as number | undefined) ??
          defaultSize;
        const pillarLength =
          (obj.length as number | undefined) ??
          (obj.size as number | undefined) ??
          defaultSize;
        const pillarHeight =
          (obj.height as number | undefined) ?? floorHeight;
        const pillarWorldX = obj.x as number;
        const pillarWorldY = obj.y as number;

        let pillarVisibleWidth: number, pillarX: number, depth: number;
        if (viewType === "left") {
          pillarVisibleWidth = pillarLength;
          pillarX = pillarWorldY - pillarLength / 2;
          depth = -(pillarWorldX - pillarWidth / 2);
        } else if (viewType === "right") {
          pillarVisibleWidth = pillarLength;
          pillarX = pillarWorldY - pillarLength / 2;
          depth = pillarWorldX + pillarWidth / 2;
        } else if (viewType === "front") {
          pillarVisibleWidth = pillarWidth;
          pillarX = pillarWorldX - pillarWidth / 2;
          depth = -(pillarWorldY - pillarLength / 2);
        } else if (viewType === "back") {
          pillarVisibleWidth = pillarWidth;
          pillarX = pillarWorldX - pillarWidth / 2;
          depth = pillarWorldY + pillarLength / 2;
        } else continue;

        objectsToDraw.push({
          type: "pillar",
          name: `Pillar_${(obj.name as string | undefined) ?? ""}`,
          depth,
          priority: typePriority.pillar ?? 3,
          x: pillarX,
          width: pillarVisibleWidth,
          height: pillarHeight,
          z: wallZ,
          openings: [],
          coord_key: null,
        });
      }
    }

    objectsToDraw.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return (a.priority ?? 2) - (b.priority ?? 2);
    });

    // Skip debug-write side effect intentionally.

    allObjectsToDraw.push(...objectsToDraw);

    // Roof collection
    for (const obj of (floorConfig.objects ?? []) as Obj[]) {
      if (obj.type === "gable_roof") {
        // Phase 2 gable elevations — reads the derived geometry
        // (eave_x_west/east, eave_y_north/south, eave_z, ridge_y_start/end,
        // ridge_h, wall_top_above_eave) that deriveAllGableRoofs
        // populated above. Only ridge_axis='y' supported.
        const ex_w = obj.eave_x_west as number | undefined;
        const ex_e = obj.eave_x_east as number | undefined;
        const ey_n = obj.eave_y_north as number | undefined;
        const ey_s = obj.eave_y_south as number | undefined;
        const ez = obj.eave_z as number | undefined;
        const rys = obj.ridge_y_start as number | undefined;
        const rye = obj.ridge_y_end as number | undefined;
        const rh = obj.ridge_h as number | undefined;
        const wte = (obj.wall_top_above_eave as number | undefined) ?? 0;
        if (
          ex_w !== undefined && ex_e !== undefined && ez !== undefined &&
          rys !== undefined && rye !== undefined && rh !== undefined
        ) {
          const roofThickVal = GC.roof_thickness;
          const ridgeX = (ex_w + ex_e) / 2;
          const ridgeZ = ez + wte + rh;

          if (viewType === "front" || viewType === "back") {
            // Triangle silhouette from the gable end: apex at ridge,
            // base along the eave line between the two X-eaves.
            const apexSvgY = zToY(ridgeZ + roofThickVal);
            const eaveSvgY = zToY(ez);
            const apexSvgX = worldToSvgX(ridgeX, 0);
            const westSvgX = worldToSvgX(ex_w, 0);
            const eastSvgX = worldToSvgX(ex_e, 0);
            roofSvg += `<line x1="${fFloat(westSvgX)}" y1="${fFloat(eaveSvgY)}" x2="${fFloat(apexSvgX)}" y2="${fFloat(apexSvgY)}" stroke="#8B4513" stroke-width="${f(roofThickVal)}"/>\n`;
            roofSvg += `<line x1="${fFloat(apexSvgX)}" y1="${fFloat(apexSvgY)}" x2="${fFloat(eastSvgX)}" y2="${fFloat(eaveSvgY)}" stroke="#8B4513" stroke-width="${f(roofThickVal)}"/>\n`;
          } else {
            // Side view (left/right): a rectangle from ridge_y_start to
            // ridge_y_end horizontally, and from ridge_z down to eave_z
            // vertically. Plus a ridge cap line on top.
            const ridgeTopY = zToY(ridgeZ + roofThickVal);
            const ridgeBottomY = zToY(ridgeZ);
            const eaveSvgY = zToY(ez);
            const startSvgX = worldToSvgX(rys, 0);
            const endSvgX = worldToSvgX(rye, 0);
            const rectX = Math.min(startSvgX, endSvgX);
            const rectW = Math.abs(endSvgX - startSvgX);
            const rectH = eaveSvgY - ridgeBottomY;
            roofSvg += `<rect x="${fFloat(rectX)}" y="${fFloat(ridgeBottomY)}" width="${fFloat(rectW)}" height="${fFloat(rectH)}" fill="none" stroke="#8B4513" stroke-width="${f(roofThickVal)}"/>\n`;
            roofSvg += `<line x1="${fFloat(startSvgX)}" y1="${fFloat(ridgeTopY)}" x2="${fFloat(endSvgX)}" y2="${fFloat(ridgeTopY)}" stroke="#8B4513" stroke-width="${f(roofThickVal)}"/>\n`;
          }
          // Suppress the unused-var warning for ey_n / ey_s — they might
          // matter for ridge_axis='x' later; kept here for symmetry.
          void ey_n;
          void ey_s;
        }
      }
      if (obj.type === "hip_roof") {
        const ridgeAxisH = (obj.ridge_axis as string | undefined) ?? "y";
        const eaveXw = obj.eave_x_west as number;
        const eaveXe = obj.eave_x_east as number;
        const eaveYn = obj.eave_y_north as number;
        const eaveYs = obj.eave_y_south as number;
        const slopeUniform = obj.slope_angle as number | undefined;
        const slopeNs = (obj.slope_angle_ns as number | undefined) ?? slopeUniform;
        const slopeEw = (obj.slope_angle_ew as number | undefined) ?? slopeUniform;
        const roofThickVal = GC.roof_thickness;

        const eaveZAbs = obj.eave_z as number;
        const spanXH = eaveXe - eaveXw;
        const spanYH = eaveYs - eaveYn;
        const tanNsH = Math.tan(((slopeNs as number) * Math.PI) / 180);
        const tanEwH = Math.tan(((slopeEw as number) * Math.PI) / 180);

        const ridgeLenOverride = obj.ridge_length as number | undefined;
        const ridgeYsOverride = obj.ridge_y_start as number | undefined;
        const ridgeYeOverride = obj.ridge_y_end as number | undefined;
        const ridgeXsOverride = obj.ridge_x_start as number | undefined;
        const ridgeXeOverride = obj.ridge_x_end as number | undefined;

        let hH: number;
        let ridgeYS = 0, ridgeYE = 0, ridgeXPos = 0;
        let ridgeXS = 0, ridgeXE = 0, ridgeYPos = 0;

        if (ridgeAxisH === "y") {
          hH = (spanXH / 2.0) * tanEwH;
          if (ridgeYsOverride !== undefined && ridgeYeOverride !== undefined) {
            ridgeYS = ridgeYsOverride;
            ridgeYE = ridgeYeOverride;
          } else {
            let dHipH: number;
            if (ridgeLenOverride !== undefined) {
              dHipH = (spanYH - ridgeLenOverride) / 2.0;
            } else {
              dHipH = hH / tanNsH;
            }
            ridgeYS = eaveYn + dHipH;
            ridgeYE = eaveYs - dHipH;
          }
          ridgeXPos = (eaveXw + eaveXe) / 2.0;
          if (ridgeYE < ridgeYS) {
            const midY = (eaveYn + eaveYs) / 2.0;
            ridgeYS = midY;
            ridgeYE = midY;
          }
        } else {
          hH = (spanYH / 2.0) * tanNsH;
          if (ridgeXsOverride !== undefined && ridgeXeOverride !== undefined) {
            ridgeXS = ridgeXsOverride;
            ridgeXE = ridgeXeOverride;
          } else {
            let dHipH: number;
            if (ridgeLenOverride !== undefined) {
              dHipH = (spanXH - ridgeLenOverride) / 2.0;
            } else {
              dHipH = hH / tanEwH;
            }
            ridgeXS = eaveXw + dHipH;
            ridgeXE = eaveXe - dHipH;
          }
          ridgeYPos = (eaveYn + eaveYs) / 2.0;
          if (ridgeXE < ridgeXS) {
            const midX = (eaveXw + eaveXe) / 2.0;
            ridgeXS = midX;
            ridgeXE = midX;
          }
        }

        const ridgeZAbs = eaveZAbs + hH;
        const ridgeTopZ = ridgeZAbs + roofThickVal;
        const eaveTopZ = eaveZAbs + roofThickVal;
        void eaveTopZ;

        let triangleViewsH: string[];
        let triEaveLow: number, triEaveHigh: number, triApex: number;
        let trapEaveLow: number, trapEaveHigh: number;
        let trapRidgeLow: number, trapRidgeHigh: number;
        if (ridgeAxisH === "y") {
          triangleViewsH = ["front", "back"];
          triEaveLow = eaveXw; triEaveHigh = eaveXe; triApex = ridgeXPos;
          trapEaveLow = eaveYn; trapEaveHigh = eaveYs;
          trapRidgeLow = ridgeYS; trapRidgeHigh = ridgeYE;
        } else {
          triangleViewsH = ["left", "right"];
          triEaveLow = eaveYn; triEaveHigh = eaveYs; triApex = ridgeYPos;
          trapEaveLow = eaveXw; trapEaveHigh = eaveXe;
          trapRidgeLow = ridgeXS; trapRidgeHigh = ridgeXE;
        }

        if (triangleViewsH.includes(viewType)) {
          const eaveLowSvgX = worldToSvgX(triEaveLow, 0);
          const eaveHighSvgX = worldToSvgX(triEaveHigh, 0);
          const apexSvgX = worldToSvgX(triApex, 0);
          const eaveSvgY = zToY(eaveZAbs);
          const apexSvgY = zToY(ridgeTopZ);
          roofSvg += `<line x1="${fFloat(eaveLowSvgX)}" y1="${fFloat(eaveSvgY)}" x2="${fFloat(apexSvgX)}" y2="${fFloat(apexSvgY)}" stroke="#8B4513" stroke-width="${f(roofThickVal)}"/>\n`;
          roofSvg += `<line x1="${fFloat(apexSvgX)}" y1="${fFloat(apexSvgY)}" x2="${fFloat(eaveHighSvgX)}" y2="${fFloat(eaveSvgY)}" stroke="#8B4513" stroke-width="${f(roofThickVal)}"/>\n`;
        } else {
          const eaveLowSvgX = worldToSvgX(trapEaveLow, 0);
          const eaveHighSvgX = worldToSvgX(trapEaveHigh, 0);
          const ridgeLowSvgX = worldToSvgX(trapRidgeLow, 0);
          const ridgeHighSvgX = worldToSvgX(trapRidgeHigh, 0);
          const eaveSvgY = zToY(eaveZAbs);
          const ridgeSvgY = zToY(ridgeTopZ);
          roofSvg += `<line x1="${fFloat(eaveLowSvgX)}" y1="${fFloat(eaveSvgY)}" x2="${fFloat(ridgeLowSvgX)}" y2="${fFloat(ridgeSvgY)}" stroke="#8B4513" stroke-width="${f(roofThickVal)}"/>\n`;
          roofSvg += `<line x1="${fFloat(ridgeHighSvgX)}" y1="${fFloat(ridgeSvgY)}" x2="${fFloat(eaveHighSvgX)}" y2="${fFloat(eaveSvgY)}" stroke="#8B4513" stroke-width="${f(roofThickVal)}"/>\n`;
          const ventExtU = Number(obj.ridge_ext_u ?? 0.0);
          if (ventExtU > 0) {
            const extLowWorld = trapRidgeLow - ventExtU;
            const extHighWorld = trapRidgeHigh + ventExtU;
            const extLowSvgX = worldToSvgX(extLowWorld, 0);
            const extHighSvgX = worldToSvgX(extHighWorld, 0);
            roofSvg += `<line x1="${fFloat(extLowSvgX)}" y1="${fFloat(ridgeSvgY)}" x2="${fFloat(extHighSvgX)}" y2="${fFloat(ridgeSvgY)}" stroke="#8B4513" stroke-width="${f(roofThickVal)}"/>\n`;
            const tick = Math.max(4, roofThickVal * 1.5);
            roofSvg += `<line x1="${fFloat(extLowSvgX)}" y1="${fFloat(ridgeSvgY)}" x2="${fFloat(extLowSvgX)}" y2="${fFloat(ridgeSvgY + tick)}" stroke="#8B4513" stroke-width="${fFloat(roofThickVal * 0.8)}"/>\n`;
            roofSvg += `<line x1="${fFloat(extHighSvgX)}" y1="${fFloat(ridgeSvgY)}" x2="${fFloat(extHighSvgX)}" y2="${fFloat(ridgeSvgY + tick)}" stroke="#8B4513" stroke-width="${fFloat(roofThickVal * 0.8)}"/>\n`;
          } else {
            roofSvg += `<line x1="${fFloat(ridgeLowSvgX)}" y1="${fFloat(ridgeSvgY)}" x2="${fFloat(ridgeHighSvgX)}" y2="${fFloat(ridgeSvgY)}" stroke="#8B4513" stroke-width="${f(roofThickVal)}"/>\n`;
          }
        }
      }
    }

    currentZ = wallTop;
  }

  // Sort all objects globally
  allObjectsToDraw.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return (a.priority ?? 2) - (b.priority ?? 2);
  });

  // Find max wall depth
  const wallDepths = allObjectsToDraw
    .filter((o) => o.type === "wall")
    .map((o) => o.depth);
  const maxWallDepth = wallDepths.length > 0 ? Math.max(...wallDepths) : -Infinity;
  const depthTolerance = 5.0;

  for (const obj of allObjectsToDraw) {
    const objType = obj.type;
    const objXWorld = obj.x;
    const objZ = obj.z;
    const objW = obj.width;
    const objH = obj.height;

    // Track whether obj_x is a Python-float:
    // - pillar: pillar_x = world_y - pillar_length/2 → float
    // - all others (slab/beam/room-wall/stand-wall/staircase): int
    const xIsFloat = objType === "pillar";
    const objX = worldToSvgX(objXWorld, objW);
    const objBottomY = zToY(objZ);
    const objTopY = zToY(objZ + objH);
    const objSvgHeight = objBottomY - objTopY;
    const emitX = (n: number) => (xIsFloat ? fFloat(n) : f(n));

    if (objType === "floor_slab") {
      const fillColor = obj.fill ?? "#808080";
      svg += `<rect x="${emitX(objX)}" y="${fFloat(objTopY)}" width="${f(objW)}" height="${fFloat(objSvgHeight)}" fill="${fillColor}" stroke="#000" stroke-width="0.5"/>\n`;
    } else if (objType === "beam") {
      const fillColor = obj.fill ?? "#654321";
      svg += `<rect x="${emitX(objX)}" y="${fFloat(objTopY)}" width="${f(objW)}" height="${fFloat(objSvgHeight)}" fill="${fillColor}" stroke="#000" stroke-width="0.5"/>\n`;
    } else if (objType === "staircase") {
      const numSteps = obj.num_steps ?? 10;
      const fillColor = obj.fill ?? "#C19A6B";
      const treadRun = objW / numSteps;
      const riserHeight = objSvgHeight / numSteps;

      svg += '<g class="staircase-elevation">\n';
      for (let i = 0; i < numSteps; i++) {
        const stepX = objX + i * treadRun;
        const stepBottomY = objBottomY - i * riserHeight;
        const stepTopY = stepBottomY - riserHeight;
        svg += `<line x1="${fFloat(stepX)}" y1="${fFloat(stepBottomY)}" x2="${fFloat(stepX)}" y2="${fFloat(stepTopY)}" stroke="#000" stroke-width="0.5"/>\n`;
        svg += `<line x1="${fFloat(stepX)}" y1="${fFloat(stepTopY)}" x2="${fFloat(stepX + treadRun)}" y2="${fFloat(stepTopY)}" stroke="#000" stroke-width="0.5"/>\n`;
        svg += `<rect x="${fFloat(stepX)}" y="${fFloat(stepTopY)}" width="${fFloat(treadRun)}" height="${fFloat(riserHeight)}" fill="${fillColor}" opacity="0.7"/>\n`;
      }
      const lastStepX = objX + numSteps * treadRun;
      svg += `<line x1="${fFloat(lastStepX)}" y1="${fFloat(objTopY)}" x2="${fFloat(lastStepX)}" y2="${fFloat(objBottomY)}" stroke="#000" stroke-width="0.5"/>\n`;
      // Python: `<line x1="{obj_x}" ...` — obj_x is int for staircase.
      svg += `<line x1="${emitX(objX)}" y1="${fFloat(objBottomY)}" x2="${fFloat(lastStepX)}" y2="${fFloat(objBottomY)}" stroke="#000" stroke-width="0.5"/>\n`;
      svg += "</g>\n";
    } else if (objType === "pillar") {
      svg += `<rect x="${emitX(objX)}" y="${fFloat(objTopY)}" width="${f(objW)}" height="${fFloat(objSvgHeight)}" fill="#000" stroke="#000" stroke-width="0.5"/>\n`;
    } else if (objType === "wall") {
      const hasHeightEnd = obj.height_end !== undefined;
      const heightEndValue = hasHeightEnd ? obj.height_end : undefined;
      const isSloping =
        hasHeightEnd && heightEndValue !== undefined && objH !== heightEndValue;

      if (isSloping) {
        let hLeft: number, hRight: number;
        if (viewType === "front" || viewType === "right") {
          hLeft = obj.height_end as number;
          hRight = objH;
        } else {
          hLeft = objH;
          hRight = obj.height_end as number;
        }
        const blY = zToY(objZ);
        const tlY = zToY(objZ + hLeft);
        const trY = zToY(objZ + hRight);
        const brY = zToY(objZ);
        const xLeft = objX;
        const xRight = objX + objW;
        svg += `<polygon points="${emitX(xLeft)},${fFloat(blY)} ${emitX(xLeft)},${fFloat(tlY)} ${emitX(xRight)},${fFloat(trY)} ${emitX(xRight)},${fFloat(brY)}" fill="#C19A6B" stroke="#000" stroke-width="0.5"/>\n`;
      } else {
        svg += `<rect x="${emitX(objX)}" y="${fFloat(objTopY)}" width="${f(objW)}" height="${fFloat(objSvgHeight)}" fill="#C19A6B" stroke="#000" stroke-width="0.5"/>\n`;
      }

      const isFrontWall = Math.abs(obj.depth - maxWallDepth) <= depthTolerance;

      if (isFrontWall && obj.floor_height_expected !== undefined) {
        const expectedHeight = obj.floor_height_expected;
        const actualHeight = objH;
        const heightEnd = (obj.height_end as number | undefined) ?? actualHeight;
        const heightTolerance = 1.0;
        const hasCustomHeight = Math.abs(actualHeight - expectedHeight) > heightTolerance;
        const hasCustomHeightEnd = Math.abs(heightEnd - expectedHeight) > heightTolerance;
        if (hasCustomHeight || hasCustomHeightEnd) {
          wallsWithCustomHeights.push({
            name: obj.name ?? "",
            x: objXWorld,
            width: objW,
            z: objZ,
            height_start: actualHeight,
            height_end: heightEnd,
            is_sloping: isSloping,
            expected_height: expectedHeight,
          });
        }
      }

      for (const opening of obj.openings ?? []) {
        const openingType = opening.type as string;
        const openingWidth = opening.width as number;
        const openingHeight = opening.height as number;
        const coordKey = obj.coord_key as string;
        const openingXWorld = (opening[coordKey] as number | undefined) ?? 0;
        const openingX = worldToSvgX(openingXWorld, openingWidth);

        let openingZBottom: number;
        if (openingType === "window") {
          const sillHeight = (opening.sill_height as number | undefined) ?? 30;
          openingZBottom = objZ + sillHeight;
        } else {
          openingZBottom = objZ;
        }
        const openingSvgBottomY = zToY(openingZBottom);
        const openingSvgTopY = zToY(openingZBottom + openingHeight);
        const openingSvgHeight = openingSvgBottomY - openingSvgTopY;
        const fillColor = openingType === "window" ? "#87CEEB" : "#D2691E";
        svg += `<rect x="${f(openingX)}" y="${fFloat(openingSvgTopY)}" width="${f(openingWidth)}" height="${fFloat(openingSvgHeight)}" fill="${fillColor}" stroke="#000" stroke-width="0.5"/>\n`;

        if (isFrontWall) {
          elevationOpenings.push({
            type: openingType,
            x: openingXWorld,
            z_bottom: openingZBottom,
            width: openingWidth,
            height: openingHeight,
            sill_height:
              openingType === "window"
                ? ((opening.sill_height as number | undefined) ?? 0)
                : 0,
            wall_start: objXWorld,
            wall_width: objW,
            wall_name: (obj.name as string | undefined) ?? "",
          });
        }
      }
    }
  }

  svg += roofSvg;

  // Dimensions
  if (dimCfg.show_outer_dimensions) {
    const baseOffset = 30;

    // 1. Right side floor heights
    // y_bottom/y_top come from zToY(int) — Python float. Flag y1/y2 as float.
    const rightOffset = baseOffset;
    for (const level of floorLevels) {
      if (level.z_bottom === undefined || level.z_top === undefined) continue;
      if (level.height > 0) {
        const yBottom = zToY(level.z_bottom);
        const yTop = zToY(level.z_top);
        svg += svgDrawDimensionLine(
          width, yBottom, width, yTop,
          rightOffset, false, false, false,
          false, false, true, false, true,
        );
      }
    }

    // 2. Top overall width
    const topY = zToY(totalHeight);
    const topOffset = -baseOffset;
    svg += svgDrawDimensionLine(
      0, topY, width, topY,
      topOffset, true, false, false,
      false, false, true, false, true,
    );

    // 3. Opening dimensions
    if (elevationOpenings.length > 0) {
      const wallGroups: Record<string, ElevationOpening[]> = {};
      for (const opening of elevationOpenings) {
        const wk = opening.wall_name;
        if (!(wk in wallGroups)) wallGroups[wk] = [];
        wallGroups[wk].push(opening);
      }

      for (const wallKey of Object.keys(wallGroups)) {
        const wallOps = wallGroups[wallKey];
        if (wallOps.length === 0) continue;
        const sortedOpenings = [...wallOps].sort((a, b) => a.x - b.x);

        const wallStart = sortedOpenings[0].wall_start;
        const wallWidth = sortedOpenings[0].wall_width;
        void wallWidth;

        const minZBottom = Math.min(...sortedOpenings.map((o) => o.z_bottom));
        const openingY = zToY(minZBottom);
        const openingBaseOffset = baseOffset / 2;
        const offset = openingBaseOffset;

        let currentPos = wallStart;

        for (const opening of sortedOpenings) {
          const openingStart = opening.x;
          const openingEnd = opening.x + opening.width;

          if (openingStart > currentPos) {
            const startSvg = worldToSvgX(currentPos, 0);
            const endSvg = worldToSvgX(openingStart, 0);
            svg += svgDrawDimensionLine(
              Math.min(startSvg, endSvg), openingY,
              Math.max(startSvg, endSvg), openingY,
              offset, true, false, false,
              false, false, true, false, true,
            );
          }

          const openingStartSvg = worldToSvgX(openingStart, opening.width);
          svg += svgDrawDimensionLine(
            openingStartSvg, openingY,
            openingStartSvg + opening.width, openingY,
            offset, true, false, false,
            false, false, true, false, true,
          );

          currentPos = openingEnd;
        }
      }
    }

    // 4. Wall custom heights
    if (wallsWithCustomHeights.length > 0) {
      const leftOffset = -baseOffset;
      const dimensionedRanges = new Set<string>();

      for (const wall of wallsWithCustomHeights) {
        const wallXWorld = wall.x;
        const wallW = wall.width;
        const wallZv = wall.z;
        const heightStart = wall.height_start;
        const heightEnd = wall.height_end;
        const isSloping = wall.is_sloping;

        const rangeKey = `${Math.min(heightStart, heightEnd)},${Math.max(heightStart, heightEnd)}`;
        if (dimensionedRanges.has(rangeKey)) continue;
        dimensionedRanges.add(rangeKey);

        const wallXSvg = worldToSvgX(wallXWorld, wallW);
        const wallBottomY = zToY(wallZv);

        if (isSloping) {
          let hLeft: number, hRight: number;
          if (viewType === "front" || viewType === "right") {
            hLeft = heightEnd; hRight = heightStart;
          } else {
            hLeft = heightStart; hRight = heightEnd;
          }
          const wallTopLeftY = zToY(wallZv + hLeft);
          svg += svgDrawDimensionLine(
            wallXSvg, wallBottomY, wallXSvg, wallTopLeftY,
            leftOffset, false, false, false,
            false, false, true, false, true,
          );
          const wallTopRightY = zToY(wallZv + hRight);
          svg += svgDrawDimensionLine(
            wallXSvg + wallW, wallBottomY,
            wallXSvg + wallW, wallTopRightY,
            leftOffset, false, false, false,
            false, false, true, false, true,
          );
        } else {
          const wallTopY = zToY(wallZv + heightStart);
          // wallMidX = wallXSvg + wallW/2 → float in Py3.
          const wallMidX = wallXSvg + wallW / 2;
          svg += svgDrawDimensionLine(
            wallMidX, wallBottomY, wallMidX, wallTopY,
            leftOffset, false, false, false,
            false, true, true, true, true,
          );
        }
      }
    }
  }

  svg += `</g>
`;

  // Title
  const titleY = titleSpace / 2 + 10;
  svg += `<text x="${fFloat(svgWidth / 2)}" y="${fFloat(titleY)}" text-anchor="middle" font-size="18" font-weight="bold" fill="#333">${viewName}</text>\n`;
  svg += "</svg>";

  return svg;
}

// fmtCoord was scaffolded during the port but never wired up — all
// numeric formatting goes through the f() / fFloat() helpers from
// ./format instead, which precisely mirror Python's int-vs-float
// repr semantics. Removed to keep the module lean.
