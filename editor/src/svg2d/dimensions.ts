import { DEFAULT_GLOBAL_CONFIG, scaledTextSize, scaledSpacing } from "./config";
import { formatDimension, f, fFloat } from "./format";
import { resolveDim } from "./dimResolve";

// Port of svg_2d.py::svg_draw_dimension_line. Produces the same nested
// `<g class="dimension">...</g>` block as the Python original, including
// witness lines, arrowheads, and rotated text for verticals.
//
// `offsetIsFloat` mirrors Python's numeric-type propagation: if the
// caller derived `offset` from any float-typed operation (e.g. an
// expression containing `* 1.5` or `* 0.5`), Python treats `dim_y = y1
// + offset` as a float and formats "y1=-80.0" — set the flag true.
// For pure-int callers (base offset + int-level * int-increment), leave
// it false so the output is bare "y1=-80".
export function svgDrawDimensionLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offset: number,
  isHorizontal = true,
  adjustStart = false,
  adjustEnd = false,
  offsetIsFloat = false,
  // Per-coord float flags (default: caller supplies integer-typed x/y).
  // Elevation-view callers set y1IsFloat=y2IsFloat=true because zToY(int)
  // returns a Python float (totalHeight - z with totalHeight float).
  x1IsFloat = false,
  y1IsFloat = false,
  x2IsFloat = false,
  y2IsFloat = false,
): string {
  const dim = DEFAULT_GLOBAL_CONFIG.dimensions;
  const textSize = scaledTextSize(dim.text_size);
  const minLength = dim.min_dimension_length;
  const wallThickness = DEFAULT_GLOBAL_CONFIG.wall_thickness;

  if (adjustStart) {
    if (isHorizontal) x1 += wallThickness;
    else y1 += wallThickness;
  }
  if (adjustEnd) {
    if (isHorizontal) x2 -= wallThickness;
    else y2 -= wallThickness;
  }

  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (length < minLength) return "";
  const dimText = formatDimension(length);

  // Intelligent-dimensioning seam. A strict no-op unless the Layout composite
  // has begun a resolve pass — then it may skip a dimension already drawn in
  // this view (dedup) and/or push this one's offset out so its label clears
  // the ones already placed (overlap). The label-gap constants below mirror
  // the textY/textX formulas so the estimated box matches what we emit.
  {
    const r = resolveDim({
      x1, y1, x2, y2, offset, isHorizontal,
      text: dimText, fontSize: textSize,
      gapAbove: scaledSpacing(5), gapBelow: scaledSpacing(3),
    });
    if (r.skip) return "";
    offset = r.offset;
  }

  let svg = '<g class="dimension">\n';
  // Per-coord format selectors: choose Python-int vs Python-float
  // rendering based on the flags the caller supplied.
  const fx1 = x1IsFloat ? fFloat : f;
  const fy1 = y1IsFloat ? fFloat : f;
  const fx2 = x2IsFloat ? fFloat : f;
  const fy2 = y2IsFloat ? fFloat : f;
  // In the horizontal branch, dim_y = y1 + offset. If y1 was float, dim_y is float.
  const dimYFmt = y1IsFloat || offsetIsFloat ? fFloat : f;
  // In the vertical branch, dim_x = x1 + offset. If x1 was float, dim_x is float.
  const dimXFmt = x1IsFloat || offsetIsFloat ? fFloat : f;

  if (isHorizontal) {
    const dimY = y1 + offset;
    svg += `  <line x1="${fx1(x1)}" y1="${dimYFmt(dimY)}" x2="${fx2(x2)}" y2="${dimYFmt(dimY)}" stroke="#000" stroke-width="0.5"/>\n`;
    svg += `  <line x1="${fx1(x1)}" y1="${fy1(y1)}" x2="${fx1(x1)}" y2="${dimYFmt(dimY)}" stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>\n`;
    svg += `  <line x1="${fx2(x2)}" y1="${fy2(y2)}" x2="${fx2(x2)}" y2="${dimYFmt(dimY)}" stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>\n`;

    const arrow = scaledSpacing(3);
    svg += `  <polygon points="${fx1(x1)},${dimYFmt(dimY)} ${fx1(x1 + arrow)},${dimYFmt(dimY - arrow)} ${fx1(x1 + arrow)},${dimYFmt(dimY + arrow)}" fill="#000"/>\n`;
    svg += `  <polygon points="${fx2(x2)},${dimYFmt(dimY)} ${fx2(x2 - arrow)},${dimYFmt(dimY - arrow)} ${fx2(x2 - arrow)},${dimYFmt(dimY + arrow)}" fill="#000"/>\n`;

    const textY = offset < 0 ? dimY - scaledSpacing(5) : dimY + textSize + scaledSpacing(3);
    // Text x is (x1+x2)/2 which is always float in Py3 (division).
    // Text y is dim_y ± offset — float if dim_y is float, else int.
    svg += `  <text x="${fFloat((x1 + x2) / 2)}" y="${dimYFmt(textY)}" text-anchor="middle" font-size="${textSize}" fill="#000">${dimText}</text>\n`;
  } else {
    const dimX = x1 + offset;
    svg += `  <line x1="${dimXFmt(dimX)}" y1="${fy1(y1)}" x2="${dimXFmt(dimX)}" y2="${fy2(y2)}" stroke="#000" stroke-width="0.5"/>\n`;
    svg += `  <line x1="${fx1(x1)}" y1="${fy1(y1)}" x2="${dimXFmt(dimX)}" y2="${fy1(y1)}" stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>\n`;
    svg += `  <line x1="${fx2(x2)}" y1="${fy2(y2)}" x2="${dimXFmt(dimX)}" y2="${fy2(y2)}" stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>\n`;

    const arrow = scaledSpacing(3);
    svg += `  <polygon points="${dimXFmt(dimX)},${fy1(y1)} ${dimXFmt(dimX - arrow)},${fy1(y1 + arrow)} ${dimXFmt(dimX + arrow)},${fy1(y1 + arrow)}" fill="#000"/>\n`;
    svg += `  <polygon points="${dimXFmt(dimX)},${fy2(y2)} ${dimXFmt(dimX - arrow)},${fy2(y2 - arrow)} ${dimXFmt(dimX + arrow)},${fy2(y2 - arrow)}" fill="#000"/>\n`;

    const textX = offset < 0 ? dimX - textSize - scaledSpacing(3) : dimX + textSize + scaledSpacing(3);
    svg += `  <text x="${dimXFmt(textX)}" y="${fFloat((y1 + y2) / 2)}" text-anchor="middle" font-size="${textSize}" fill="#000" transform="rotate(-90 ${dimXFmt(textX)} ${fFloat((y1 + y2) / 2)})">${dimText}</text>\n`;
  }

  svg += "</g>\n";
  return svg;
}

