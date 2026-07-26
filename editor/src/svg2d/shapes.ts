import { DEFAULT_GLOBAL_CONFIG } from "./config";
import { f, fFloat } from "./format";
import { trimSpans, type PillarRect } from "./wallTrim";

// The wall polygon itself (perpendicular offset × unit vector). Byte-identical
// to the Python `svg_draw_wall` layout.
function drawWallPoly(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  thickness: number,
  color: string,
): string {
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return "";

  const px = -dy / length;
  const py = dx / length;
  const offset = thickness / 2;
  const x1 = startX + px * offset;
  const y1 = startY + py * offset;
  const x2 = startX - px * offset;
  const y2 = startY - py * offset;
  const x3 = endX - px * offset;
  const y3 = endY - py * offset;
  const x4 = endX + px * offset;
  const y4 = endY + py * offset;

  return `<polygon points="${fFloat(x1)},${fFloat(y1)} ${fFloat(x4)},${fFloat(y4)} ${fFloat(x3)},${fFloat(y3)} ${fFloat(x2)},${fFloat(y2)}" fill="${color}" stroke="#000" stroke-width="0.5"/>\n`;
}

// Port of svg_2d.py::svg_draw_wall. When `pillars` are supplied and the wall is
// axis-aligned, it's trimmed so it stops at any overlapping pillar's faces
// (walls butt into columns instead of running under them); a wall with no
// overlap draws exactly as before.
export function svgDrawWall(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  thickness: number,
  color = "#8B4513",
  pillars?: PillarRect[],
): string {
  if (pillars && pillars.length) {
    const horiz = Math.abs(startY - endY) < 1e-9;
    const vert = Math.abs(startX - endX) < 1e-9;
    if (horiz || vert) {
      const axis = horiz ? "h" : "v";
      const center = horiz ? startY : startX;
      const start = horiz ? startX : startY;
      const end = horiz ? endX : endY;
      const spans = trimSpans(axis, center, start, end, thickness, pillars);
      const untouched = spans.length === 1 && Math.abs(spans[0][0] - Math.min(start, end)) < 1e-9 && Math.abs(spans[0][1] - Math.max(start, end)) < 1e-9;
      if (!untouched) {
        let svg = "";
        for (const [s, e] of spans) {
          if (horiz) svg += drawWallPoly(s, center, e, center, thickness, color);
          else svg += drawWallPoly(center, s, center, e, thickness, color);
        }
        return svg;
      }
    }
  }
  return drawWallPoly(startX, startY, endX, endY, thickness, color);
}

// Port of svg_2d.py::svg_draw_room. Delegates to svgDrawWall for each
// side present in the `walls` list. Coordinates for east/west walls
// include `+ t` inset from top/bottom (matches Python exactly).
export function svgDrawRoom(
  x: number,
  y: number,
  width: number,
  length: number,
  thickness: number,
  walls: string[] = ["north", "south", "east", "west"],
  pillars?: PillarRect[],
): string {
  const t = thickness;
  const sides = walls.map((w) => w.toLowerCase());
  const c = "#8B4513";
  let svg = "";
  if (sides.includes("north")) {
    svg += svgDrawWall(x, y + t / 2, x + width, y + t / 2, thickness, c, pillars);
  }
  if (sides.includes("south")) {
    svg += svgDrawWall(x, y + length - t / 2, x + width, y + length - t / 2, thickness, c, pillars);
  }
  if (sides.includes("east")) {
    svg += svgDrawWall(x + width - t / 2, y + t, x + width - t / 2, y + length - t, thickness, c, pillars);
  }
  if (sides.includes("west")) {
    svg += svgDrawWall(x + t / 2, y + t, x + t / 2, y + length - t, thickness, c, pillars);
  }
  return svg;
}

// Port of svg_2d.py::svg_draw_door. Note the offsets `y-2` and `x-2`
// come from integer arithmetic in Python when x/y are ints; when x/y
// are floats they emit floats. The `f()` helper preserves that.
export function svgDrawDoor(
  x: number,
  y: number,
  width: number,
  direction: string = "north",
): string {
  const d = direction.toLowerCase();
  if (d === "north" || d === "south") {
    return `<rect x="${f(x)}" y="${f(y - 2)}" width="${f(width)}" height="4" fill="#A0522D" stroke="#000" stroke-width="0.5"/>\n`;
  }
  return `<rect x="${f(x - 2)}" y="${f(y)}" width="4" height="${f(width)}" fill="#A0522D" stroke="#000" stroke-width="0.5"/>\n`;
}

export function svgDrawWindow(
  x: number,
  y: number,
  width: number,
  direction: string = "north",
): string {
  const d = direction.toLowerCase();
  if (d === "north" || d === "south") {
    return `<rect x="${f(x)}" y="${f(y - 1)}" width="${f(width)}" height="2" fill="#87CEEB" stroke="#000" stroke-width="0.5"/>\n`;
  }
  return `<rect x="${f(x - 1)}" y="${f(y)}" width="2" height="${f(width)}" fill="#87CEEB" stroke="#000" stroke-width="0.5"/>\n`;
}

export function svgDrawFloorSlab(
  x: number,
  y: number,
  width: number,
  length: number,
): string {
  return `<rect x="${f(x)}" y="${f(y)}" width="${f(width)}" height="${f(length)}" fill="#D3D3D3" stroke="#999" stroke-width="1" opacity="0.6"/>\n`;
}

// Ground plane footprint on the Plinth-floor plan — light green, drawn first.
export function svgDrawGround(
  x: number,
  y: number,
  width: number,
  length: number,
): string {
  return `<rect x="${f(x)}" y="${f(y)}" width="${f(width)}" height="${f(length)}" fill="#c7d6b5" stroke="#8ba06f" stroke-width="1" opacity="0.5"/>\n`;
}

