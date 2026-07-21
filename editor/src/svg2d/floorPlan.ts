// TypeScript port of svg_2d.py::generate_floor_plan_svg. Byte-identical
// to the Python output for the target 8 SVGs. Every numeric formatting
// decision here mirrors Python's `f"{v}"` semantics via `f`/`fFloat`
// from ./format.
//
// Callers should pass a floor already run through expandRoomWalls so
// nested-form rooms are flattened.

import { DEFAULT_GLOBAL_CONFIG, activeDimensions, scaledTextSize, scaledSpacing } from "./config";
import { formatDimension, f, fFloat } from "./format";
import {
  svgDrawWall, svgDrawRoom, svgDrawDoor, svgDrawWindow, svgDrawFloorSlab,
  svgDrawPillar, svgDrawBeam, svgDrawStaircase, svgDrawKitchenPlatform,
} from "./shapes";
import {
  extractFloorEdges, classifyPerimeterEdges, detectWallConnections,
  assignDimensionOffsetLevels, normalizeEdgeKey,
} from "./edges";
import {
  assignOpeningOffsetLevels, svgDrawDimensionLine, svgDrawOpeningDimensions,
} from "./dimensions";
import type { RoofSpec } from "./roof/v2/model";
import { renderV2ToFloorPlan } from "./roof/v2/projections";
import { resetDimView, setDimBump } from "./dimResolve";

interface FloorConfig {
  floor_number?: number;
  name?: string;
  objects?: Array<Record<string, unknown>>;
}

// Optional v2 roof overlay — caller (floorPlansAll) computes the spec
// for the floor's v2 roof objects and passes it in. When provided, the
// roof outline (planes + ridge/hip/valley members) is drawn on the plan
// after all regular objects. The roof bounds also extend the canvas
// bounds so overhangs beyond the walls remain visible.
export interface FloorPlanRoofOverlay {
  spec: RoofSpec;
}

// Guard the "min still ∞" case with Number.POSITIVE_INFINITY, which
// stringifies the same way Python's float('inf') does not — but we
// never emit inf into SVG, so this is only for the empty-floor check.
const INF = Number.POSITIVE_INFINITY;