interface OpeningLike {
  x: number;
  y: number;
  width: number;
  direction: string;
}

// Port of svg_2d.py::assign_opening_offset_levels. Key format matches
// Python's `(wall_name, index)` tuple — we serialize as `wall_name|index`.
export function assignOpeningOffsetLevels(
  openingsByWall: Record<string, OpeningLike[]>,
): Record<string, number> {
  const openingLevels: Record<string, number> = {};
  const gapTolerance = 5.0;

  for (const [wallName, openings] of Object.entries(openingsByWall)) {
    if (openings.length === 0) continue;
    const direction = openings[0].direction.toLowerCase();
    const isHorizontal = direction === "north" || direction === "south";

    const edges = openings.map((op, idx) => {
      if (isHorizontal) {
        return { x1: op.x, y1: op.y, x2: op.x + op.width, y2: op.y, index: idx };
      }
      return { x1: op.x, y1: op.y, x2: op.x, y2: op.y + op.width, index: idx };
    });

    const sorted = [...edges].sort((a, b) => {
      if (isHorizontal) return a.x1 - b.x1 || a.x2 - b.x2;
      return a.y1 - b.y1 || a.y2 - b.y2;
    });

    const levels: Array<Array<[number, number]>> = [];
    for (const edge of sorted) {
      const edgeStart = isHorizontal
        ? Math.min(edge.x1, edge.x2)
        : Math.min(edge.y1, edge.y2);
      const edgeEnd = isHorizontal
        ? Math.max(edge.x1, edge.x2)
        : Math.max(edge.y1, edge.y2);

      let assignedLevel: number | null = null;
      for (let li = 0; li < levels.length; li++) {
        const ranges = levels[li];
        let overlaps = false;
        for (const [rStart, rEnd] of ranges) {
          if (edgeStart < rEnd + gapTolerance && edgeEnd > rStart - gapTolerance) {
            overlaps = true;
            break;
          }
        }
        if (!overlaps) {
          assignedLevel = li;
          ranges.push([edgeStart, edgeEnd]);
          break;
        }
      }
      if (assignedLevel === null) {
        assignedLevel = levels.length;
        levels.push([[edgeStart, edgeEnd]]);
      }
      openingLevels[`${wallName}|${edge.index}`] = assignedLevel;
    }
  }
  return openingLevels;
}

