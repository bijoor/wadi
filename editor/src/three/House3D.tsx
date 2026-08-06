// Walks the (already expanded) house_config and emits box primitives.
// One <group> per layer so the layer toggles can hide whole buckets by
// toggling the group's `visible` prop.
//
// Walls are rendered with CSG subtraction for their openings so doors
// and windows are actual holes rather than flat overlays. Openings are
// matched to walls by physical position (independent of the opening's
// `direction` field, so direction-override cases like
// Bathroom_2_Entry_N — which sits on Bedroom_3's south wall but faces
// north — resolve to the right wall).

import { useEffect, useMemo } from "react";
import { expandRoomWalls, type HouseConfig } from "../svg2d/expand";
import { pillarRects, trimSpans, type PillarRect } from "../svg2d/wallTrim";
import { BoxWithHoles } from "./slabCSG";
import {
  computeFloorZBands,
  readGlobals,
  readPlotBounds,
  toThreePos,
} from "./coords";
import {
  BeamBox,
  CONCRETE_COLOR,
  FloorSlabBox,
  GroundPlane,
  PillarBox,
  PlinthBox,
} from "./boxes";
import { V2RoofFrame, V2RoofGableWalls, V2RoofSolid, V2RoofSurface } from "./V2RoofSolid";
import { StaircaseMesh } from "./staircase";
import { getNode } from "../registry/registry";
import { WallWithOpenings, type WallOpening } from "./wallCSG";
import { OpeningPane } from "./openings";
import { defaultLayerFor, effectiveLayers, useLayerStore } from "./layers";
import { setExpansionWarnings, setRoofWarnings } from "./geometryWarnings";
import { computeMergedV2Spec } from "./v2RoofFromHouse";
import { useLayerDefaultsStore } from "../state/layerDefaults";
import {
  buildRoomRects,
  splitWallByCoverage,
  classifyStandaloneWall,
  type RoomRect,
} from "../estimate/wallArea";

interface Obj {
  type: string;
  [k: string]: unknown;
}

const POS_TOL = 2.0; // matches Python's normalize_edge_key tolerance