export function generateFloorPlanSvg(
  floorConfig: FloorConfig,
  scale = 2.0,
  roofOverlay?: FloorPlanRoofOverlay,
  // House-wide wall thickness (from config.defaults.wall_thickness); the
  // caller resolves it. Per-object overrides still win below. Defaults to
  // the code constant when the caller doesn't pass one.
  wallThickness: number = DEFAULT_GLOBAL_CONFIG.wall_thickness,
): string {
  const floorNum = floorConfig.floor_number ?? 0;
  const floorName = floorConfig.name ?? `Floor ${floorNum}`;
  const dim = activeDimensions();

  // Start a fresh per-view dimension registry (dedup keys + occupied label
  // boxes). No-op unless the Layout composite began a resolve pass.
  resetDimView();

  // -----------------------------------------------------------------
  // Bounds
  // -----------------------------------------------------------------
  let minX = INF, minY = INF;
  let maxX = -INF, maxY = -INF;

  const objects = floorConfig.objects ?? [];
  for (const obj of objects) {
    const t = obj.type as string;
    if (t === "floor_slab" || t === "beam" || t === "room") {
      const x = obj.x as number, y = obj.y as number;
      const w = obj.width as number, l = obj.length as number;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + l > maxY) maxY = y + l;
    } else if (t === "wall") {
      const sx = obj.start_x as number, sy = obj.start_y as number;
      const ex = obj.end_x as number, ey = obj.end_y as number;
      if (Math.min(sx, ex) < minX) minX = Math.min(sx, ex);
      if (Math.max(sx, ex) > maxX) maxX = Math.max(sx, ex);
      if (Math.min(sy, ey) < minY) minY = Math.min(sy, ey);
      if (Math.max(sy, ey) > maxY) maxY = Math.max(sy, ey);
    }
  }
  // Extend bounds with roof geometry so overhangs stay visible.
  if (roofOverlay) {
    for (const p of roofOverlay.spec.planes) {
      for (const [vx, vy] of p.vertices) {
        if (vx < minX) minX = vx;
        if (vy < minY) minY = vy;
        if (vx > maxX) maxX = vx;
        if (vy > maxY) maxY = vy;
      }
    }
  }
  if (minX === INF || maxX === -INF) return "";

  // Room-name abbreviation + legend (declutters dense plans). Abbreviations
  // are keyed in first-seen order; the legend below the drawing maps them back
  // to full names.
  const roomNames: string[] = [];
  for (const obj of objects) {
    if (obj.type === "room") roomNames.push((obj.name as string | undefined) ?? "Room");
  }
  const abbrevOn =
    dim.show_room_names && dim.abbreviate_room_names && roomNames.length > 0;
  const roomAbbrevs = abbrevOn ? makeRoomAbbrevs(roomNames) : null;

  // -----------------------------------------------------------------
  // Margins / viewBox
  // -----------------------------------------------------------------
  const baseMargin = 20;
  let dimMargin = 0;
  const offsetIncrement = scaledSpacing(dim.dimension_offset_increment);
  if (dim.show_outer_dimensions) {
    const maxOffset =
      scaledSpacing(dim.dimension_offset) + 3 * offsetIncrement + offsetIncrement * 1.5 + scaledSpacing(10);
    dimMargin = (maxOffset + scaledSpacing(20)) * scale;
  }
  const margin = baseMargin + dimMargin;
  const topMargin = 50 + dimMargin;

  const width = (maxX - minX) * scale + 2 * margin;

  // Legend layout — reserve a strip at the bottom for the "key = name" list.
  let legendHeight = 0;
  let legendCols = 1;
  let legendFont = 0;
  let legendRowH = 0;
  let legendColW = 0;
  if (roomAbbrevs && roomAbbrevs.size > 0) {
    legendFont = scaledTextSize(dim.room_text_size);
    legendRowH = legendFont * 1.7;
    let maxChars = 0;
    for (const [name, abbr] of roomAbbrevs) {
      maxChars = Math.max(maxChars, abbr.length + 3 + name.length);
    }
    legendColW = maxChars * legendFont * 0.6 + scaledSpacing(24);
    const avail = width - 2 * baseMargin;
    legendCols = Math.max(1, Math.min(roomAbbrevs.size, Math.floor(avail / legendColW)));
    const rows = Math.ceil(roomAbbrevs.size / legendCols);
    legendHeight = legendFont * 2.4 + rows * legendRowH + baseMargin;
  }

  const height = (maxY - minY) * scale + margin + topMargin + legendHeight;

  // Python's `f'{margin - min_x * scale}'` — with margin (float) and
  // min_x * scale (float), result is float. Reproduce via fFloat.
  const translateX = margin - minX * scale;
  const translateY = topMargin - minY * scale;

  // Python's f-string for a whole-number float like `2.0`: `f'{2.0}'` → "2.0"
  const scaleStr = fFloat(scale);

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${fFloat(width)}" height="${fFloat(height)}" viewBox="0 0 ${fFloat(width)} ${fFloat(height)}">
<title>${floorName} - Floor Plan</title>
<defs>
    <style>
        text { font-family: Arial, sans-serif; }
    </style>
</defs>
<g transform="translate(${fFloat(translateX)}, ${fFloat(translateY)}) scale(${scaleStr}, ${scaleStr})">

