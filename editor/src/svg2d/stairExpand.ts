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
    climb: _cl,
    ...rest
  } = sc;
  return rest as Obj;
}

/**
 * Expand a staircase into its constituent primitives. `climb` picks the anchor +
 * z direction (see the schema): "up" is BOTTOM-anchored (start is the bottom step,
 * flights ASCEND into `direction`, rise_height defaults to `floorOwnHeight`);
 * "down" (default) is TOP-anchored (start is the top connection, flights DESCEND,
 * rise_height defaults to `floorBelowHeight`). The step count is DERIVED:
 * `num_steps = round(rise_height / step_rise)`. Returns `[flight]` when no split
 * is needed, else `[flight0, landing0, …]`, each carrying an explicit `num_steps`
 * for the renderers (which are always bottom-origin/ascending). `slabThickness` is
 * the owning floor's slab depth — the default anchor height, so an omitted-z
 * stair's anchored end is flush with the walking surface.
 */
export function expandStaircase(
  sc: Obj,
  slabThickness: number,
  floorBelowHeight: number,
  floorOwnHeight: number,
): Obj[] {
  // BOX MODEL: when the author gives a `width`×`length` box, the WHOLE staircase
  // (flights + turn landings) is packed to fit INSIDE the rectangle
  // [start, start+(width,length)] — (start_x,start_y) is the box corner, not the
  // first step, and the per-step width is DERIVED from the box. See below.
  if (sc.width != null && sc.length != null) {
    return expandStaircaseBox(sc, slabThickness, floorBelowHeight, floorOwnHeight);
  }
  const up = ((sc.climb as string | undefined) ?? "down") === "up";
  const tread = n(sc.step_tread);
  const riser = n(sc.step_rise);
  const width = n(sc.step_width);
  const direction = (sc.direction as Dir) ?? "south";
  // Height to cover; explicit wins. Default: up → this floor's height (climb to
  // the next level); down → the floor below's height (drop to it).
  const defaultRise = up ? floorOwnHeight : floorBelowHeight;
  const riseHeight =
    typeof sc.rise_height === "number" && sc.rise_height > 0 ? sc.rise_height : defaultRise;
  const totalSteps = Math.max(1, Math.round(riseHeight / riser));
  const totalRise = totalSteps * riser;
  const maxRun = typeof sc.max_run === "number" ? sc.max_run : 0;

  // The ANCHORED end's height above the floor base (omitted → slab thickness, so
  // it's flush with the walking surface). For "up" this is the BOTTOM; for "down"
  // the TOP. `bottomZ` is the canonical build's lift so the whole stair lands
  // right in either case.
  const anchorZ = sc.z_offset !== undefined ? n(sc.z_offset) : slabThickness;
  const bottomZ = up ? anchorZ : anchorZ - totalRise;

  // Switchback controls (needed to size the flights).
  const landingDepth =
    typeof sc.landing_depth === "number" && sc.landing_depth > 0
      ? sc.landing_depth
      : width;
  const landingThickness =
    typeof sc.landing_thickness === "number" ? sc.landing_thickness : riser;
  const latSign = sc.turn === "anticlockwise" ? 1 : -1;
  const gap =
    typeof sc.flight_gap === "number" && sc.flight_gap > 0 ? sc.flight_gap : 0;
  const laneOffset = latSign * (width + gap);
  const landingWidth = 2 * width + gap; // landing bridges both lanes + the gap
  const landingX = Math.min(0, laneOffset);
  const [dvx, dvy] = DIR_VEC[direction];

  // `totalSteps` = RISER count; a flight of R risers has R−1 treads. The whole
  // assembly must fit the allocated box [start, start+max_run] along `direction`:
  // (R−1)·tread + landing_depth ≤ max_run; too tight ⇒ add flights.
  const singleRun = (totalSteps - 1) * tread;
  let numFlights: number;
  if (maxRun <= 0 || singleRun <= maxRun) {
    numFlights = 1;
  } else {
    const budget = Math.max(tread, maxRun - landingDepth); // room for one flight
    const capRisers = Math.floor(budget / tread) + 1;
    numFlights = Math.min(40, Math.max(2, Math.ceil(totalSteps / capRisers)));
  }

  // --- Single flight.
  if (numFlights <= 1) {
    const treads = Math.max(1, totalSteps - 1);
    const run = treads * tread;
    const o = stripMulti(sc);
    o.num_steps = treads;
    if (up) {
      // Bottom-origin already: ascend from the start INTO `direction`.
      o.direction = direction;
      o.start_x = n(sc.start_x);
      o.start_y = n(sc.start_y);
      o.z_offset = bottomZ; // = anchorZ (the bottom)
    } else {
      // Descend from the top (start): render as opposite(direction) with the
      // bottom-near corner at the FAR (+dir) end, dropped to top − totalRise.
      o.direction = OPP[direction];
      o.start_x = n(sc.start_x) + run * dvx;
      o.start_y = n(sc.start_y) + run * dvy;
      o.z_offset = bottomZ; // = topZ − totalRise
    }
    return [o];
  }

  // Balanced risers across flights (remainder falls to the anchor flight).
  const perFlight = Math.ceil(totalSteps / numFlights);
  const risersFor = (t: number) =>
    Math.max(0, Math.min(perFlight, totalSteps - t * perFlight));
  const flightRun = Math.max(1, perFlight - 1) * tread; // full flight tread run

  // --- Build CANONICAL along +Y from the ANCHOR connection at (0,0). For "down"
  // the anchor is the TOP (z descends from 0); for "up" the BOTTOM (z ascends
  // from 0). Even flights connect at the NEAR end, odd at the FAR end (adjacent
  // lane). Turn landings sit at the platform each flight hands off on. Then rotate
  // +Y → `direction`, translate (0,0) → (start_x, start_y), and lift z.
  type Item = { o: Obj; isStair: boolean };
  const items: Item[] = [];
  const stepFields = { step_rise: riser, step_tread: tread, step_width: width };
  let zCur = 0; // canonical z of the current flight's ANCHORED platform
  for (let t = 0; t < numFlights; t++) {
    const risers = risersFor(t);
    if (risers <= 0) break;
    const treads = Math.max(1, risers - 1);
    const even = t % 2 === 0;
    const lane = even ? 0 : laneOffset;
    const run = treads * tread;
    if (up) {
      const zBottomFlight = zCur;
      const zTopFlight = zCur + risers * riser;
      items.push({
        isStair: true,
        o: even
          ? { type: "staircase", direction: "south", start_x: lane, start_y: 0, num_steps: treads, ...stepFields, z_offset: zBottomFlight }
          : { type: "staircase", direction: "north", start_x: lane, start_y: flightRun, num_steps: treads, ...stepFields, z_offset: zBottomFlight },
      });
      if (t < numFlights - 1) {
        // Landing at the TOP this flight reaches: even tops out at the FAR end,
        // odd at the NEAR end; its top is flush with the platform (zTopFlight).
        items.push({
          isStair: false,
          o: { type: "floor_slab", x: landingX, y: even ? flightRun : -landingDepth, width: landingWidth, length: landingDepth, thickness: landingThickness, z_offset: zTopFlight - landingThickness },
        });
      }
      zCur = zTopFlight;
    } else {
      const zBottom = zCur - risers * riser;
      items.push({
        isStair: true,
        o: even
          ? { type: "staircase", direction: "north", start_x: lane, start_y: run, num_steps: treads, ...stepFields, z_offset: zBottom }
          : { type: "staircase", direction: "south", start_x: lane, start_y: flightRun - run, num_steps: treads, ...stepFields, z_offset: zBottom },
      });
      if (t < numFlights - 1) {
        items.push({
          isStair: false,
          o: { type: "floor_slab", x: landingX, y: even ? flightRun : -landingDepth, width: landingWidth, length: landingDepth, thickness: landingThickness, z_offset: zBottom - landingThickness },
        });
      }
      zCur = zBottom;
    }
  }

  const rotated = items.map((it) => ({ ...it, o: rotateObject(it.o, direction) }));
  const dx = n(sc.start_x);
  const dy = n(sc.start_y);
  // The canonical anchor platform (flight 0) is at z=0, so lift the whole build by
  // the anchor's real height. (For "down" that's the top; for "up" the bottom.)
  const liftZ = anchorZ;

  const baseName = (sc.name as string) ?? "Stair";
  let fi = 0;
  let li = 0;
  return rotated.map(({ o, isStair }) => {
    if (typeof o.x === "number") o.x += dx;
    if (typeof o.y === "number") o.y += dy;
    if (typeof o.start_x === "number") o.start_x += dx;
    if (typeof o.start_y === "number") o.start_y += dy;
    o.z_offset = n(o.z_offset) + liftZ;
    if (sc.layer !== undefined) o.layer = sc.layer;
    if (isStair && sc.material !== undefined) o.material = sc.material;
    o.name = isStair ? `${baseName}_F${++fi}` : `${baseName}_L${++li}`;
    return o;
  });
}