// Short deterministic hash of an object's content, appended to its React key so
// a geometry change remounts the object (see the key comment in byLayer). djb2.
function objHash(o: unknown): string {
  const s = JSON.stringify(o);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function House3D({ config }: { config: HouseConfig }) {
  const visible = useLayerStore((s) => s.visible);
  // Global default-layer-role prefs (localStorage). Subscribed so a change re-groups
  // the scene live; also fed into the grouping + menu below.
  const layerDefaults = useLayerDefaultsStore((s) => s.overrides);

  // Roof-derivation failures. The real roof renders through the V2Roof*
  // components, which each derive-and-swallow independently — so a roof that
  // fails to build (e.g. an unresolved slope → rise 0) renders as NOTHING with
  // no error. Re-derive once here via the canonical path (same source of truth
  // as wadi_check) purely to collect + surface those warnings to the banner.
  const roofWarnings = useMemo(() => {
    try {
      return computeMergedV2Spec(config).warnings ?? [];
    } catch {
      return [] as string[];
    }
  }, [config]);
  useEffect(() => {
    setRoofWarnings(roofWarnings);
    return () => setRoofWarnings([]);
  }, [roofWarnings]);

  const byLayer = useMemo(() => {
    // Lenient expansion: a wall/room whose openings are invalid (out-of-range,
    // diagonal wall mid-edit, zero length, overlap…) is rendered as a SOLID
    // wall instead of aborting the whole scene. Previously any such error blanked
    // the entire 3D model ("stopped loading"); now only the bad opening drops out
    // and the reason is surfaced so the user can fix it. Truly fatal errors
    // (non-opening) still fall through to the empty-scene guard.
    const warnings: string[] = [];
    let hc: ReturnType<typeof expandRoomWalls>;
    try {
      hc = expandRoomWalls(config, undefined, {
        lenient: true,
        onWarning: (m) => warnings.push(m),
      });
    } catch (e) {
      console.warn("[house3d] expandRoomWalls failed, skipping scene:", e);
      warnings.push(e instanceof Error ? e.message : String(e));
      setExpansionWarnings(warnings);
      return {} as Record<string, React.ReactNode[]>;
    }
    setExpansionWarnings(warnings);
    // House-level defaults (defaults.floor_height / slab_thickness) win
    // over the code globals; per-floor overrides win over both.
    const houseDefaults = (config as { defaults?: { floor_height?: number; slab_thickness?: number; wall_thickness?: number } }).defaults;
    const globals: Globals = {
      ...readGlobals(houseDefaults),
      units: (hc as { units?: { system?: string; per_unit?: number } }).units,
      roomRects: buildRoomRects(hc as unknown as Parameters<typeof buildRoomRects>[0]),
    };
    const plot = readPlotBounds(hc);
    // The plinth is now the first floor (number 0); its `height` seeds the
    // stack from ground(0). computeFloorZBands no longer takes a plinth height.
    const bands = computeFloorZBands(
      hc.floors ?? [],
      globals.slabThickness,
      globals.floorHeight,
      globals.wallHeight,
    );

    // Pillars are full-height structural columns that can rise through several
    // floors (e.g. a 196u column declared on the ground floor spans the first
    // floor too). Trimming each floor's walls against ONLY that floor's own
    // pillars misses those — so collect every pillar with its vertical extent
    // and, per floor, trim against any whose extent overlaps that floor's slot.
    const allPillars: Array<{ rect: PillarRect; z0: number; z1: number }> = [];
    for (let pfi = 0; pfi < (hc.floors ?? []).length; pfi++) {
      const pband = bands[pfi];
      const pobjs = ((hc.floors![pfi].objects as Obj[] | undefined) ?? []);
      for (const rect of pillarRects(pobjs as Array<Record<string, unknown>>)) {
        // Match the render's z placement (obj.type === "pillar" branch).
        const src = pobjs.find(
          (o) => o.type === "pillar" && (o.x as number) === rect.x0 && (o.y as number) === rect.y0,
        );
        const z0 = pband.slabZ + ((src?.z_offset as number | undefined) ?? 0);
        const h = (src?.height as number | undefined) ?? pband.floorHeight;
        allPillars.push({ rect, z0, z1: z0 + h });
      }
    }

    const groups: Record<string, React.ReactNode[]> = {};
    const push = (layer: string, node: React.ReactNode) => {
      (groups[layer] ??= []).push(node);
    };

    // Roofs — v2 unified roof objects only (legacy hip/gable/flat/shed
    // types were removed). Debug snapshot retained for the viewer.
    const roofDebug: Array<Record<string, unknown>> = [];

    // V2 unified roofs (type: "roof"). Shells go into "loft" so the
    // roof-shell toggle hides them; truss members go into
    // "frame_spine" alongside legacy ridges/trusses so the framing
    // toggle hides them together.
    push("loft", <V2RoofSolid key="v2-roofs" config={hc} />);
    push("frame_spine", <V2RoofFrame key="v2-frame" config={hc} />);
    push("frame_surface", <V2RoofSurface key="v2-surface" config={hc} />);
    // Gable walls are solid masonry → they belong with the house walls.
    // Put them on the TOP floor's Walls layer (highest floor_number), so
    // toggling that floor's walls hides them too.
    {
      const topFloorNum = (hc.floors ?? []).reduce(
        (mx, f) => Math.max(mx, (f.floor_number as number) ?? 0),
        0,
      );
      push(
        defaultLayerFor("wall", topFloorNum, layerDefaults),
        <V2RoofGableWalls key="v2-gable-walls" config={hc} />,
      );
    }

    (window as unknown as { __roofDebug?: unknown }).__roofDebug = {
      status: roofDebug.length ? "ok" : "no-roof",
      roofs: roofDebug,
    };

    // The plinth is no longer a top-level object — it's a `plinth` object on
    // the Plinth floor (number 0), rendered in the per-floor loop below along
    // with the `ground` object.

    // Per-floor: index openings by physical position first, then emit
    // walls with position-matched openings.
    for (let fi = 0; fi < (hc.floors ?? []).length; fi++) {
      const floor = hc.floors![fi];
      const band = bands[fi];
      const objects = (floor.objects as Obj[] | undefined) ?? [];
      const floorNum = (floor.floor_number as number) ?? fi;
      // Floor-wise default layers (role sub-layer per floor). Per-object `layer`
      // still overrides; global role prefs feed in via layerDefaults.
      const roomLayer = defaultLayerFor("room", floorNum, layerDefaults);
      // Door/window fills go on this floor's "Doors & windows" role layer so
      // they render under the same group the menu shows (f{N}_openings) — a
      // bare "openings" id is NOT in effectiveLayers, so it would be dropped.
      const openingsLayer = defaultLayerFor("door", floorNum, layerDefaults);
      const slabLayer = defaultLayerFor("floor_slab", floorNum, layerDefaults);
      const openings = objects.filter((o) => o.type === "door" || o.type === "window");
      // Pillar footprints that pass through this floor — walls trim to their
      // faces (no overlap). Include full-height columns declared on lower floors
      // whose vertical extent reaches this floor's slot, not just this floor's
      // own pillars.
      const floorLo = band.slabZ;
      const floorHi = band.slabZ + band.floorHeight;
      const pillars = allPillars
        .filter((p) => Math.min(p.z1, floorHi) - Math.max(p.z0, floorLo) > 1e-6)
        .map((p) => p.rect);

      for (let oi = 0; oi < objects.length; oi++) {
        const obj = objects[oi];
        // Key includes a hash of the object's CONTENT, not just its index. An
        // in-place prop update to an R3F mesh can fail to repaint in WKWebView
        // (the desktop webview) — e.g. a room resized so a wall MOVES but keeps
        // the same index-key would silently not update. Hashing the geometry
        // means any change gives a new key → React remounts that object fresh
        // (like a reload), while unchanged objects keep their key (no churn).
        const key = `f${fi}-${oi}-${objHash(obj)}`;

        // Registry-driven types (item, + future ports) render themselves.
        const nodeDef = getNode(obj.type);
        if (nodeDef?.render3D) {
          const out = nodeDef.render3D(obj as Record<string, unknown>, {
            band,
            plot,
            unitsRef: globals.units,
            floorNum,
            key,
          });
          if (out) push(out.layerId, out.node);
          continue;
        }

        if (obj.type === "plinth") {
          // Plinth object (on the Plinth floor). Rises from ground (its
          // band.slabZ is 0); PlinthBox seats itself from y=0 to height.
          const x = obj.x as number, y = obj.y as number;
          const w = obj.width as number, l = obj.length as number;
          const h = (obj.height as number | undefined) ?? band.floorHeight;
          const c = toThreePos(x + w / 2, y + l / 2, 0, plot.width, plot.length);
          push(
            (obj.layer as string | undefined) ?? defaultLayerFor("plinth", floorNum, layerDefaults),
            <PlinthBox key={key} cx={c.x} cz={c.z} width={w} length={l} height={h} />,
          );
        } else if (obj.type === "ground") {
          // Ground plane (on the Plinth floor). GroundPlane centres on the
          // origin and sizes to the object's own extent (× 1.5 internally).
          const w = obj.width as number, l = obj.length as number;
          push(
            (obj.layer as string | undefined) ?? defaultLayerFor("ground", floorNum, layerDefaults),
            <GroundPlane key={key} width={w} length={l} />,
          );
        } else if (obj.type === "floor_slab") {
          const x = obj.x as number, y = obj.y as number;
          const w = obj.width as number, l = obj.length as number;
          // Slab thickness defaults to the floor's slab_thickness
          // (band.slabThickness). Per-object `thickness` overrides.
          const slabT = (obj.thickness as number | undefined) ?? band.slabThickness;
          // z_offset lifts the slab above the floor's slab level — e.g. a
          // stair landing at mid-height (matches beam's z_offset).
          const slabZOffset = (obj.z_offset as number | undefined) ?? 0;
          const c = toThreePos(x + w / 2, y + l / 2, 0, plot.width, plot.length);
          // Pillars overlapping this slab → cut their footprints out so the
          // columns pass through instead of overlapping the deck. Local-frame
          // offsets (origin at slab centre) = plain world offsets (toThreePos is
          // a translation).
          const slabHoles = pillars
            .filter((p) => p.x1 > x && p.x0 < x + w && p.y1 > y && p.y0 < y + l)
            .map((p) => ({ x: (p.x0 + p.x1) / 2 - (x + w / 2), z: (p.y0 + p.y1) / 2 - (y + l / 2), w: p.x1 - p.x0, l: p.y1 - p.y0 }));
          const slabObjLayer = (obj.layer as string | undefined) ?? slabLayer;
          if (slabHoles.length) {
            push(
              slabObjLayer,
              <BoxWithHoles
                key={key}
                cx={c.x}
                cy={band.slabZ + slabZOffset + slabT / 2}
                cz={c.z}
                width={w}
                length={l}
                thickness={slabT}
                color={CONCRETE_COLOR}
                holes={slabHoles}
              />,
            );
          } else {
            push(
              slabObjLayer,
              <FloorSlabBox key={key} cx={c.x} cz={c.z} width={w} length={l} z={band.slabZ + slabZOffset} thickness={slabT} />,
            );
          }
        } else if (obj.type === "beam") {
          const x = obj.x as number, y = obj.y as number;
          const w = obj.width as number, l = obj.length as number;
          // Beam thickness defaults to the floor's slab_thickness
          // (band.slabThickness). Per-object `height` overrides.
          const h = (obj.height as number | undefined) ?? band.slabThickness;
          // z_offset (project units, 10 = 1 ft) lifts the beam above
          // the floor's reference start (band.slabZ) — used e.g. for
          // top-of-wall beams that sit at slab + wall height.
          const zOffsetU = (obj.z_offset as number | undefined) ?? 0;
          const c = toThreePos(x + w / 2, y + l / 2, 0, plot.width, plot.length);
          const beamObjLayer = (obj.layer as string | undefined) ?? defaultLayerFor("beam", floorNum, layerDefaults);
          // Pillars overlapping this beam in plan → cut their footprints out so
          // the column passes through instead of overlapping (and z-fighting
          // with) the beam. Same treatment as slabs; local-frame offsets (origin
          // at beam centre) = plain world offsets (toThreePos is a translation).
          // Plan-overlap only (pillars are full floor height, so they reach every
          // beam level) — matches the slab logic above.
          const beamHoles = pillars
            .filter((p) => p.x1 > x && p.x0 < x + w && p.y1 > y && p.y0 < y + l)
            .map((p) => ({ x: (p.x0 + p.x1) / 2 - (x + w / 2), z: (p.y0 + p.y1) / 2 - (y + l / 2), w: p.x1 - p.x0, l: p.y1 - p.y0 }));
          if (beamHoles.length) {
            push(
              beamObjLayer,
              <BoxWithHoles
                key={key}
                cx={c.x}
                cy={band.slabZ + zOffsetU + h / 2}
                cz={c.z}
                width={w}
                length={l}
                thickness={h}
                color={CONCRETE_COLOR}
                holes={beamHoles}
              />,
            );
          } else {
            push(
              beamObjLayer,
              <BeamBox
                key={key}
                cx={c.x}
                cz={c.z}
                width={w}
                length={l}
                z={band.slabZ + zOffsetU}
                height={h}
              />,
            );
          }
        } else if (obj.type === "pillar") {
          const x = obj.x as number, y = obj.y as number;
          const w = (obj.width as number | undefined) ?? (obj.size as number | undefined) ?? globals.wallThickness;
          const l = (obj.length as number | undefined) ?? (obj.size as number | undefined) ?? globals.wallThickness;
          const h = (obj.height as number | undefined) ?? band.floorHeight;
          // Stored x,y is the TOP-LEFT CORNER (like rooms/slabs/beams above);
          // PillarBox centers on the passed position, so convert corner→center.
          const c = toThreePos(x + w / 2, y + l / 2, 0, plot.width, plot.length);
          push(
            (obj.layer as string | undefined) ?? defaultLayerFor("pillar", floorNum, layerDefaults),
            <PillarBox
              key={key}
              cx={c.x}
              cz={c.z}
              width={w}
              length={l}
              // Pillars rise from the FLOOR BASE (band.slabZ = plinth top on
              // floor 0, else the floor below's top) through the slab to the
              // ring beam above. Unified z_offset convention (default 0),
              // matching beams/slabs. On floor 0 this equals the plinth top,
              // preserving the previous behaviour.
              z={band.slabZ + ((obj.z_offset as number | undefined) ?? 0)}
              height={h}
            />,
          );
        } else if (obj.type === "room") {
          emitRoomWalls(obj, band, globals, plot, key, openings, push, (obj.layer as string | undefined) ?? roomLayer, openingsLayer, pillars, fi);
        } else if (obj.type === "wall") {
          emitStandaloneWall(obj, band, globals, plot, key, openings, push, (obj.layer as string | undefined) ?? roomLayer, openingsLayer, pillars, fi);
        } else if (obj.type === "staircase") {
          // Supports the "new" schema (start_x/start_y + step_* +
          // compass direction). Legacy format (x/y/width/length) can be
          // added later — the current house_config uses only the new one.
          const startX = obj.start_x as number;
          const startY = obj.start_y as number;
          const numSteps = (obj.num_steps as number | undefined) ?? 10;
          const stepWidth = (obj.step_width as number | undefined) ?? 30;
          const stepTread = (obj.step_tread as number | undefined) ?? 10;
          const stepRise = (obj.step_rise as number | undefined) ?? 5;
          const direction =
            (obj.direction as "north" | "south" | "east" | "west" | undefined) ?? "north";
          // Unified z_offset: measured from the FLOOR BASE (band.slabZ).
          // Omitted → the floor's slab thickness, so the first step sits on
          // the walking surface (= band.wallZ) as before. Set it for a
          // second flight starting at a mid-height landing.
          const stairBaseZ =
            band.slabZ + ((obj.z_offset as number | undefined) ?? band.slabThickness);
          push(
            (obj.layer as string | undefined) ?? slabLayer,
            <StaircaseMesh
              key={key}
              startX={startX}
              startY={startY}
              numSteps={numSteps}
              stepWidth={stepWidth}
              stepTread={stepTread}
              stepRise={stepRise}
              direction={direction}
              wallZ={stairBaseZ}
              plotWidth={plot.width}
              plotLength={plot.length}
            />,
          );
        } else if (obj.type === "kitchen_platform") {
          // Path-based platform — render one box per polyline segment.
          // Each segment extrudes a rectangle of `depth` × segment-length
          // in XY, from base_z (default = floor slab top) up by `height`.
          // The `side` picks which side of segment direction the platform
          // extends: "left" = +90° CCW from start→end, "right" = -90°.
          const path = obj.path as [number, number][];
          const depth = obj.depth as number;
          const height = obj.height as number;
          const side = (obj.side as "left" | "right" | undefined) ?? "right";
          // Absolute `base_z` still wins; otherwise unified z_offset from the
          // floor base (default = slab thickness → sits on the slab top).
          const baseZ =
            (obj.base_z as number | undefined) ??
            band.slabZ + ((obj.z_offset as number | undefined) ?? band.slabThickness);
          for (let i = 0; i < path.length - 1; i++) {
            const a = path[i], b = path[i + 1];
            const dx = b[0] - a[0], dy = b[1] - a[1];
            const segLen = Math.hypot(dx, dy);
            if (segLen < 1e-6) continue;
            const ux = dx / segLen, uy = dy / segLen;
            // Perpendicular: +90° CCW (leftN) = (-uy, ux)
            const perpX = side === "left" ? -uy : uy;
            const perpY = side === "left" ? ux : -ux;
            // Rectangle corners in XY: back edge on path, front edge
            // offset by depth in the perp direction. Centre = midpoint
            // between them.
            const midAlongX = (a[0] + b[0]) / 2;
            const midAlongY = (a[1] + b[1]) / 2;
            const cxWorld = midAlongX + perpX * (depth / 2);
            const cyWorld = midAlongY + perpY * (depth / 2);
            const centre = toThreePos(cxWorld, cyWorld, 0, plot.width, plot.length);
            // Orientation: box's local X = segment direction, local Z =
            // depth direction (into room), local Y = up.
            const angleY = Math.atan2(-uy, ux);   // three.js z inverted from world y
            push(
              (obj.layer as string | undefined) ?? slabLayer,
              <mesh
                key={`${key}-${i}`}
                position={[centre.x, baseZ + height / 2, centre.z]}
                rotation={[0, angleY, 0]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[segLen, height, depth]} />
                <meshStandardMaterial color="#3f3f46" roughness={0.7} />
              </mesh>,
            );
          }
        }
        // door/window: emitted alongside their wall via WallWithOpenings +
        // OpeningPane. No standalone rendering.
      }
    }

    return groups;
  }, [config, layerDefaults]);

  // Layers to render, derived purely from the config (same helper the menu
  // uses) so scene + menu stay in lockstep. Any group id present in byLayer
  // is guaranteed to be in here by effectiveLayers (it replicates the push
  // fallbacks), so nothing is dropped.
  const displayLayers = useMemo(() => effectiveLayers(config, layerDefaults), [config, layerDefaults]);

  return (
    <>
      {displayLayers.map((l) => {
        const kids = byLayer[l.id];
        // Openings (door/window fills) leak: when a room PERSISTS but its
        // openings change or are removed, R3F doesn't dispose the old
        // OpeningPane meshes on the in-place child swap (removing the room
        // entirely does clear them — so it's specific to a surviving parent
        // group). Wrap the openings content in an inner group re-KEYED by its
        // child set, so any change remounts it and the stale panes are
        // disposed. Scoped to openings sub-layers: the CSG-heavy wall/structure
        // layers keep their per-object useMemo caches (no needless recompute).
        const content = l.id.endsWith("_openings") ? (
          <group key={childSig(kids)}>{kids}</group>
        ) : (
          kids
        );
        return (
          <group key={l.id} visible={visible[l.id] !== false}>
            {content}
          </group>
        );
      })}
    </>
  );
}

// A stable signature of a layer's children, from their React keys. Changes
// whenever a child is added, removed, or re-keyed (our keys embed a content
// hash), so using it as a group key forces a clean remount on any change.
function childSig(kids: React.ReactNode[] | undefined): string {
  if (!Array.isArray(kids) || kids.length === 0) return "empty";
  const keys: string[] = [];
  for (const k of kids) {
    if (k && typeof k === "object" && "key" in k && k.key != null) keys.push(String(k.key));
  }
  return keys.length ? keys.join("|") : `n${kids.length}`;
}

// ---- helpers -------------------------------------------------------

type PushFn = (layer: string, node: React.ReactNode) => void;

interface Band {
  slabZ: number; wallZ: number; wallTop: number;
  floorHeight: number; wallHeight: number; slabThickness: number;
}
interface Globals {
  wallThickness: number;
  slabThickness: number;
  roofThickness: number;
  beamSize: number;
  floorHeight: number;
  wallHeight: number;
  // Project units settings (system + per_unit) — used to keep wall/roof
  // texture block size physically constant across projects.
  units?: { system?: string; per_unit?: number };
  // Room rectangles across all floors (each tagged with its floor index) —
  // used to classify each wall as external (weather-facing → laterite texture)
  // or internal (partition → plain paint).
  roomRects: RoomRect[];
}
interface Plot { width: number; length: number }

// Outward (weather) normal per room side, in Inkscape coords (X-right, Y-down).
const SIDE_OUT_NORMAL: Record<string, [number, number]> = {
  north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0],
};
// The sign of a wall's LOCAL +Z (thickness) axis that points toward `outward`.
// A wall's local +Z maps to Inkscape (sin rotY, cos rotY); the outer (weather)
// face is whichever big face's normal aligns with the outward direction.
function outerLocalZSign(rotY: number, nx: number, ny: number): 1 | -1 {
  return Math.sin(rotY) * nx + Math.cos(rotY) * ny >= 0 ? 1 : -1;
}