`;

  // -----------------------------------------------------------------
  // Draw ordering matches Python EXACTLY: floor_slabs, beams,
  // staircases, walls/rooms/pillars-collected, doors/windows, dims,
  // room labels, slab dims, pillars.
  // -----------------------------------------------------------------
  for (const obj of objects) {
    if (obj.type === "floor_slab") {
      svg += svgDrawFloorSlab(
        obj.x as number, obj.y as number,
        obj.width as number, obj.length as number,
      );
    }
  }
  for (const obj of objects) {
    if (obj.type === "beam") {
      svg += svgDrawBeam(
        obj.x as number, obj.y as number,
        obj.width as number, obj.length as number,
      );
    }
  }
  // Kitchen platforms — one polygon per polyline segment.
  for (const obj of objects) {
    if (obj.type !== "kitchen_platform") continue;
    const path = obj.path as [number, number][];
    if (!Array.isArray(path) || path.length < 2) continue;
    const depth = obj.depth as number;
    const side = ((obj.side as string) ?? "right") as "left" | "right";
    svg += svgDrawKitchenPlatform(path, depth, side);
  }
  // Python's `generate_floor_plan_svg` has a variable-shadowing quirk:
  // the local `width` used for the SVG canvas dimensions gets rebound
  // inside the staircase branch (line 946+ in svg_2d.py) to the
  // staircase's width. That rebound value is what the final
  // `<text x="{width/2}"...>` title uses. Track the shadowed width the
  // same way so the title footer stays byte-identical.
  let titleWidthVar: number = width;
  let titleWidthIsFloat = true;

  for (const obj of objects) {
    if (obj.type === "staircase") {
      let x: number, y: number, w: number, l: number;
      let arrowDir: string;
      let numSteps: number | undefined;

      if ("start_x" in obj) {
        const startX = obj.start_x as number;
        const startY = obj.start_y as number;
        const stepWidth = (obj.step_width as number | undefined) ?? 30;
        const stepTread = (obj.step_tread as number | undefined) ?? 10;
        numSteps = (obj.num_steps as number | undefined) ?? 10;
        const compass = (obj.direction as string | undefined) ?? "north";

        if (compass === "north") {
          x = startX; y = startY - numSteps * stepTread;
          w = stepWidth; l = numSteps * stepTread;
          arrowDir = "up";
        } else if (compass === "south") {
          x = startX; y = startY;
          w = stepWidth; l = numSteps * stepTread;
          arrowDir = "down";
        } else if (compass === "east") {
          x = startX; y = startY;
          w = numSteps * stepTread; l = stepWidth;
          arrowDir = "up";
        } else {
          // west
          x = startX - numSteps * stepTread; y = startY;
          w = numSteps * stepTread; l = stepWidth;
          arrowDir = "down";
        }
      } else {
        x = obj.x as number; y = obj.y as number;
        w = obj.width as number; l = obj.length as number;
        arrowDir = (obj.direction as string | undefined) ?? "up";
        numSteps = obj.num_steps as number | undefined;
      }
      svg += svgDrawStaircase(x, y, w, l, arrowDir, numSteps);
      // Reproduce Python's variable-shadowing quirk: after this line
      // Python's `width` local == staircase width, and that stale value
      // is what the final title footer uses.
      titleWidthVar = w;
      titleWidthIsFloat = false; // step_width is int in the source config
    }
  }

  const pillarsToDraw: Array<{ x: number; y: number; size?: number; width?: number; length?: number }> = [];

  for (const obj of objects) {
    const t = obj.type as string;
    if (t === "room") {
      const walls = obj.walls as string[] | Record<string, unknown> | undefined;
      const wallsList: string[] | undefined = walls
        ? Array.isArray(walls) ? walls : Object.keys(walls)
        : undefined;
      svg += svgDrawRoom(
        obj.x as number, obj.y as number,
        obj.width as number, obj.length as number,
        ((obj.wall_thickness as number | undefined) ?? wallThickness),
        wallsList ?? ["north", "south", "east", "west"],
      );
    } else if (t === "wall") {
      const thickness = (obj.thickness as number | undefined) ?? wallThickness;
      svg += svgDrawWall(
        obj.start_x as number, obj.start_y as number,
        obj.end_x as number, obj.end_y as number,
        thickness,
      );
    } else if (t === "pillar") {
      pillarsToDraw.push({
        x: obj.x as number, y: obj.y as number,
        size: obj.size as number | undefined,
        width: obj.width as number | undefined,
        length: obj.length as number | undefined,
      });
    }
  }

  for (const obj of objects) {
    const t = obj.type as string;
    if (t === "door") {
      svg += svgDrawDoor(
        obj.x as number, obj.y as number,
        obj.width as number,
        (obj.direction as string | undefined) ?? "north",
      );
    } else if (t === "window") {
      svg += svgDrawWindow(
        obj.x as number, obj.y as number,
        obj.width as number,
        (obj.direction as string | undefined) ?? "north",
      );
    }
  }

  // -----------------------------------------------------------------
  // Opening dimensions
  // -----------------------------------------------------------------
  if (dim.show_opening_dimensions) {
    interface WallBound {
      start: number;
      end: number;
      coord: number;
      direction: string;
    }
    const wallBounds: Record<string, WallBound> = {};

    for (const obj of objects) {
      if (obj.type === "room") {
        const roomName = obj.name as string;
        const x = obj.x as number, y = obj.y as number;
        const w = obj.width as number, h = obj.length as number;
        wallBounds[`${roomName}_North`] = { start: x, end: x + w, coord: y, direction: "north" };
        wallBounds[`${roomName}_South`] = { start: x, end: x + w, coord: y + h, direction: "south" };
        wallBounds[`${roomName}_East`]  = { start: y, end: y + h, coord: x + w, direction: "east" };
        wallBounds[`${roomName}_West`]  = { start: y, end: y + h, coord: x, direction: "west" };
      } else if (obj.type === "wall") {
        const wallName = (obj.name as string | undefined) ?? "Wall";
        const x1 = obj.start_x as number, y1 = obj.start_y as number;
        const x2 = obj.end_x as number, y2 = obj.end_y as number;
        if (Math.abs(y2 - y1) < 0.01) {
          const direction = y1 < (minY + maxY) / 2 ? "north" : "south";
          wallBounds[wallName] = {
            start: Math.min(x1, x2), end: Math.max(x1, x2),
            coord: y1, direction,
          };
        } else if (Math.abs(x2 - x1) < 0.01) {
          const direction = x1 < (minX + maxX) / 2 ? "west" : "east";
          wallBounds[wallName] = {
            start: Math.min(y1, y2), end: Math.max(y1, y2),
            coord: x1, direction,
          };
        }
      }
    }

    // Group + sort openings by wall
    const openingsByWall: Record<string, Array<Record<string, unknown>>> = {};
    for (const obj of objects) {
      const t = obj.type as string;
      if (t === "door" || t === "window") {
        const direction = ((obj.direction as string | undefined) ?? "north").toLowerCase();
        const room = obj.room as string | undefined;
        let wallName = obj.wall as string | undefined;
        if (room && !wallName) {
          wallName = `${room}_${direction.charAt(0).toUpperCase() + direction.slice(1)}`;
        }
        if (wallName && wallName in wallBounds) {
          if (!(wallName in openingsByWall)) openingsByWall[wallName] = [];
          openingsByWall[wallName].push(obj);
        }
      }
    }
    for (const [wallName, ops] of Object.entries(openingsByWall)) {
      const dir = wallBounds[wallName].direction;
      if (dir === "north" || dir === "south") {
        ops.sort((a, b) => (a.x as number) - (b.x as number));
      } else {
        ops.sort((a, b) => (a.y as number) - (b.y as number));
      }
    }

    // Assign offset levels
    const openingsForLevels: Record<string, Array<{ x: number; y: number; width: number; direction: string }>> = {};
    for (const [wallName, ops] of Object.entries(openingsByWall)) {
      openingsForLevels[wallName] = ops.map((o) => ({
        x: o.x as number, y: o.y as number, width: o.width as number,
        direction: ((o.direction as string | undefined) ?? "north").toLowerCase(),
      }));
    }
    const openingLevels = assignOpeningOffsetLevels(openingsForLevels);

    const openingOffset = scaledSpacing(dim.opening_dimension_offset);
    const openingTextSize = scaledTextSize(dim.opening_text_size);

    for (const [wallName, ops] of Object.entries(openingsByWall)) {
      const wallInfo = wallBounds[wallName];
      const direction = wallInfo.direction;
      let referencePoint = wallInfo.start + wallThickness;

      for (let wallIndex = 0; wallIndex < ops.length; wallIndex++) {
        const obj = ops[wallIndex];
        const offsetLevel = openingLevels[`${wallName}|${wallIndex}`] ?? 0;
        svg += svgDrawOpeningDimensions(
          obj.x as number, obj.y as number,
          obj.width as number, direction,
          wallInfo.start, wallInfo.end,
          offsetLevel, referencePoint,
        );
        referencePoint =
          direction === "north" || direction === "south"
            ? (obj.x as number) + (obj.width as number)
            : (obj.y as number) + (obj.width as number);
      }

      // Final span dimension from last opening to inside end of wall
      if (ops.length > 0) {
        const lastOpening = ops[ops.length - 1];
        const wallInsideEnd = wallInfo.end - wallThickness;

        if (direction === "north" || direction === "south") {
          const finalStart = (lastOpening.x as number) + (lastOpening.width as number);
          const finalLength = wallInsideEnd - finalStart;
          if (finalLength > 5) {
            const positionOffset = direction === "north" ? -openingOffset : openingOffset;
            const posDimY = (lastOpening.y as number) + positionOffset;
            const finalDimText = formatDimension(finalLength);

            svg += '<g class="opening-dimension">\n';
            svg += `  <line x1="${f(finalStart)}" y1="${f(posDimY)}" x2="${f(wallInsideEnd)}" y2="${f(posDimY)}" stroke="#666" stroke-width="0.3"/>\n`;
            svg += `  <line x1="${f(finalStart)}" y1="${f(lastOpening.y as number)}" x2="${f(finalStart)}" y2="${f(posDimY)}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n`;
            svg += `  <line x1="${f(wallInsideEnd)}" y1="${f(lastOpening.y as number)}" x2="${f(wallInsideEnd)}" y2="${f(posDimY)}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n`;
            const arrow = scaledSpacing(2);
            svg += `  <polygon points="${f(finalStart)},${f(posDimY)} ${f(finalStart + arrow)},${fFloat(posDimY - arrow / 2)} ${f(finalStart + arrow)},${fFloat(posDimY + arrow / 2)}" fill="#666"/>\n`;
            svg += `  <polygon points="${f(wallInsideEnd)},${f(posDimY)} ${f(wallInsideEnd - arrow)},${fFloat(posDimY - arrow / 2)} ${f(wallInsideEnd - arrow)},${fFloat(posDimY + arrow / 2)}" fill="#666"/>\n`;
            const textY = direction === "north" ? posDimY - scaledSpacing(3) : posDimY + openingTextSize + scaledSpacing(1);
            svg += `  <text x="${fFloat((finalStart + wallInsideEnd) / 2)}" y="${f(textY)}" text-anchor="middle" font-size="${openingTextSize}" fill="#666">${finalDimText}</text>\n`;
            svg += "</g>\n";
          }
        } else {
          const finalStart = (lastOpening.y as number) + (lastOpening.width as number);
          const finalLength = wallInsideEnd - finalStart;
          if (finalLength > 5) {
            const positionOffset = direction === "west" ? -openingOffset : openingOffset;
            const posDimX = (lastOpening.x as number) + positionOffset;
            const finalDimText = formatDimension(finalLength);

            svg += '<g class="opening-dimension">\n';
            svg += `  <line x1="${f(posDimX)}" y1="${f(finalStart)}" x2="${f(posDimX)}" y2="${f(wallInsideEnd)}" stroke="#666" stroke-width="0.3"/>\n`;
            svg += `  <line x1="${f(lastOpening.x as number)}" y1="${f(finalStart)}" x2="${f(posDimX)}" y2="${f(finalStart)}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n`;
            svg += `  <line x1="${f(lastOpening.x as number)}" y1="${f(wallInsideEnd)}" x2="${f(posDimX)}" y2="${f(wallInsideEnd)}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n`;
            const arrow = scaledSpacing(2);
            svg += `  <polygon points="${f(posDimX)},${f(finalStart)} ${fFloat(posDimX - arrow / 2)},${f(finalStart + arrow)} ${fFloat(posDimX + arrow / 2)},${f(finalStart + arrow)}" fill="#666"/>\n`;
            svg += `  <polygon points="${f(posDimX)},${f(wallInsideEnd)} ${fFloat(posDimX - arrow / 2)},${f(wallInsideEnd - arrow)} ${fFloat(posDimX + arrow / 2)},${f(wallInsideEnd - arrow)}" fill="#666"/>\n`;
            const textX = direction === "west" ? posDimX - openingTextSize - scaledSpacing(2) : posDimX + openingTextSize + scaledSpacing(2);
            svg += `  <text x="${f(textX)}" y="${fFloat((finalStart + wallInsideEnd) / 2)}" text-anchor="middle" font-size="${openingTextSize}" fill="#666" transform="rotate(-90 ${f(textX)} ${fFloat((finalStart + wallInsideEnd) / 2)})">${finalDimText}</text>\n`;
            svg += "</g>\n";
          }
        }
      }
    }
  }

  // -----------------------------------------------------------------
  // Perimeter + interior dimensions
  // -----------------------------------------------------------------
  let northLevels: Record<string, number> = {};
  let southLevels: Record<string, number> = {};
  let westLevels: Record<string, number> = {};
  let eastLevels: Record<string, number> = {};

  if (dim.show_outer_dimensions || dim.show_inner_dimensions) {
    const edges = extractFloorEdges(floorConfig);
    // detectWallConnections is called for side effects on debug/analysis
    // in the Python original — we call it for parity (harmless) even
    // though the return isn't used further down.
    detectWallConnections(edges);
    const bounds = { min_x: minX, max_x: maxX, min_y: minY, max_y: maxY };
    const perimeter = classifyPerimeterEdges(edges, bounds);

    if (dim.show_outer_dimensions) {
      const baseOffset = scaledSpacing(dim.dimension_offset);
      northLevels = assignDimensionOffsetLevels(perimeter.north, true);
      southLevels = assignDimensionOffsetLevels(perimeter.south, true);
      westLevels  = assignDimensionOffsetLevels(perimeter.west, false);
      eastLevels  = assignDimensionOffsetLevels(perimeter.east, false);

      for (const edge of perimeter.north) {
        const key = normalizeEdgeKey(edge.x1, edge.y1, edge.x2, edge.y2);
        const level = northLevels[key] ?? 0;
        const offset = baseOffset + level * offsetIncrement;
        svg += svgDrawDimensionLine(edge.x1, edge.y1, edge.x2, edge.y2, -offset, true, true, true);
      }
      for (const edge of perimeter.south) {
        const key = normalizeEdgeKey(edge.x1, edge.y1, edge.x2, edge.y2);
        const level = southLevels[key] ?? 0;
        const offset = baseOffset + level * offsetIncrement;
        svg += svgDrawDimensionLine(edge.x1, edge.y1, edge.x2, edge.y2, offset, true, true, true);
      }
      for (const edge of perimeter.west) {
        const key = normalizeEdgeKey(edge.x1, edge.y1, edge.x2, edge.y2);
        const level = westLevels[key] ?? 0;
        const offset = baseOffset + level * offsetIncrement;
        svg += svgDrawDimensionLine(edge.x1, edge.y1, edge.x2, edge.y2, -offset, false, true, true);
      }
      for (const edge of perimeter.east) {
        const key = normalizeEdgeKey(edge.x1, edge.y1, edge.x2, edge.y2);
        const level = eastLevels[key] ?? 0;
        const offset = baseOffset + level * offsetIncrement;
        svg += svgDrawDimensionLine(edge.x1, edge.y1, edge.x2, edge.y2, offset, false, true, true);
      }

      const maxNorth = maxValue(northLevels);
      const maxSouth = maxValue(southLevels);
      const maxWest  = maxValue(westLevels);
      const maxEast  = maxValue(eastLevels);
      const floorExtentOffsetIncrement = offsetIncrement * 1.5;

      // Floor-extent offsets include floorExtentOffsetIncrement (float
      // from `* 1.5`), so downstream dim coords must render as float.
      const oN = baseOffset + (maxNorth + 1) * offsetIncrement + floorExtentOffsetIncrement;
      svg += svgDrawDimensionLine(minX, minY, maxX, minY, -oN, true, false, false, true);
      const oS = baseOffset + (maxSouth + 1) * offsetIncrement + floorExtentOffsetIncrement;
      svg += svgDrawDimensionLine(minX, maxY, maxX, maxY, oS, true, false, false, true);
      const oW = baseOffset + (maxWest + 1) * offsetIncrement + floorExtentOffsetIncrement;
      svg += svgDrawDimensionLine(minX, minY, minX, maxY, -oW, false, false, false, true);
      const oE = baseOffset + (maxEast + 1) * offsetIncrement + floorExtentOffsetIncrement;
      svg += svgDrawDimensionLine(maxX, minY, maxX, maxY, oE, false, false, false, true);
    }

    if (dim.show_inner_dimensions) {
      const innerOffset = scaledSpacing(dim.inner_dimension_offset);
      // Inner dims are all authored at the SINGLE innerOffset, so dense plans
      // pile their labels on top of each other. Give this block a generous
      // bump budget (overlap pass only) so colliding inner labels fan out into
      // stacked levels — steering around the outer/floor-extent boxes already
      // registered above (which stay put, register-don't-bump). Dense plans
      // (the sam house) need many levels to fully separate, so allow a deep
      // stack. No-op unless the composite's overlap flag is on.
      setDimBump(16, offsetIncrement);
      const perimN_S_keys = new Set(
        perimeter.north.concat(perimeter.south).map((e) => normalizeEdgeKey(e.x1, e.y1, e.x2, e.y2)),
      );
      const perimW_E_keys = new Set(
        perimeter.west.concat(perimeter.east).map((e) => normalizeEdgeKey(e.x1, e.y1, e.x2, e.y2)),
      );
      for (const edge of Object.values(edges.horizontal)) {
        const key = normalizeEdgeKey(edge.x1, edge.y1, edge.x2, edge.y2);
        if (!perimN_S_keys.has(key)) {
          svg += svgDrawDimensionLine(edge.x1, edge.y1, edge.x2, edge.y2, innerOffset, true, true, true);
        }
      }
      for (const edge of Object.values(edges.vertical)) {
        const key = normalizeEdgeKey(edge.x1, edge.y1, edge.x2, edge.y2);
        if (!perimW_E_keys.has(key)) {
          svg += svgDrawDimensionLine(edge.x1, edge.y1, edge.x2, edge.y2, innerOffset, false, true, true);
        }
      }
      // Restore register-don't-bump for any dimensions emitted afterward
      // (slab / room chains own their own placement).
      setDimBump(0, 0);
    }
  }

  // -----------------------------------------------------------------
  // Room labels
  // -----------------------------------------------------------------
  // The room NAME (optionally abbreviated) and the room's W×L dimension line
  // are now independent: `show_room_names` gates the name, `show_room_dimensions`
  // the dimension. When both show, name sits above centre and dim below (the
  // historical layout); when only one shows, it's centred.
  const showNames = dim.show_room_names;
  const showRoomDims = dim.show_room_dimensions;
  if (showNames || showRoomDims) {
    const roomTextSize = scaledTextSize(dim.room_text_size);
    const roomSubTextSize = scaledTextSize(dim.room_text_size - 2);
    // Vertical gap between the room name and its sub-dimension line. Scales
    // with the fonts so the two lines don't collide on large houses (was a
    // hardcoded ±8; scaledTextSize(8) === 8 at factor 1, so default output
    // is unchanged when both lines show).
    const roomLabelDy = scaledTextSize(8);
    for (const obj of objects) {
      if (obj.type !== "room") continue;
      const centerX = (obj.x as number) + (obj.width as number) / 2;
      const centerY = (obj.y as number) + (obj.length as number) / 2;
      const t = (obj.wall_thickness as number | undefined) ?? wallThickness;
      const carpetWidth = (obj.width as number) - 2 * t;
      const carpetLength = (obj.length as number) - 2 * t;
      const roomName = (obj.name as string | undefined) ?? "Room";
      const nameLabel = roomAbbrevs ? (roomAbbrevs.get(roomName) ?? roomName) : roomName;
      const dimText = `${formatDimension(carpetWidth)} × ${formatDimension(carpetLength)}`;

      if (showNames && showRoomDims) {
        svg += `<text x="${fFloat(centerX)}" y="${fFloat(centerY - roomLabelDy)}" text-anchor="middle" font-size="${roomTextSize}" font-weight="bold" fill="#333">${nameLabel}</text>\n`;
        svg += `<text x="${fFloat(centerX)}" y="${fFloat(centerY + roomLabelDy)}" text-anchor="middle" font-size="${roomSubTextSize}" fill="#666">${dimText}</text>\n`;
      } else if (showNames) {
        svg += `<text x="${fFloat(centerX)}" y="${fFloat(centerY)}" text-anchor="middle" font-size="${roomTextSize}" font-weight="bold" fill="#333" dominant-baseline="middle">${nameLabel}</text>\n`;
      } else {
        svg += `<text x="${fFloat(centerX)}" y="${fFloat(centerY)}" text-anchor="middle" font-size="${roomSubTextSize}" fill="#666" dominant-baseline="middle">${dimText}</text>\n`;
      }
    }
  }

  // -----------------------------------------------------------------
  // Floor slab dimensions (when the slab differs from the overall
  // floor bounding box).
  // -----------------------------------------------------------------
  if (dim.show_outer_dimensions) {
    const overallWidth = maxX - minX;
    const overallLength = maxY - minY;
    const baseOffset = scaledSpacing(dim.dimension_offset);
    const maxNorth = maxValue(northLevels);
    const maxSouth = maxValue(southLevels);
    const maxWest  = maxValue(westLevels);
    const maxEast  = maxValue(eastLevels);
    const floorExtentOffsetIncrement = offsetIncrement * 1.5;

    const slabOffsetNorth = baseOffset + (maxNorth + 1) * offsetIncrement + floorExtentOffsetIncrement * 0.5;
    const slabOffsetSouth = baseOffset + (maxSouth + 1) * offsetIncrement + floorExtentOffsetIncrement * 0.5;
    const slabOffsetWest  = baseOffset + (maxWest + 1) * offsetIncrement + floorExtentOffsetIncrement * 0.5;
    const slabOffsetEast  = baseOffset + (maxEast + 1) * offsetIncrement + floorExtentOffsetIncrement * 0.5;

    for (const obj of objects) {
      if (obj.type === "floor_slab") {
        const slabX = obj.x as number;
        const slabY = obj.y as number;
        const slabWidth = obj.width as number;
        const slabLength = obj.length as number;
        const tolerance = 1.0;
        const widthDiffers = Math.abs(slabWidth - overallWidth) > tolerance || Math.abs(slabX - minX) > tolerance;
        const lengthDiffers = Math.abs(slabLength - overallLength) > tolerance || Math.abs(slabY - minY) > tolerance;

        if (widthDiffers || lengthDiffers) {
          svg += '<g class="floor-slab-dimension">\n';
          // Slab-dimension offsets include `* 0.5` (float in Python).
          if (widthDiffers) {
            svg += svgDrawDimensionLine(slabX, slabY, slabX + slabWidth, slabY, -slabOffsetNorth, true, false, false, true);
            svg += svgDrawDimensionLine(slabX, slabY + slabLength, slabX + slabWidth, slabY + slabLength, slabOffsetSouth, true, false, false, true);
          }
          if (lengthDiffers) {
            svg += svgDrawDimensionLine(slabX, slabY, slabX, slabY + slabLength, -slabOffsetWest, false, false, false, true);
            svg += svgDrawDimensionLine(slabX + slabWidth, slabY, slabX + slabWidth, slabY + slabLength, slabOffsetEast, false, false, false, true);
          }
          svg += "</g>\n";
        }
      }
    }
  }

  // -----------------------------------------------------------------
  // Pillars drawn last so they sit on top.
  // -----------------------------------------------------------------
  for (const p of pillarsToDraw) {
    svg += svgDrawPillar(p.x, p.y, p.size, p.width, p.length);
  }

  // -----------------------------------------------------------------
  // Title footer
  // -----------------------------------------------------------------
  // V2 roof overlay — draws the top-down projection of any roof
  // objects on this floor (slope/hip_face polygons + ridge/hip/valley
  // members). Injected after all regular objects so it renders on top.
  if (roofOverlay) {
    svg += "\n<!-- v2 roof overlay -->\n";
    svg += renderV2ToFloorPlan(
      roofOverlay.spec,
      (x, y) => [x, y],
    );
    svg += "\n";
  }

  // Python: `f'<text x="{width/2}" ...` — `width` is the shadowed local
  // variable (canvas width by default, or last staircase width if any).
  // Division always yields float in Python 3.
  const titleXStr = titleWidthIsFloat ? fFloat(titleWidthVar / 2) : fFloat(titleWidthVar / 2);
  // (Both branches use fFloat here because Py3's `/` always returns
  // float; the isFloat distinction only matters when we know the value
  // stays purely integer through addition without division — retained
  // for future edits.)
  void titleWidthIsFloat;
  svg += `</g>
<text x="${titleXStr}" y="30" text-anchor="middle" font-size="${scaledTextSize(16)}" font-weight="bold">${floorName}</text>
`;

  // Room-key legend, in the reserved strip at the bottom of the sheet.
  if (roomAbbrevs && legendHeight > 0) {
    const top = height - legendHeight;
    const startX = baseMargin;
    const headerY = top + legendFont;
    svg += `<line x1="${fFloat(startX)}" y1="${fFloat(top)}" x2="${fFloat(width - baseMargin)}" y2="${fFloat(top)}" stroke="#ccc" stroke-width="0.5"/>\n`;
    svg += `<text x="${fFloat(startX)}" y="${fFloat(headerY)}" font-size="${fFloat(legendFont)}" font-weight="bold" fill="#333">Room key</text>\n`;
    let i = 0;
    for (const [name, abbr] of roomAbbrevs) {
      const col = i % legendCols;
      const row = Math.floor(i / legendCols);
      const x = startX + col * legendColW;
      const y = headerY + legendFont * 1.5 + row * legendRowH;
      svg += `<text x="${fFloat(x)}" y="${fFloat(y)}" font-size="${fFloat(legendFont)}" fill="#333"><tspan font-weight="bold">${abbr}</tspan> = ${name}</text>\n`;
      i++;
    }
  }

  svg += `</svg>`;

  return svg;
}

// Build short mnemonic keys for room names, in first-seen order. Initials of
// hyphen/underscore/space-separated words (single-word names → first 3
// letters); digit groups kept verbatim; a numeric suffix breaks ties.
//   Garage→GAR, Balcony-Garage→BG, Bedroom_1→B1, Living-Kitchen-Dining→LKD
function makeRoomAbbrevs(names: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const used = new Set<string>();
  for (const name of names) {
    if (map.has(name)) continue;
    const parts = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
    let base: string;
    if (parts.length <= 1) {
      base = (parts[0] ?? name).slice(0, 3).toUpperCase();
    } else {
      base = parts.map((p) => (/^\d+$/.test(p) ? p : p[0]!.toUpperCase())).join("");
    }
    if (!base) base = "R";
    let abbr = base;
    for (let n = 2; used.has(abbr); n++) abbr = `${base}${n}`;
    used.add(abbr);
    map.set(name, abbr);
  }
  return map;
}

function maxValue(m: Record<string, number>): number {
  let max = 0;
  let first = true;
  for (const v of Object.values(m)) {
    if (first || v > max) { max = v; first = false; }
  }
  return first ? 0 : max;
}
