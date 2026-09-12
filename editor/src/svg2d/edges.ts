// Port of svg_2d.py::normalize_edge_key. Returns a canonical tuple key
// (as a comma-joined string, since JS objects can't use tuples as keys)
// so an edge from A→B and B→A resolve to the same entry.
export function normalizeEdgeKey(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  // Round to 2 decimal places to match Python's `round(x, 2)`.
  const r = (n: number) => Math.round(n * 100) / 100;
  const [a, b, c, d] = tupleLE(x1, y1) <= tupleLE(x2, y2)
    ? [r(x1), r(y1), r(x2), r(y2)]
    : [r(x2), r(y2), r(x1), r(y1)];
  return `${a},${b},${c},${d}`;
}

// Python's tuple comparison is lexicographic — (x1,y1) <= (x2,y2) iff
// x1 < x2 OR (x1 == x2 AND y1 <= y2). Represent that with a stable key.
function tupleLE(x: number, y: number): number {
  // Encode both numbers as a single sortable string via padded exponent
  // representation? Overkill. For our range (0..500) a plain 2-tuple
  // compare via arrays works — return a Number pair the caller compares
  // in order. Simpler: expose a compare shim.
  return x * 1e6 + y; // safe as long as |y| < 1e6, which is way beyond our coords
}

export interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  source: string;
}

export interface EdgeMap {
  horizontal: Record<string, Edge>;
  vertical: Record<string, Edge>;
}

export interface PerimeterEdges {
  north: Edge[];
  south: Edge[];
  east: Edge[];
  west: Edge[];
}

interface FloorLike {
  objects?: Array<Record<string, unknown>>;
}

// Port of svg_2d.py::extract_floor_edges.
export function extractFloorEdges(floorConfig: FloorLike): EdgeMap {
  const edges: EdgeMap = { horizontal: {}, vertical: {} };
  if (!floorConfig.objects) return edges;

  for (const obj of floorConfig.objects) {
    const objType = obj.type as string | undefined;

    if (objType === "room") {
      const x = obj.x as number;
      const y = obj.y as number;
      const w = obj.width as number;
      const h = obj.length as number;
      // Python reads a room-level `wall_thickness` override here for
      // edge extraction, but the result isn't used — the shape drawers
      // pull thickness themselves. Skipped for TS parity.
      // Python's `for w_name in walls` iterates dict keys when walls is
      // a dict — mirror that here so a config that hasn't been passed
      // through expandRoomWalls yet still yields correct edges.
      const rawWalls = obj.walls as string[] | Record<string, unknown> | undefined;
      const wallsList: string[] = rawWalls
        ? Array.isArray(rawWalls)
          ? rawWalls
          : Object.keys(rawWalls)
        : ["north", "south", "east", "west"];
      const walls = wallsList.map((wName) => wName.toLowerCase());
      const name = obj.name as string;

      if (walls.includes("north")) {
        const key = normalizeEdgeKey(x, y, x + w, y);
        edges.horizontal[key] = {
          x1: x, y1: y, x2: x + w, y2: y, source: `${name}_North`,
        };
      }
      if (walls.includes("south")) {
        const key = normalizeEdgeKey(x, y + h, x + w, y + h);
        edges.horizontal[key] = {
          x1: x, y1: y + h, x2: x + w, y2: y + h, source: `${name}_South`,
        };
      }
      if (walls.includes("east")) {
        const key = normalizeEdgeKey(x + w, y, x + w, y + h);
        edges.vertical[key] = {
          x1: x + w, y1: y, x2: x + w, y2: y + h, source: `${name}_East`,
        };
      }
      if (walls.includes("west")) {
        const key = normalizeEdgeKey(x, y, x, y + h);
        edges.vertical[key] = {
          x1: x, y1: y, x2: x, y2: y + h, source: `${name}_West`,
        };
      }
    } else if (objType === "wall") {
      const x1 = obj.start_x as number;
      const y1 = obj.start_y as number;
      const x2 = obj.end_x as number;
      const y2 = obj.end_y as number;
      const source = (obj.name as string | undefined) ?? "Wall";

      if (Math.abs(y2 - y1) < 0.01) {
        const key = normalizeEdgeKey(x1, y1, x2, y2);
        edges.horizontal[key] = { x1, y1, x2, y2, source };
      } else if (Math.abs(x2 - x1) < 0.01) {
        const key = normalizeEdgeKey(x1, y1, x2, y2);
        edges.vertical[key] = { x1, y1, x2, y2, source };
      }
    }
  }

  return edges;
}

export interface Bounds {
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
}

export interface RoomRect { x: number; y: number; w: number; l: number }

// True iff (px,py) lies inside any room's outer rectangle.
function inAnyRoom(px: number, py: number, rooms: RoomRect[]): boolean {
  for (const r of rooms) {
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.l) return true;
  }
  return false;
}