function heightFor(
  room: Obj,
  side: string,
  defaultH: number,
): number {
  const wh = (room.wall_heights as Record<string, unknown> | undefined) ?? {};
  const entry = wh[side];
  if (typeof entry === "number") return entry;
  if (entry && typeof entry === "object") {
    const h = (entry as { height?: number }).height;
    if (typeof h === "number") return h;
  }
  const h = room.height as number | undefined;
  return h ?? defaultH;
}

// Match an opening to a wall by physical position (independent of the
// opening's `direction` field, which can be overridden). Returns the
// `along` and `from` offsets in the wall's local frame if it matches.
function matchOpeningToRoomWall(
  op: Obj,
  side: "north" | "south" | "east" | "west",
  rx: number, ry: number, rw: number, rl: number, t: number,
): WallOpening | null {
  const x = op.x as number, y = op.y as number;
  const w = op.width as number, h = op.height as number;
  const kind = op.type as "door" | "window";
  const sill = kind === "window" ? ((op.sill_height as number | undefined) ?? 0) : 0;

  // Orientation guard: an opening belongs to walls of ONE orientation
  // (direction north/south → horizontal wall, east/west → vertical). Without
  // this, an opening at a shared corner (offset 0) sits exactly on the
  // PERPENDICULAR wall's line too and would be drawn on it as a phantom.
  const dir = (op.direction as string | undefined)?.toLowerCase();
  if (dir === "north" || dir === "south") {
    if (side === "east" || side === "west") return null;
  } else if (dir === "east" || dir === "west") {
    if (side === "north" || side === "south") return null;
  }

  if (side === "north") {
    // Wall at y ~ ry
    if (Math.abs(y - ry) > POS_TOL) return null;
    if (x < rx - POS_TOL || x + w > rx + rw + POS_TOL) return null;
    return { along: x - rx, from: sill, width: w, height: h, kind, open: op.open as boolean | undefined };
  }
  if (side === "south") {
    if (Math.abs(y - (ry + rl - t)) > POS_TOL) return null;
    if (x < rx - POS_TOL || x + w > rx + rw + POS_TOL) return null;
    return { along: x - rx, from: sill, width: w, height: h, kind, open: op.open as boolean | undefined };
  }
  if (side === "west") {
    if (Math.abs(x - rx) > POS_TOL) return null;
    if (y < ry - POS_TOL || y + w > ry + rl + POS_TOL) return null;
    return { along: y - ry, from: sill, width: w, height: h, kind, open: op.open as boolean | undefined };
  }
  // east
  if (Math.abs(x - (rx + rw - t)) > POS_TOL) return null;
  if (y < ry - POS_TOL || y + w > ry + rl + POS_TOL) return null;
  return { along: y - ry, from: sill, width: w, height: h, kind, open: op.open as boolean | undefined };
}

