// Multi-flight (switchback) staircase expansion.
//
// A `staircase` whose `max_run` is set and whose single-flight run
// (num_steps × step_tread) exceeds it is split here into a U-switchback: N
// flights that alternate lane and direction, joined by turn landings twice the
// stair width. The number of flights is COMPUTED from max_run — the thing a
// static formula-driven config can't do (its object count is fixed). Output is
// plain single-flight `staircase` objects + `floor_slab` landings, so every
// downstream renderer (2D plan, elevation, 3D) is unchanged.
//
// Convention: BOTTOM origin. `start_x`/`start_y` is the bottom step's near
// corner of flight 0 (identical to a single staircase), `direction` is that
// flight's ascent; `z_offset` is the bottom of flight 0. Landings sit flush
// with the top of the flight below them (no extra height added), so the whole
// stair climbs exactly num_steps × step_rise.

type Obj = { type: string; [key: string]: unknown };
type Dir = "north" | "south" | "east" | "west";

function n(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

// Strip the authoring-only keys (switchback controls + rise_height) so an
// emitted single-flight staircase is a clean renderer-shaped object.
function stripMulti(sc: Obj): Obj {
  const {
    max_run: _mr,
    landing_depth: _ld,
    landing_thickness: _lt,
    turn: _tn,
    flight_gap: _fg,
    rise_height: _rh,
    ...rest
  } = sc;
  return rest as Obj;
}

/**
 * Expand a staircase into its constituent primitives. TOP-anchored + DESCENDING:
 * `start_x`/`start_y`/`z_offset` describe the TOP of the stair (where it meets
 * the floor it belongs to) and the flights run DOWN to the floor below. The step
 * count is DERIVED: `num_steps = round(rise_height / step_rise)`, with
 * `rise_height` defaulting to `floorBelowHeight`. Returns `[flight]` when no
 * split is needed, else `[flight0, landing0, …]`, each carrying an explicit
 * `num_steps` for the renderers. `slabThickness` is the (owning) floor's slab
 * depth — the default TOP height, so an omitted-z stair's top is flush with the
 * walking surface.
 */
export function expandStaircase(
  sc: Obj,
  slabThickness: number,
  floorBelowHeight: number,
): Obj[] {
  const tread = n(sc.step_tread);
  const riser = n(sc.step_rise);
  const width = n(sc.step_width);
  const direction = (sc.direction as Dir) ?? "south";
  // Height to cover (top → floor below); explicit wins, else the floor below's
  // height. Step count is derived from it.
  const riseHeight =
    typeof sc.rise_height === "number" && sc.rise_height > 0
      ? sc.rise_height
      : floorBelowHeight;
  const totalSteps = Math.max(1, Math.round(riseHeight / riser));
  const totalRise = totalSteps * riser;
  const maxRun = typeof sc.max_run === "number" ? sc.max_run : 0;

  // TOP height of the stair above its floor base. Omitted → slab thickness, so
  // the top is flush with the walking surface; the stair then descends by
  // totalRise. `dz` shifts the canonical (bottom-at-0) build so the top lands
  // at topZ — the same value the split path uses.
  const topZ = sc.z_offset !== undefined ? n(sc.z_offset) : slabThickness;
  const dz = topZ - totalRise;

  // Switchback controls (needed to size the flights).
  const landingDepth =
    typeof sc.landing_depth === "number" && sc.landing_depth > 0
      ? sc.landing_depth
      : width;
  const landingThickness =
    typeof sc.landing_thickness === "number" ? sc.landing_thickness : riser;
  // Handedness (which side the return lane falls on), reckoned DESCENDING from
  // the top. Signs are chosen so the label matches the rendered spiral: since the
  // canonical build descends +Y, clockwise-going-down puts the return lane on the
  // −lateral side. (Default = clockwise.)
  const latSign = sc.turn === "anticlockwise" ? 1 : -1;
  const gap =
    typeof sc.flight_gap === "number" && sc.flight_gap > 0 ? sc.flight_gap : 0;
  const laneOffset = latSign * (width + gap);
  const landingWidth = 2 * width + gap; // landing bridges both lanes + the gap
  const landingX = Math.min(0, laneOffset);
  const [dvx, dvy] = DIR_VEC[direction];

  // `totalSteps` = RISER count; a flight of R risers has R−1 treads (you fall
  // onto the first tread from the top — no tread sits at a platform level).
  // ALLOCATION: from the start (top) the stair descends INTO `direction` and the
  // WHOLE assembly must fit the allocated box [start, start+max_run]. A flight's
  // tread run plus one turn landing must fit: (R−1)·tread + landing_depth ≤
  // max_run. If that's too tight, add more flights (shorter runs, more turns).
  const singleRun = (totalSteps - 1) * tread;
  let numFlights: number;
  if (maxRun <= 0 || singleRun <= maxRun) {
    numFlights = 1;
  } else {
    const budget = Math.max(tread, maxRun - landingDepth); // room for one flight
    const capRisers = Math.floor(budget / tread) + 1;
    numFlights = Math.min(40, Math.max(2, Math.ceil(totalSteps / capRisers)));
  }

  // --- Single flight: descends from the top (start) INTO `direction`, within
  // [start, start+run]. It renders as a `opposite(direction)` flight whose
  // TOP (high-z end) is at the start — so it falls as you move +direction.
  if (numFlights <= 1) {
    const treads = Math.max(1, totalSteps - 1);
    const run = treads * tread;
    const o = stripMulti(sc);
    o.direction = OPP[direction];
    o.start_x = n(sc.start_x) + run * dvx; // bottom-near corner at the FAR (+dir) end
    o.start_y = n(sc.start_y) + run * dvy;
    o.num_steps = treads;
    o.z_offset = dz;
    return [o];
  }

  // Balanced risers across flights (remainder falls to the bottom flight).
  const perFlight = Math.ceil(totalSteps / numFlights);
  const risersFromTop = (t: number) =>
    Math.max(0, Math.min(perFlight, totalSteps - t * perFlight));
  const flightRun = Math.max(1, perFlight - 1) * tread; // full flight tread run

  // --- Build CANONICAL: box extends +Y from the top connection at (0,0); the
  // stair descends into +Y within [0, flightRun + landing_depth]. Even (from the
  // top) flights connect at the NEAR end and descend +Y; odd flights connect at
  // the FAR end and descend −Y (adjacent lane). Turn landings sit at the end
  // each flight bottoms out on. Then rotate +Y → `direction` + translate the top
  // connection (0,0) → (start_x, start_y), and lift z so the top sits at topZ.
  type Item = { o: Obj; isStair: boolean };
  const items: Item[] = [];
  let zTop = 0; // canonical z of the current flight's TOP platform (floor = 0)
  for (let t = 0; t < numFlights; t++) {
    const risers = risersFromTop(t);
    if (risers <= 0) break;
    const treads = Math.max(1, risers - 1);
    const even = t % 2 === 0;
    const lane = even ? 0 : laneOffset;
    const zBottom = zTop - risers * riser;
    const run = treads * tread;
    items.push({
      isStair: true,
      o: even
        ? {
            // top at NEAR end (y=0), descends +Y → renders as "north"
            type: "staircase",
            direction: "north",
            start_x: lane,
            start_y: run,
            num_steps: treads,
            step_rise: riser,
            step_tread: tread,
            step_width: width,
            z_offset: zBottom,
          }
        : {
            // top at FAR end (y=flightRun), descends −Y → renders as "south"
            type: "staircase",
            direction: "south",
            start_x: lane,
            start_y: flightRun - run,
            num_steps: treads,
            step_rise: riser,
            step_tread: tread,
            step_width: width,
            z_offset: zBottom,
          },
    });
    if (t < numFlights - 1) {
      // Turn landing at the platform this flight bottomed out on: even flights
      // bottom at the FAR end, odd at the NEAR end. Both stay within [0,+Y].
      items.push({
        isStair: false,
        o: {
          type: "floor_slab",
          x: landingX,
          y: even ? flightRun : 0,
          width: landingWidth,
          length: landingDepth,
          thickness: landingThickness,
          z_offset: zBottom - landingThickness, // top flush with the platform
        },
      });
    }
    zTop = zBottom;
  }

  // Rotate +Y → `direction`; the top connection is canonical (0,0) → translate
  // to (start_x, start_y). Lift every z by topZ so the top platform is at topZ.
  const rotated = items.map((it) => ({ ...it, o: rotateObject(it.o, direction) }));
  const dx = n(sc.start_x);
  const dy = n(sc.start_y);

  const baseName = (sc.name as string) ?? "Stair";
  let fi = 0;
  let li = 0;
  return rotated.map(({ o, isStair }) => {
    if (typeof o.x === "number") o.x += dx;
    if (typeof o.y === "number") o.y += dy;
    if (typeof o.start_x === "number") o.start_x += dx;
    if (typeof o.start_y === "number") o.start_y += dy;
    o.z_offset = n(o.z_offset) + topZ;
    if (sc.layer !== undefined) o.layer = sc.layer;
    if (isStair && sc.material !== undefined) o.material = sc.material;
    o.name = isStair ? `${baseName}_F${++fi}` : `${baseName}_L${++li}`;
    return o;
  });
}

// --- Rotation about the origin, canonical = "south" (ascend +Y). z untouched.
type Rot = { m: (x: number, y: number) => [number, number]; dir: (d: Dir) => Dir };
const ROT: Record<Dir, Rot> = {
  south: { m: (x, y) => [x, y], dir: (d) => d },
  north: { m: (x, y) => [-x, -y], dir: flip180 },
  east: { m: (x, y) => [y, -x], dir: rotCW }, // +Y → +X
  west: { m: (x, y) => [-y, x], dir: rotCCW }, // +Y → -X
};
function flip180(d: Dir): Dir {
  return d === "south" ? "north" : d === "north" ? "south" : d === "east" ? "west" : "east";
}
function rotCW(d: Dir): Dir {
  return d === "south" ? "east" : d === "north" ? "west" : d === "east" ? "north" : "south";
}
function rotCCW(d: Dir): Dir {
  return d === "south" ? "west" : d === "north" ? "east" : d === "east" ? "south" : "north";
}

function rotateObject(o: Obj, direction: Dir): Obj {
  if (direction === "south") return o; // identity
  const R = ROT[direction];

  if (o.type === "floor_slab") {
    const x = n(o.x);
    const y = n(o.y);
    const w = n(o.width);
    const l = n(o.length);
    const [ax, ay] = R.m(x, y);
    const [bx, by] = R.m(x + w, y + l);
    return {
      ...o,
      x: Math.min(ax, bx),
      y: Math.min(ay, by),
      width: Math.abs(bx - ax),
      length: Math.abs(by - ay),
    };
  }

  // staircase: rotate its canonical AABB, then read the new near corner.
  const sx = n(o.start_x);
  const sy = n(o.start_y);
  const run = n(o.num_steps) * n(o.step_tread);
  const sw = n(o.step_width);
  const cdir = o.direction as Dir;
  const x0 = sx;
  const x1 = sx + sw;
  const y0 = cdir === "south" ? sy : sy - run;
  const y1 = cdir === "south" ? sy + run : sy;
  const [ax, ay] = R.m(x0, y0);
  const [bx, by] = R.m(x1, y1);
  const minX = Math.min(ax, bx);
  const maxX = Math.max(ax, bx);
  const minY = Math.min(ay, by);
  const maxY = Math.max(ay, by);
  const ndir = R.dir(cdir);
  const [nx, ny] = nearCorner(ndir, minX, minY, maxX, maxY);
  return { ...o, start_x: nx, start_y: ny, direction: ndir };
}

// The TOP near corner of a flight = its bottom near corner (start_x/start_y)
// advanced by the full run along the ascent direction. Same lateral edge, top end.
const OPP: Record<Dir, Dir> = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
};
const DIR_VEC: Record<Dir, [number, number]> = {
  south: [0, 1],
  north: [0, -1],
  east: [1, 0],
  west: [-1, 0],
};
function nearCorner(
  dir: Dir,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): [number, number] {
  switch (dir) {
    case "south":
      return [minX, minY];
    case "north":
      return [minX, maxY];
    case "east":
      return [minX, minY];
    case "west":
      return [maxX, minY];
  }
}