// Port of svg_2d.py::svg_draw_opening_dimensions. Produces two nested
// dimension groups: position from reference point (grey), and the
// opening width itself (bold black).
export function svgDrawOpeningDimensions(
  x: number,
  y: number,
  width: number,
  direction: string,
  wallStart: number,
  _wallEnd: number,
  offsetLevel = 0,
  referencePoint?: number,
): string {
  const dim = DEFAULT_GLOBAL_CONFIG.dimensions;
  const baseOffset = scaledSpacing(dim.opening_dimension_offset);
  // Python: opening_dimension_offset_increment = dimension_offset_increment * 0.5
  const offsetIncrement = scaledSpacing(dim.dimension_offset_increment) * 0.5;
  const textSize = scaledTextSize(dim.opening_text_size);
  const offset = baseOffset + offsetLevel * offsetIncrement;

  const d = direction.toLowerCase();
  let svg = '<g class="opening-dimension">\n';

  const refPoint = referencePoint ?? wallStart;

  if (d === "north" || d === "south") {
    // Position dimension
    const positionOffset = d === "north" ? -offset : offset;
    const posDimY = y + positionOffset;

    if (Math.abs(x - refPoint) > 5) {
      const posLength = Math.abs(x - refPoint);
      const posDimText = formatDimension(posLength);

      svg += `  <line x1="${f(refPoint)}" y1="${fFloat(posDimY)}" x2="${f(x)}" y2="${fFloat(posDimY)}" stroke="#666" stroke-width="0.3"/>\n`;
      svg += `  <line x1="${f(refPoint)}" y1="${f(y)}" x2="${f(refPoint)}" y2="${fFloat(posDimY)}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n`;
      svg += `  <line x1="${f(x)}" y1="${f(y)}" x2="${f(x)}" y2="${fFloat(posDimY)}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n`;

      const arrow = scaledSpacing(2);
      svg += `  <polygon points="${f(refPoint)},${fFloat(posDimY)} ${f(refPoint + arrow)},${fFloat(posDimY - arrow / 2)} ${f(refPoint + arrow)},${fFloat(posDimY + arrow / 2)}" fill="#666"/>\n`;
      svg += `  <polygon points="${f(x)},${fFloat(posDimY)} ${f(x - arrow)},${fFloat(posDimY - arrow / 2)} ${f(x - arrow)},${fFloat(posDimY + arrow / 2)}" fill="#666"/>\n`;

      const textY = d === "north" ? posDimY - scaledSpacing(3) : posDimY + textSize + scaledSpacing(1);
      svg += `  <text x="${fFloat((refPoint + x) / 2)}" y="${fFloat(textY)}" text-anchor="middle" font-size="${textSize}" fill="#666">${posDimText}</text>\n`;
    }

    // Width dimension
    const widthOffset = d === "north" ? -offset * 1.8 : offset * 1.8;
    const widthDimY = y + widthOffset;
    const widthDimText = formatDimension(width);

    svg += `  <line x1="${f(x)}" y1="${fFloat(widthDimY)}" x2="${f(x + width)}" y2="${fFloat(widthDimY)}" stroke="#000" stroke-width="0.4"/>\n`;
    svg += `  <line x1="${f(x)}" y1="${f(y)}" x2="${f(x)}" y2="${fFloat(widthDimY)}" stroke="#000" stroke-width="0.2" stroke-dasharray="1,1"/>\n`;
    svg += `  <line x1="${f(x + width)}" y1="${f(y)}" x2="${f(x + width)}" y2="${fFloat(widthDimY)}" stroke="#000" stroke-width="0.2" stroke-dasharray="1,1"/>\n`;

    const arrow = scaledSpacing(2);
    svg += `  <polygon points="${f(x)},${fFloat(widthDimY)} ${f(x + arrow)},${fFloat(widthDimY - arrow / 2)} ${f(x + arrow)},${fFloat(widthDimY + arrow / 2)}" fill="#000"/>\n`;
    svg += `  <polygon points="${f(x + width)},${fFloat(widthDimY)} ${f(x + width - arrow)},${fFloat(widthDimY - arrow / 2)} ${f(x + width - arrow)},${fFloat(widthDimY + arrow / 2)}" fill="#000"/>\n`;

    const textY = d === "north" ? widthDimY - scaledSpacing(3) : widthDimY + textSize + scaledSpacing(1);
    svg += `  <text x="${fFloat(x + width / 2)}" y="${fFloat(textY)}" text-anchor="middle" font-size="${textSize}" font-weight="bold" fill="#000">${widthDimText}</text>\n`;
  } else {
    // Vertical wall (east/west)
    const positionOffset = d === "west" ? -offset : offset;
    const posDimX = x + positionOffset;

    if (Math.abs(y - refPoint) > 5) {
      const posLength = Math.abs(y - refPoint);
      const posDimText = formatDimension(posLength);

      svg += `  <line x1="${fFloat(posDimX)}" y1="${f(refPoint)}" x2="${fFloat(posDimX)}" y2="${f(y)}" stroke="#666" stroke-width="0.3"/>\n`;
      svg += `  <line x1="${f(x)}" y1="${f(refPoint)}" x2="${fFloat(posDimX)}" y2="${f(refPoint)}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n`;
      svg += `  <line x1="${f(x)}" y1="${f(y)}" x2="${fFloat(posDimX)}" y2="${f(y)}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n`;

      const arrow = scaledSpacing(2);
      svg += `  <polygon points="${fFloat(posDimX)},${f(refPoint)} ${fFloat(posDimX - arrow / 2)},${f(refPoint + arrow)} ${fFloat(posDimX + arrow / 2)},${f(refPoint + arrow)}" fill="#666"/>\n`;
      svg += `  <polygon points="${fFloat(posDimX)},${f(y)} ${fFloat(posDimX - arrow / 2)},${f(y - arrow)} ${fFloat(posDimX + arrow / 2)},${f(y - arrow)}" fill="#666"/>\n`;

      const textX = d === "west" ? posDimX - textSize - scaledSpacing(2) : posDimX + textSize + scaledSpacing(2);
      svg += `  <text x="${fFloat(textX)}" y="${fFloat((refPoint + y) / 2)}" text-anchor="middle" font-size="${textSize}" fill="#666" transform="rotate(-90 ${fFloat(textX)} ${fFloat((refPoint + y) / 2)})">${posDimText}</text>\n`;
    }

    const widthOffset = d === "west" ? -offset * 1.8 : offset * 1.8;
    const widthDimX = x + widthOffset;
    const widthDimText = formatDimension(width);

    svg += `  <line x1="${fFloat(widthDimX)}" y1="${f(y)}" x2="${fFloat(widthDimX)}" y2="${f(y + width)}" stroke="#000" stroke-width="0.4"/>\n`;
    svg += `  <line x1="${f(x)}" y1="${f(y)}" x2="${fFloat(widthDimX)}" y2="${f(y)}" stroke="#000" stroke-width="0.2" stroke-dasharray="1,1"/>\n`;
    svg += `  <line x1="${f(x)}" y1="${f(y + width)}" x2="${fFloat(widthDimX)}" y2="${f(y + width)}" stroke="#000" stroke-width="0.2" stroke-dasharray="1,1"/>\n`;

    const arrow = scaledSpacing(2);
    svg += `  <polygon points="${fFloat(widthDimX)},${f(y)} ${fFloat(widthDimX - arrow / 2)},${f(y + arrow)} ${fFloat(widthDimX + arrow / 2)},${f(y + arrow)}" fill="#000"/>\n`;
    svg += `  <polygon points="${fFloat(widthDimX)},${f(y + width)} ${fFloat(widthDimX - arrow / 2)},${f(y + width - arrow)} ${fFloat(widthDimX + arrow / 2)},${f(y + width - arrow)}" fill="#000"/>\n`;

    const textX = d === "west" ? widthDimX - textSize - scaledSpacing(2) : widthDimX + textSize + scaledSpacing(2);
    svg += `  <text x="${fFloat(textX)}" y="${fFloat(y + width / 2)}" text-anchor="middle" font-size="${textSize}" font-weight="bold" fill="#000" transform="rotate(-90 ${fFloat(textX)} ${fFloat(y + width / 2)})">${widthDimText}</text>\n`;
  }

  svg += "</g>\n";
  return svg;
}
