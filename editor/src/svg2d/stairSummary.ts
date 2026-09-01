// Staircase introspection — a resolved, human/agent-readable summary of what a
// `staircase` object actually becomes: how many flights, which way it climbs,
// and WHERE the top landing lands (so a caller can leave a way onto the floor).
//
// It reuses the real expansion (expandStaircase) for world geometry, so the
// numbers here match exactly what renders. The min-box-length hints are computed
// from the same box-fit formula expandStaircaseBox uses, so "make it this long
// for 2 flights" is accurate.

import { expandStaircase } from "./stairExpand";

type Obj = { type: string; [key: string]: unknown };
type Dir = "north" | "south" | "east" | "west";

function n(v: unknown, dflt = 0): number {
  return typeof v === "number" ? v : Number(v) || dflt;
}

export interface StairFloorContext {
  slabThickness: number;
  floorBelowHeight: number;
  floorOwnHeight: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  length: number;
}

export interface StaircaseSummary {
  name: string;
  /** true when authored as a width×length box (the DSL `size (w,l)` form). */
  boxModel: boolean;
  box: Rect | null;
  direction: Dir;
  climb: "up" | "down";
  totalSteps: number;
  numFlights: number;
  /** The topmost landing (where you step off onto the upper floor), in world
   *  coordinates, plus the direction you walk off it. Null for a single straight
   *  flight with no landing (the top of the flight is the arrival instead). */
  arrival: (Rect & { facing: Dir }) | null;
  /** Minimum box length (along the run axis) to achieve k flights. Box model only. */
  minBoxLengthFor1: number | null;
  minBoxLengthFor2: number | null;
  /** Which box axis the flights run along. */
  runAxis: "x" | "y";
  /** Set when the box is too small to fit even the tightest split. */
  error?: string;
}

function centre(r: Rect): [number, number] {
  return [r.x + r.width / 2, r.y + r.length / 2];
}

// Dominant compass direction from point a to point b (world frame: X east, Y south).
function facingFromTo(from: [number, number], to: [number, number]): Dir {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "east" : "west";
  return dy >= 0 ? "south" : "north";
}

export function summarizeStaircase(
  scIn: Obj,
  ctx: StairFloorContext,
): StaircaseSummary {
  const sc = scIn;
  const name = (sc.name as string) ?? "Stair";
  const direction = ((sc.direction as Dir) ?? "south") as Dir;
  const climb = ((sc.climb as string) ?? "down") === "up" ? "up" : "down";
  const boxModel = sc.width != null && sc.length != null;
  const runAlongY = direction === "south" || direction === "north";
  const box: Rect | null = boxModel
    ? { x: n(sc.start_x), y: n(sc.start_y), width: n(sc.width), length: n(sc.length) }
    : null;

  const tread = n(sc.step_tread);
  const riser = n(sc.step_rise);
  const up = climb === "up";
  const riseHeightRaw = sc.rise_height;
  const riseHeight =
    typeof riseHeightRaw === "number" && riseHeightRaw > 0
      ? riseHeightRaw
      : up
        ? ctx.floorOwnHeight
        : ctx.floorBelowHeight;
  const totalSteps = Math.max(1, Math.round(riseHeight / (riser || 1)));

  // Min box length (along the run) for k flights, mirroring expandStaircaseBox:
  //   reserve = 2·landing_depth (bottom approach + top landing)
  //   flightRun(k) = (ceil(totalSteps/k) − 1)·tread
  let minBoxLengthFor1: number | null = null;
  let minBoxLengthFor2: number | null = null;
  if (boxModel && tread > 0) {
    const lateralExtent = runAlongY ? n(sc.width) : n(sc.length);
    const gap = typeof sc.flight_gap === "number" && sc.flight_gap > 0 ? sc.flight_gap : 0;
    const laneWidth = (lateralExtent - gap) / 2;
    const landingDepth =
      typeof sc.landing_depth === "number" && sc.landing_depth > 0
        ? sc.landing_depth
        : Math.max(1, laneWidth);
    const minLenFor = (k: number) =>
      Math.ceil((Math.ceil(totalSteps / k) - 1) * tread + 2 * landingDepth);
    minBoxLengthFor1 = minLenFor(1);
    minBoxLengthFor2 = minLenFor(2);
  }

  // Run the real expansion for the exact flight count + world-space landings.
  let items: Obj[] = [];
  let error: string | undefined;
  try {
    items = expandStaircase(sc, ctx.slabThickness, ctx.floorBelowHeight, ctx.floorOwnHeight);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const flights = items.filter((o) => o.type === "staircase");
  const landings = items.filter((o) => o.type === "floor_slab");
  const numFlights = error ? 0 : Math.max(flights.length, 1);

  // Arrival = the topmost landing (greatest top z). Falls back to null for a
  // single straight flight (no landing emitted); callers treat the flight top as
  // the arrival there.
  let arrival: (Rect & { facing: Dir }) | null = null;
  if (landings.length > 0) {
    let top = landings[0];
    let topZ = n(top.z_offset) + n(top.thickness);
    for (const l of landings) {
      const z = n(l.z_offset) + n(l.thickness);
      if (z > topZ) {
        topZ = z;
        top = l;
      }
    }
    const rect: Rect = {
      x: n(top.x),
      y: n(top.y),
      width: n(top.width),
      length: n(top.length),
    };
    const facing = box ? facingFromTo(centre(box), centre(rect)) : direction;
    arrival = { ...rect, facing };
  }

  return {
    name,
    boxModel,
    box,
    direction,
    climb,
    totalSteps,
    numFlights,
    arrival,
    minBoxLengthFor1,
    minBoxLengthFor2,
    runAxis: runAlongY ? "y" : "x",
    ...(error ? { error } : {}),
  };
}
