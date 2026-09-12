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
import { pillarRects, type PillarRect } from "../svg2d/wallTrim";
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
import { ComposedWalls, composedFloorInputs } from "./ComposedWalls";
import { OpeningPane } from "./openings";
import { defaultLayerFor, effectiveLayers, useLayerStore } from "./layers";
import { setExpansionWarnings, setRoofWarnings } from "./geometryWarnings";
import { computeMergedV2Spec } from "./v2RoofFromHouse";
import { useLayerDefaultsStore } from "../state/layerDefaults";

interface Obj {
  type: string;
  [k: string]: unknown;
}


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
      // Pillar footprints that pass through this floor — walls trim to their
      // faces (no overlap). Include full-height columns declared on lower floors
      // whose vertical extent reaches this floor's slot, not just this floor's
      // own pillars.
      const floorLo = band.slabZ;
      const floorHi = band.slabZ + band.floorHeight;
      const pillars = allPillars
        .filter((p) => Math.min(p.z1, floorHi) - Math.max(p.z0, floorLo) > 1e-6)
        .map((p) => p.rect);

      // Composed wall solid for this floor (plans/wall-composition.md): ONE wall
      // solid per floor from the composed footprint — the only wall path.
      {
        const ci = composedFloorInputs(objects, globals.wallThickness, band.wallHeight);
        const wallBaseZ = band.slabZ + band.slabThickness;
        if (ci.walls.length) {
          push(
            roomLayer,
            <ComposedWalls
              key={`f${fi}-composed`}
              walls={ci.walls}
              rooms={ci.rooms}
              openings={ci.openings}
              baseZ={wallBaseZ}
              wallHeight={band.wallHeight}
              plotWidth={plot.width}
              plotLength={plot.length}
              units={globals.units}
            />,
          );
          // Door leaves + window panes for the cut openings. Bare holes (gaps, and
          // doors flagged `open`) get no pane — just the cut opening.
          ci.openings.forEach((op, oi) => {
            if (op.kind === "gap" || op.open) return;
            const c = toThreePos(op.cx, op.cy, 0, plot.width, plot.length);
            const rotY = op.axis === "x" ? 0 : -Math.PI / 2;
            push(
              openingsLayer,
              <OpeningPane
                key={`f${fi}-cop-${oi}`}
                cx={c.x}
                cy={wallBaseZ + op.sill + op.height / 2}
                cz={c.z}
                width={op.span}
                height={op.height}
                rotY={rotY}
                kind={op.kind}
                wallDepth={op.thickness}
              />,
            );
          });
        }
      }

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
        // Stale-mesh leak: R3F can leave old meshes parented in a SURVIVING
        // group when its keyed children are swapped (a room resized/moved, a
        // door added/removed). The stale meshes linger — door/window panes
        // stranded on the ground where a wall used to be, and old wall segments
        // that overlap the live ones so a wall reads as "one-faced"/z-fighting.
        // This showed up when the WebMCP tools drive incremental edits. Wrapping
        // each layer's child set in an inner group re-KEYED by its signature
        // forces a clean unmount+remount whenever the set changes, so the stale
        // meshes are disposed. Applied to EVERY layer (was openings-only): the
        // wall/structure layers leak the same way. A layer only remounts when
        // ITS children actually change (childSig), so an edit on one floor
        // doesn't churn the roof or other floors.
        const content = <group key={childSig(kids)}>{kids}</group>;
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
}