function matchOpeningToStandaloneWall(
  op: Obj,
  sx: number, sy: number, ex: number, ey: number, t: number,
): WallOpening | null {
  const dx = ex - sx, dy = ey - sy;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return null;
  const ux = dx / length, uy = dy / length;
  const x = op.x as number, y = op.y as number;
  const w = op.width as number, h = op.height as number;
  const kind = op.type as "door" | "window";
  const sill = kind === "window" ? ((op.sill_height as number | undefined) ?? 0) : 0;

  // Orientation guard (see matchOpeningToRoomWall): an opening's `direction`
  // (north/south → horizontal wall, east/west → vertical) must match this
  // wall's axis, so a corner opening isn't drawn on a perpendicular wall.
  const dir = (op.direction as string | undefined)?.toLowerCase();
  if (dir === "north" || dir === "south" || dir === "east" || dir === "west") {
    const opHorizontal = dir === "north" || dir === "south";
    const wallHorizontal = Math.abs(dx) >= Math.abs(dy);
    if (opHorizontal !== wallHorizontal) return null;
  }

  // Project (x, y) onto the wall's line.
  // The expander shifts the opening's world coord by -t/2 along the
  // wall's normal (see wall_opening_to_flat), so project from the
  // opening's "outer" side back to the wall centreline.
  const halfT = t / 2;
  const nx = -uy, ny = ux; // perpendicular (normal), rotated 90° CCW
  const cx = x + halfT * Math.abs(nx);
  const cy = y + halfT * Math.abs(ny);
  const proj = (cx - sx) * ux + (cy - sy) * uy;
  const perp = Math.abs((cx - sx) * nx + (cy - sy) * ny);
  if (perp > POS_TOL) return null;
  if (proj < -POS_TOL || proj + w > length + POS_TOL) return null;
  return { along: proj, from: sill, width: w, height: h, kind, open: op.open as boolean | undefined };
}