// Fit the WHOLE staircase (flights + turn landings) inside the allocated box.
// `width` (X) × `length` (Y) is the rectangle; (start_x,start_y) is its min
// corner. `direction` picks the run axis (N/S → run along length/Y, E/W → run
// along width/X); the other axis is lateral. Per-step width is derived from the
// box: two switchback lanes = (lateral − flight_gap)/2, or the full box for a
// single flight. Throws when the box is too small for even the tightest split.
function expandStaircaseBox(
  sc: Obj,
  slabThickness: number,
  floorBelowHeight: number,
  floorOwnHeight: number,
): Obj[] {
  const up = ((sc.climb as string | undefined) ?? "down") === "up";
  const tread = n(sc.step_tread);
  const riser = n(sc.step_rise);
  const direction = (sc.direction as Dir) ?? "south";
  const runAlongY = direction === "south" || direction === "north";
  const boxW = n(sc.width);   // X extent of the box
  const boxL = n(sc.length);  // Y extent of the box
  const runBudget = runAlongY ? boxL : boxW;       // space along the climb
  const lateralExtent = runAlongY ? boxW : boxL;   // space across the flights
  const name = (sc.name as string) ?? "Stair";

  const defaultRise = up ? floorOwnHeight : floorBelowHeight;
  const riseHeight =
    typeof sc.rise_height === "number" && sc.rise_height > 0 ? sc.rise_height : defaultRise;
  const totalSteps = Math.max(1, Math.round(riseHeight / riser));
  const anchorZ = sc.z_offset !== undefined ? n(sc.z_offset) : slabThickness;

  const gap = typeof sc.flight_gap === "number" && sc.flight_gap > 0 ? sc.flight_gap : 0;
  const laneWidth = (lateralExtent - gap) / 2;      // width of one switchback lane
  const landingDepth =
    typeof sc.landing_depth === "number" && sc.landing_depth > 0
      ? sc.landing_depth
      : Math.max(1, laneWidth);
  const landingThickness =
    typeof sc.landing_thickness === "number" ? sc.landing_thickness : riser;

  // Fewest flights whose run + end landings fit the run budget. A switchback tops
  // out at BOTH ends (near + far landings) once it has ≥3 flights; exactly 2
  // flights need only the far landing; 1 flight needs none.
  const singleRun = (totalSteps - 1) * tread;
  const flightRunFor = (nf: number) => (Math.ceil(totalSteps / nf) - 1) * tread;
  const reserveFor = (nf: number) => (nf <= 1 ? 0 : nf === 2 ? landingDepth : 2 * landingDepth);
  let numFlights = 1;
  if (singleRun > runBudget + 1e-6) {
    numFlights = 0;
    for (let nf = 2; nf <= totalSteps; nf++) {
      if (Math.ceil(totalSteps / nf) < 2) break; // each flight must have ≥1 tread
      if (flightRunFor(nf) + reserveFor(nf) <= runBudget + 1e-6) { numFlights = nf; break; }
    }
    if (numFlights === 0) {
      const minLen = tread + 2 * landingDepth;
      throw new Error(
        `staircase "${name}" doesn't fit its box along ${runAlongY ? "length (Y)" : "width (X)"}: ` +
          `need at least ${Math.ceil(minLen)} (one ${tread}-unit tread + two ${landingDepth}-unit landings), ` +
          `but only ${Math.floor(runBudget)} is allocated. Enlarge the box or reduce landing_depth.`,
      );
    }
  }

  const nLanes = numFlights >= 2 ? 2 : 1;
  const stairWidth = nLanes === 2 ? laneWidth : lateralExtent;
  if (!(stairWidth > 0)) {
    throw new Error(
      `staircase "${name}" doesn't fit its box across the stairs: the ${Math.floor(lateralExtent)}-unit ` +
        `side leaves no room for ${nLanes === 2 ? "two lanes" : "a flight"} past flight_gap ${gap}.`,
    );
  }

  const perFlight = Math.ceil(totalSteps / numFlights);
  const risersFor = (t: number) => Math.max(0, Math.min(perFlight, totalSteps - t * perFlight));
  const flightRun = Math.max(1, perFlight - 1) * tread;

  // Placement in the box's local frame: run axis = +Y, lateral = +X, from (0,0).
  // Reserve a near-end landing zone [0, landingDepth] only when ≥3 flights need a
  // near turn; flights then start at `nearOffset`, far landings sit just past them.
  const hasNear = numFlights >= 3;
  const nearOffset = hasNear ? landingDepth : 0;
  // Turn handedness only swaps which lane each flight sits in.
  const anti = sc.turn === "anticlockwise";
  const laneA = anti ? stairWidth + gap : 0;
  const laneB = anti ? 0 : stairWidth + gap;
  const landingWidth = nLanes === 2 ? 2 * stairWidth + gap : stairWidth;

  type Item = { o: Obj; isStair: boolean };
  const items: Item[] = [];
  const stepFields = { step_rise: riser, step_tread: tread, step_width: stairWidth };
  let zCur = 0; // canonical z of the current flight's anchored platform
  for (let t = 0; t < numFlights; t++) {
    const risers = risersFor(t);
    if (risers <= 0) break;
    const treads = Math.max(1, risers - 1);
    const even = t % 2 === 0;
    const lane = even ? laneA : laneB;
    const run = treads * tread;
    if (up) {
      const zBottomFlight = zCur;
      const zTopFlight = zCur + risers * riser;
      items.push({
        isStair: true,
        o: even
          ? { type: "staircase", direction: "south", start_x: lane, start_y: nearOffset, num_steps: treads, ...stepFields, z_offset: zBottomFlight }
          : { type: "staircase", direction: "north", start_x: lane, start_y: nearOffset + flightRun, num_steps: treads, ...stepFields, z_offset: zBottomFlight },
      });
      if (t < numFlights - 1) {
        // even tops out FAR (landing just beyond); odd tops out NEAR (landing in the reserved near zone).
        const ly = even ? nearOffset + flightRun : nearOffset - landingDepth;
        items.push({ isStair: false, o: { type: "floor_slab", x: 0, y: ly, width: landingWidth, length: landingDepth, thickness: landingThickness, z_offset: zTopFlight - landingThickness } });
      }
      zCur = zTopFlight;
    } else {
      const zBottom = zCur - risers * riser;
      items.push({
        isStair: true,
        o: even
          ? { type: "staircase", direction: "north", start_x: lane, start_y: nearOffset + run, num_steps: treads, ...stepFields, z_offset: zBottom }
          : { type: "staircase", direction: "south", start_x: lane, start_y: nearOffset + flightRun - run, num_steps: treads, ...stepFields, z_offset: zBottom },
      });
      if (t < numFlights - 1) {
        const ly = even ? nearOffset + flightRun : nearOffset - landingDepth;
        items.push({ isStair: false, o: { type: "floor_slab", x: 0, y: ly, width: landingWidth, length: landingDepth, thickness: landingThickness, z_offset: zBottom - landingThickness } });
      }
      zCur = zBottom;
    }
  }

  // Rotate the local build to `direction`, then translate so the box's MIN corner
  // lands exactly at (start_x, start_y) — the stair fills [start, start+box] for
  // any direction. Lift z so the anchored platform sits at its real height.
  const rotated = items.map((it) => ({ ...it, o: rotateObject(it.o, direction) }));
  let minX = Infinity, minY = Infinity;
  for (const { o } of rotated) {
    const [ox, oy] = objMinCorner(o);
    if (ox < minX) minX = ox;
    if (oy < minY) minY = oy;
  }
  const dx = n(sc.start_x) - minX;
  const dy = n(sc.start_y) - minY;

  let fi = 0, li = 0;
  return rotated.map(({ o, isStair }) => {
    if (typeof o.x === "number") o.x += dx;
    if (typeof o.y === "number") o.y += dy;
    if (typeof o.start_x === "number") o.start_x += dx;
    if (typeof o.start_y === "number") o.start_y += dy;
    o.z_offset = n(o.z_offset) + anchorZ;
    if (sc.layer !== undefined) o.layer = sc.layer;
    if (isStair && sc.material !== undefined) o.material = sc.material;
    o.name = isStair ? `${name}_F${++fi}` : `${name}_L${++li}`;
    return o;
  });
}

// Min (x,y) corner of an expanded staircase-flight or landing in plan.
function objMinCorner(o: Obj): [number, number] {
  if (o.type === "floor_slab") return [n(o.x), n(o.y)];
  const sx = n(o.start_x), sy = n(o.start_y);
  const r = n(o.num_steps) * n(o.step_tread), w = n(o.step_width);
  const dir = o.direction as Dir;
  const [vx, vy] = DIR_VEC[dir];
  const ns = dir === "north" || dir === "south";
  const ex = sx + (ns ? w : r * vx);
  const ey = sy + (ns ? r * vy : w);
  return [Math.min(sx, ex), Math.min(sy, ey)];
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