// Classify each wall edge as an OUTER (perimeter) wall by EXPOSURE: a wall is on
// the perimeter on the side that faces OUT of the building — the point just past
// that face lies in no room. This handles L / T / U footprints where an outer wall
// sits at an INTERMEDIATE position (the step beside a protruding terrace or porch),
// which the old min/max-bounds test missed (it only caught walls at the extreme
// bounding box, so step walls were wrongly dimensioned as interior). A wall whose
// both sides sit in a room is an interior partition (not perimeter). The exposed
// side also gives the direction, so the dimension line is drawn outside that face.
export function classifyPerimeterEdges(
  edges: EdgeMap,
  rooms: RoomRect[],
): PerimeterEdges {
  const PROBE = 6; // units past the wall face; clears the wall (~8u) into open air
  const perimeter: PerimeterEdges = { north: [], south: [], east: [], west: [] };
  const outside = (px: number, py: number) => !inAnyRoom(px, py, rooms);

  for (const edge of Object.values(edges.horizontal)) {
    const mx = (edge.x1 + edge.x2) / 2, my = edge.y1;
    const northOpen = outside(mx, my - PROBE);
    const southOpen = outside(mx, my + PROBE);
    if (northOpen && !southOpen) perimeter.north.push(edge);
    else if (southOpen && !northOpen) perimeter.south.push(edge);
    else if (northOpen && southOpen) perimeter.north.push(edge); // freestanding wall
    // both sides in a room → interior partition, not perimeter
  }
  for (const edge of Object.values(edges.vertical)) {
    const mx = edge.x1, my = (edge.y1 + edge.y2) / 2;
    const westOpen = outside(mx - PROBE, my);
    const eastOpen = outside(mx + PROBE, my);
    if (westOpen && !eastOpen) perimeter.west.push(edge);
    else if (eastOpen && !westOpen) perimeter.east.push(edge);
    else if (westOpen && eastOpen) perimeter.west.push(edge); // freestanding wall
  }
  return perimeter;
}

// Port of svg_2d.py::assign_dimension_offset_levels. Preserves Python's
// stable sort order (Timsort — TS's Array.prototype.sort is also stable
// as of ES2019). Edge order matters for reproducibility.
export function assignDimensionOffsetLevels(
  edges: Edge[],
  isHorizontal = true,
): Record<string, number> {
  if (edges.length === 0) return {};
  const gapTolerance = 5.0;

  const sorted = [...edges].sort((a, b) => {
    if (isHorizontal) {
      return a.x1 - b.x1 || a.x2 - b.x2;
    }
    return a.y1 - b.y1 || a.y2 - b.y2;
  });

  const levels: Array<Array<[number, number]>> = [];
  const edgeLevels: Record<string, number> = {};

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
    edgeLevels[normalizeEdgeKey(edge.x1, edge.y1, edge.x2, edge.y2)] = assignedLevel;
  }

  return edgeLevels;
}

// Port of svg_2d.py::detect_wall_connections. Returns a map from edge
// key → [adjustStart, adjustEnd] booleans indicating whether each end of
// the edge coincides with another edge's endpoint (used to inset
// dimension arrows so they represent clear span rather than centerline).
export function detectWallConnections(
  edges: EdgeMap,
): Record<string, [boolean, boolean]> {
  const tolerance = 2.0;
  const connections: Record<string, [boolean, boolean]> = {};
  const allEdges = [
    ...Object.values(edges.horizontal),
    ...Object.values(edges.vertical),
  ];

  for (const edge of allEdges) {
    const { x1, y1, x2, y2 } = edge;
    const edgeKey = normalizeEdgeKey(x1, y1, x2, y2);

    let hasStart = false;
    for (const other of allEdges) {
      if (other === edge) continue;
      const { x1: ox1, y1: oy1, x2: ox2, y2: oy2 } = other;
      if (
        (Math.abs(ox2 - x1) < tolerance && Math.abs(oy2 - y1) < tolerance) ||
        (Math.abs(ox1 - x1) < tolerance && Math.abs(oy1 - y1) < tolerance)
      ) {
        hasStart = true;
        break;
      }
    }

    let hasEnd = false;
    for (const other of allEdges) {
      if (other === edge) continue;
      const { x1: ox1, y1: oy1, x2: ox2, y2: oy2 } = other;
      if (
        (Math.abs(ox2 - x2) < tolerance && Math.abs(oy2 - y2) < tolerance) ||
        (Math.abs(ox1 - x2) < tolerance && Math.abs(oy1 - y2) < tolerance)
      ) {
        hasEnd = true;
        break;
      }
    }
    connections[edgeKey] = [hasStart, hasEnd];
  }
  return connections;
}