// Plinth footprint on the Plinth-floor plan — plinth-brown (matches the 3D box).
export function svgDrawPlinth(
  x: number,
  y: number,
  width: number,
  length: number,
): string {
  return `<rect x="${f(x)}" y="${f(y)}" width="${f(width)}" height="${f(length)}" fill="#a0826d" stroke="#7a6151" stroke-width="1" opacity="0.7"/>\n`;
}

export function svgDrawPillar(
  x: number,
  y: number,
  size?: number,
  width?: number,
  length?: number,
): string {
  const defaultSize = DEFAULT_GLOBAL_CONFIG.wall_thickness;
  const w = width ?? size ?? defaultSize;
  const l = length ?? size ?? defaultSize;
  // x,y is the TOP-LEFT CORNER (consistent with svgDrawBeam / rooms / slabs).
  const px = x;
  const py = y;
  return `<rect x="${fFloat(px)}" y="${fFloat(py)}" width="${f(w)}" height="${f(l)}" fill="#000" stroke="#000" stroke-width="0.5"/>\n`;
}

// GLB furniture footprint on the floor plan. cx,cy is the plan CENTRE; w,l are the
// footprint size ALREADY in project units (caller converts the metric asset dims).
// Rotated by `yawDeg` about the centre. Drawn UNLABELLED and lightly translucent so
// walls, dimensions and other objects stay visible through it.
export function svgDrawItem(
  cx: number,
  cy: number,
  w: number,
  l: number,
  yawDeg = 0,
): string {
  const x = cx - w / 2;
  const y = cy - l / 2;
  const rot = yawDeg ? ` transform="rotate(${fFloat(yawDeg)} ${fFloat(cx)} ${fFloat(cy)})"` : "";
  return `<rect${rot} x="${fFloat(x)}" y="${fFloat(y)}" width="${f(w)}" height="${f(l)}" rx="${f(Math.min(w, l) * 0.06)}" fill="#e8d8c0" fill-opacity="0.2" stroke="#a0826d" stroke-width="0.8"/>\n`;
}

export function svgDrawBeam(
  x: number,
  y: number,
  width: number,
  length: number,
): string {
  return `<rect x="${f(x)}" y="${f(y)}" width="${f(width)}" height="${f(length)}" fill="#8B4513" stroke="#654321" stroke-width="1" opacity="0.8"/>\n`;
}

// Kitchen platform footprint on the floor plan — one polygon per
// polyline segment, offset from the path by `depth` on the given
// side.
export function svgDrawKitchenPlatform(
  path: ReadonlyArray<readonly [number, number]>,
  depth: number,
  side: "left" | "right",
): string {
  const parts: string[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const ux = dx / len, uy = dy / len;
    const perpX = side === "left" ? -uy : uy;
    const perpY = side === "left" ? ux : -ux;
    const a2: [number, number] = [a[0] + perpX * depth, a[1] + perpY * depth];
    const b2: [number, number] = [b[0] + perpX * depth, b[1] + perpY * depth];
    const pts = `${f(a[0])},${f(a[1])} ${f(b[0])},${f(b[1])} ${f(b2[0])},${f(b2[1])} ${f(a2[0])},${f(a2[1])}`;
    parts.push(`<polygon points="${pts}" fill="#3f3f46" stroke="#18181b" stroke-width="1" fill-opacity="0.85"/>`);
  }
  return parts.join("\n") + "\n";
}

export function svgDrawStaircase(
  x: number,
  y: number,
  width: number,
  length: number,
  direction: string = "up",
  numSteps?: number,
): string {
  let svg = '<g class="staircase">\n';
  svg += `<rect x="${f(x)}" y="${f(y)}" width="${f(width)}" height="${f(length)}" fill="#E8D5B7" stroke="#000" stroke-width="1"/>\n`;

  const nSteps = numSteps ?? Math.max(3, Math.floor(length / 10));
  const stepSpacing = length / nSteps;
  for (let i = 1; i < nSteps; i++) {
    const stepY = y + i * stepSpacing;
    svg += `<line x1="${f(x)}" y1="${fFloat(stepY)}" x2="${f(x + width)}" y2="${fFloat(stepY)}" stroke="#666" stroke-width="0.5"/>\n`;
  }

  const arrowStartX = x + width / 2;
  const arrowMargin = length * 0.15;
  let arrowStartY: number, arrowEndY: number, arrowTipY: number;
  let arrowTipBaseY: number;
  const arrowTipLeftX = arrowStartX - 5;
  const arrowTipRightX = arrowStartX + 5;

  if (direction === "up") {
    arrowStartY = y + length - arrowMargin;
    arrowEndY = y + arrowMargin;
    arrowTipY = arrowEndY;
    arrowTipBaseY = arrowEndY + 8;
  } else {
    arrowStartY = y + arrowMargin;
    arrowEndY = y + length - arrowMargin;
    arrowTipY = arrowEndY;
    arrowTipBaseY = arrowEndY - 8;
  }

  svg += `<line x1="${fFloat(arrowStartX)}" y1="${fFloat(arrowStartY)}" x2="${fFloat(arrowStartX)}" y2="${fFloat(arrowEndY)}" stroke="#000" stroke-width="2"/>\n`;
  svg += `<polygon points="${fFloat(arrowStartX)},${fFloat(arrowTipY)} ${fFloat(arrowTipLeftX)},${fFloat(arrowTipBaseY)} ${fFloat(arrowTipRightX)},${fFloat(arrowTipBaseY)}" fill="#000"/>\n`;

  svg += "</g>\n";
  return svg;
}