function emitRoomWalls(
  obj: Obj,
  band: Band,
  globals: Globals,
  plot: Plot,
  key: string,
  openings: Obj[],
  push: PushFn,
  layer: string,
  openingsLayer: string,
  pillars: PillarRect[],
  floorIdx: number,
) {
  const rawWalls = obj.walls as string[] | Record<string, unknown> | undefined;
  const wallsList: string[] = rawWalls
    ? Array.isArray(rawWalls) ? rawWalls : Object.keys(rawWalls)
    : ["north", "south", "east", "west"];
  const rx = obj.x as number, ry = obj.y as number;
  const rw = obj.width as number, rl = obj.length as number;
  const t = (obj.wall_thickness as number | undefined) ?? globals.wallThickness;
  // Unified z_offset from the FLOOR BASE. Omitted → the floor's slab
  // thickness, so walls sit on the slab top (= band.wallZ) as before; set it
  // for a split-level room.
  const baseZ = band.slabZ + ((obj.z_offset as number | undefined) ?? band.slabThickness);

  for (const sideRaw of wallsList) {
    const side = sideRaw.toLowerCase() as "north" | "south" | "east" | "west";
    // Walls use the floor's WALL height (independent of floor_height).
    const wh = heightFor(obj, side, band.wallHeight);

    const matched: WallOpening[] = [];
    for (const op of openings) {
      const m = matchOpeningToRoomWall(op, side, rx, ry, rw, rl, t);
      if (m) matched.push(m);
    }

    // The wall as an axis-aligned run: axis ("x"/"y"), the perpendicular centre,
    // and the world span. Openings' `along` is measured from the span start.
    let axis: "x" | "y", perp: number, aStart: number, aEnd: number, rotY: number;
    if (side === "north") {
      axis = "x"; perp = ry + t / 2; aStart = rx; aEnd = rx + rw; rotY = 0;
    } else if (side === "south") {
      axis = "x"; perp = ry + rl - t / 2; aStart = rx; aEnd = rx + rw; rotY = 0;
    } else if (side === "east") {
      axis = "y"; perp = rx + rw - t / 2; aStart = ry + t; aEnd = ry + rl - t; rotY = -Math.PI / 2;
    } else {
      axis = "y"; perp = rx + t / 2; aStart = ry + t; aEnd = ry + rl - t; rotY = -Math.PI / 2;
    }
    // East/west walls are inset by `t` on each end (corners belong to N/S), so
    // measure `along` from the inset span start.
    if (side === "east" || side === "west") for (const m of matched) m.along -= t;
    // Which local-Z face is the weather face (only meaningful when external).
    const outerSign = outerLocalZSign(rotY, SIDE_OUT_NORMAL[side][0], SIDE_OUT_NORMAL[side][1]);

    // Trim the run so it stops at any overlapping pillar's faces; a wall with
    // no overlap yields the single full span (unchanged geometry).
    const trimmed = pillars.length
      ? trimSpans(axis === "x" ? "h" : "v", perp, aStart, aEnd, t, pillars)
      : ([[aStart, aEnd]] as [number, number][]);
    // Sample line just past the outer face; split each span where a porch /
    // balcony / room-above starts or stops covering the wall, so the exposed
    // length reads as exterior (laterite) and the covered length as interior.
    const probe = Math.max(6, t * 1.5);
    const beyond =
      side === "north" ? ry - probe
      : side === "south" ? ry + rl + probe
      : side === "east" ? rx + rw + probe
      : rx - probe;
    const segments = trimmed.flatMap(([ws, we]) =>
      splitWallByCoverage(globals.roomRects, axis, beyond, ws, we, floorIdx),
    );

    for (const { s: ws, e: we, external } of segments) {
      const subLen = we - ws;
      if (subLen < 1e-6) continue;
      const off = ws - aStart; // this piece's offset into the original wall
      const sub = matched
        .filter((m) => {
          const cen = m.along + m.width / 2;
          return cen >= off - 1e-6 && cen <= off + subLen + 1e-6;
        })
        .map((m) => ({ ...m, along: m.along - off }));
      const cxW = axis === "x" ? ws + subLen / 2 : perp;
      const cyW = axis === "x" ? perp : ws + subLen / 2;
      const c = toThreePos(cxW, cyW, 0, plot.width, plot.length);
      push(
        layer,
        <WallWithOpenings
          key={`${key}-${side}-${ws.toFixed(1)}`}
          cx={c.x}
          cy={baseZ + wh / 2}
          cz={c.z}
          length={subLen}
          depth={t}
          height={wh}
          rotY={rotY}
          color="#e8e5df"
          openings={sub}
          units={globals.units}
          external={external}
          outerSign={outerSign}
        />,
      );
      // Fill each opening with a framed window / slab door — unless it's
      // flagged `open` (left as a bare hole).
      for (const m of sub) {
        if (m.open) continue;
        const localAlong = m.along + m.width / 2 - subLen / 2;
        const localFrom = m.from + m.height / 2 - wh / 2;
        const dx = Math.cos(rotY) * localAlong;
        const dz = -Math.sin(rotY) * localAlong;
        push(
          openingsLayer,
          <OpeningPane
            key={`${key}-${side}-op-${m.along.toFixed(2)}`}
            cx={c.x + dx}
            cy={baseZ + wh / 2 + localFrom}
            cz={c.z + dz}
            width={m.width}
            height={m.height}
            rotY={rotY}
            kind={m.kind}
            wallDepth={t}
          />,
        );
      }
    }
  }
}

