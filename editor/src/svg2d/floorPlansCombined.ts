import { generateFloorPlanSvg } from "./floorPlan";
import { buildGridOverlay } from "./floorPlansAll";
import { scaledTextSize } from "./config";
import { f, fFloat } from "./format";
import { expandRoomWalls, type HouseConfig } from "./expand";

// Port of svg_2d.py::generate_combined_floor_plans. Renders each floor
// via generateFloorPlanSvg, extracts the inner content group (via the
// same regex + tag-depth parsing the Python side uses), and composites
// them into a single wide SVG with labels underneath.
export function generateCombinedFloorPlans(
  houseConfig: HouseConfig,
): string {
  const hc = expandRoomWalls(houseConfig, undefined, { lenient: true });
  const floors = hc.floors ?? [];
  const gridOverlay = buildGridOverlay(houseConfig);

  const scale = 2.0;
  const spacing = 100;
  const leftRightMargin = 80;
  const topMargin = 60;
  const bottomMargin = 120;
  const titleSpace = 40;
  const labelOffset = 30;

  interface FloorEntry {
    name: string;
    number: number;
    content: string;
    canvasWidth: number;
    canvasHeight: number;
    translateX: number;
    contentWidth: number;
  }
  const floorData: FloorEntry[] = [];

  for (const floor of floors) {
    const floorNum = (floor.floor_number as number | undefined) ?? 0;
    const floorName = (floor.name as string | undefined) ?? `Floor ${floorNum}`;
    const svgContent = generateFloorPlanSvg(floor, scale, undefined, undefined, gridOverlay);
    if (!svgContent) continue;

    // Extract the outer content-group transform.
    const transformPattern = /<g transform="translate\(([0-9.]+),\s*([0-9.]+)\)\s*scale\([^)]+\)">/;
    const transformMatch = transformPattern.exec(svgContent);
    if (!transformMatch) continue;

    const translateX = Number(transformMatch[1]);
    const translateY = Number(transformMatch[2]);
    const startPos = transformMatch.index + transformMatch[0].length;

    // Find matching closing </g> by counting nested tags.
    let depth = 1;
    let pos = startPos;
    let contentOnly = "";
    while (depth > 0 && pos < svgContent.length) {
      const nextOpen = svgContent.indexOf("<g ", pos);
      const nextClose = svgContent.indexOf("</g>", pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        pos = nextOpen + 3;
      } else {
        depth -= 1;
        if (depth === 0) {
          contentOnly = svgContent.slice(startPos, nextClose);
          break;
        }
        pos = nextClose + 4;
      }
    }
    if (depth !== 0) continue;

    const drawingContent = `<g transform="translate(${fFloat(translateX)}, ${fFloat(translateY)}) scale(2.0, 2.0)">\n${contentOnly}\n</g>`;

    const svgMatch = /<svg[^>]+width="([0-9.]+)"[^>]+height="([0-9.]+)"/.exec(svgContent);
    const svgWidth = svgMatch ? Number(svgMatch[1]) : 1000;
    const svgHeight = svgMatch ? Number(svgMatch[2]) : 1000;
    const scaleMatch = /scale\(([0-9.]+)/.exec(drawingContent);
    const contentScale = scaleMatch ? Number(scaleMatch[1]) : scale;

    // Compute content bounds for label centering.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let contentWidth = svgWidth;
    let tx = translateX;
    const objects = (floor.objects as Array<Record<string, unknown>> | undefined) ?? [];
    if (objects.length > 0) {
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
      if (Number.isFinite(minX) && Number.isFinite(maxX)) {
        contentWidth = (maxX - minX) * contentScale;
      }
    } else {
      tx = 0;
    }

    floorData.push({
      name: floorName,
      number: floorNum,
      content: drawingContent,
      canvasWidth: svgWidth,
      canvasHeight: svgHeight,
      translateX: tx,
      contentWidth,
    });
  }

  if (floorData.length === 0) return "";

  const maxHeight = Math.max(...floorData.map((f) => f.canvasHeight));
  const totalWidth =
    floorData.reduce((s, f) => s + f.canvasWidth, 0) + spacing * (floorData.length - 1);
  const canvasWidth = totalWidth + 2 * leftRightMargin;
  const canvasHeight = titleSpace + topMargin + maxHeight + labelOffset + bottomMargin;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${fFloat(canvasWidth)}" height="${fFloat(canvasHeight)}" viewBox="0 0 ${fFloat(canvasWidth)} ${fFloat(canvasHeight)}">
<title>All Floor Plans</title>
<defs>
    <style>
        text { font-family: Arial, sans-serif; }
        .floor-label { font-size: ${scaledTextSize(16)}px; font-weight: bold; fill: #333; }
    </style>
</defs>
`;

  const titleY = titleSpace - 10;
  svg += `<text x="${fFloat(canvasWidth / 2)}" y="${titleY}" text-anchor="middle" font-size="${scaledTextSize(20)}" font-weight="bold" fill="#333">All Floor Plans</text>\n`;

  // In Python, max_height is float (canvas_height is derived from a
  // multiplication with scale=2.0 through the per-floor generator) so
  // label_y is float too.
  const labelY = titleSpace + topMargin + maxHeight + labelOffset;
  let currentX = leftRightMargin;
  // Track whether currentX has been contaminated by adding a float.
  // On iteration 1 Python's `current_x = left_right_margin = 80` (int).
  // From iteration 2 onward `current_x = int + float_canvas_width +
  // int_spacing = float`. Python emits int values as "80" and float
  // values as "1360.0" — reproduce with an isFloat flag.
  let currentXIsFloat = false;
  const contentStartY = titleSpace + topMargin;
  for (const floor of floorData) {
    svg += `<g id="floor_${floor.number}">\n`;
    const cxStr = currentXIsFloat ? fFloat(currentX) : f(currentX);
    svg += `<g transform="translate(${cxStr}, ${f(contentStartY)})">\n`;
    svg += floor.content;
    svg += "</g>\n";
    const labelX = currentX + floor.translateX + floor.contentWidth / 2;
    // labelX and labelY both float in Python.
    svg += `<text x="${fFloat(labelX)}" y="${fFloat(labelY)}" text-anchor="middle" class="floor-label">${floor.name}</text>\n`;
    svg += "</g>\n";
    currentX += floor.canvasWidth + spacing;
    // canvasWidth was parsed from a "1180.0"-style string — it's float
    // in Python, so currentX is now float too.
    currentXIsFloat = true;
  }
  svg += "</svg>";
  return svg;
}