function emitStandaloneWall(
  obj: Obj,
  band: Band,
  globals: Globals,
  plot: Plot,
  key: string,
  openings: Obj[],
  push: PushFn,
  layer: string,
  openingsLayer: string,
  pillars: PillarRect[],
  floorIdx: number,
) {
  const sx = obj.start_x as number, sy = obj.start_y as number;
  const ex = obj.end_x as number, ey = obj.end_y as number;
  const t = (obj.thickness as number | undefined) ?? globals.wallThickness;
  // Standalone walls use the floor's WALL height (independent of
  // floor_height); the wall's own `height` field overrides both.
  const h = (obj.height as number | undefined) ?? band.wallHeight;
  // Optional sloped top: end height (at start_x/y → end_x/y). Defaults to a
  // flat top when absent. The start end (h) anchors the bottom, so cy/opening
  // maths below are unchanged.
  const hEnd = (obj.height_end as number | undefined) ?? h;
  // Unified z_offset from the FLOOR BASE. Omitted → slab thickness, so the
  // wall sits on the slab top (= band.wallZ) as before.
  const baseZ = band.slabZ + ((obj.z_offset as number | undefined) ?? band.slabThickness);
  const dx = ex - sx, dy = ey - sy;
  const wallLen = Math.hypot(dx, dy);
  if (wallLen < 1e-6) return;
  const rotY = Math.atan2(-dy, dx);
  // External if either face is weather-facing; interior partitions stay plain.
  // `outerSign` marks which local-Z face is the weather face for texturing.
  const { external: isExternal, outerSign } = classifyStandaloneWall(globals.roomRects, sx, sy, ex, ey, t, floorIdx);

  const matched: WallOpening[] = [];
  for (const op of openings) {
    const m = matchOpeningToStandaloneWall(op, sx, sy, ex, ey, t);
    if (m) matched.push(m);
  }

  // Trim axis-aligned, flat, positive-direction walls at pillar faces. Sloped
  // (heightEnd ≠ height) or diagonal walls emit unchanged.
  const horiz = Math.abs(dy) < 1e-9 && dx > 0;
  const vert = Math.abs(dx) < 1e-9 && dy > 0;
  if (pillars.length && h === hEnd && (horiz || vert)) {
    const perp = horiz ? sy : sx;
    const aStart = horiz ? sx : sy;
    const aEnd = horiz ? ex : ey;
    for (const [ws, we] of trimSpans(horiz ? "h" : "v", perp, aStart, aEnd, t, pillars)) {
      const subLen = we - ws;
      if (subLen < 1e-6) continue;
      const off = ws - aStart;
      const sub = matched
        .filter((m) => {
          const cen = m.along + m.width / 2;
          return cen >= off - 1e-6 && cen <= off + subLen + 1e-6;
        })
        .map((m) => ({ ...m, along: m.along - off }));
      const cc = toThreePos(horiz ? ws + subLen / 2 : sx, horiz ? sy : ws + subLen / 2, 0, plot.width, plot.length);
      push(
        layer,
        <WallWithOpenings key={`${key}-${ws.toFixed(1)}`} cx={cc.x} cy={baseZ + h / 2} cz={cc.z} length={subLen} depth={t} height={h} rotY={rotY} color="#e8e5df" openings={sub} units={globals.units} external={isExternal} outerSign={outerSign} />,
      );
      for (const m of sub) {
        if (m.open) continue;
        const localAlong = m.along + m.width / 2 - subLen / 2;
        const localFrom = m.from + m.height / 2 - h / 2;
        push(
          openingsLayer,
          <OpeningPane key={`${key}-op-${m.along.toFixed(2)}`} cx={cc.x + Math.cos(rotY) * localAlong} cy={baseZ + h / 2 + localFrom} cz={cc.z - Math.sin(rotY) * localAlong} width={m.width} height={m.height} rotY={rotY} kind={m.kind} wallDepth={t} />,
        );
      }
    }
    return;
  }

  const midX = (sx + ex) / 2, midY = (sy + ey) / 2;
  const c = toThreePos(midX, midY, 0, plot.width, plot.length);
  push(
    layer,
    <WallWithOpenings
      key={key}
      cx={c.x}
      cy={baseZ + h / 2}
      cz={c.z}
      length={wallLen}
      depth={t}
      height={h}
      heightEnd={hEnd}
      rotY={rotY}
      color="#e8e5df"
      openings={matched}
      units={globals.units}
      external={isExternal}
      outerSign={outerSign}
    />,
  );
  for (const m of matched) {
    if (m.open) continue;
    const localAlong = m.along + m.width / 2 - wallLen / 2;
    const localFrom = m.from + m.height / 2 - h / 2;
    const dxL = Math.cos(rotY) * localAlong;
    const dzL = -Math.sin(rotY) * localAlong;
    push(
      "openings",
      <OpeningPane
        key={`${key}-op-${m.along.toFixed(2)}`}
        cx={c.x + dxL}
        cy={baseZ + h / 2 + localFrom}
        cz={c.z + dzL}
        width={m.width}
        height={m.height}
        rotY={rotY}
        kind={m.kind}
        wallDepth={t}
      />,
    );
  }
}
