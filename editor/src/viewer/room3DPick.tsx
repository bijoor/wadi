// Room selection from the 3D model (plan A3). A click on the house raycasts the
// scene, maps the hit point down to a room footprint (so clicking a wall or the roof
// over a room selects that room), and sets the store selection — the same selection
// the 2D plan and the furniture-catalog tool use. The selected room's floor gets a
// translucent highlight.

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Vector2 } from "three";
import { useConfigStore } from "../state/configStore";
import { expandRoomWalls } from "../svg2d/expand";
import { computeFloorZBands, toThreePos, readPlotBounds } from "../three/coords";
import { DEFAULT_GLOBAL_CONFIG } from "../svg2d/config";
import { roomSelectionByName, revealSelectedRoomInWdl } from "./roomSelection";

// deno-lint-ignore no-explicit-any
type Any = any;

interface RoomRect3D {
  floorNum: number;
  name: string;
  x: number; y: number; w: number; l: number;
  z: number; // floor deck top (Three world Z / model up)
}

function buildRooms(config: Any): { rooms: RoomRect3D[]; plotW: number; plotL: number } {
  let hc: Any = config;
  try { hc = expandRoomWalls(config, undefined, { lenient: true }); } catch { /* keep raw */ }
  const plot = readPlotBounds(hc);
  const defs = config?.defaults ?? {};
  const bands = computeFloorZBands(
    hc.floors ?? [],
    defs.slab_thickness ?? DEFAULT_GLOBAL_CONFIG.floor_slab_thickness,
    defs.floor_height ?? DEFAULT_GLOBAL_CONFIG.floor_height,
    defs.wall_height ?? DEFAULT_GLOBAL_CONFIG.wall_height,
  );
  const rooms: RoomRect3D[] = [];
  (hc.floors ?? []).forEach((fl: Any, fi: number) => {
    const band = bands[fi];
    for (const o of fl?.objects ?? []) {
      if (o?.type !== "room") continue;
      const x = +o.x, y = +o.y, w = +o.width, l = +o.length;
      if (![x, y, w, l].every(Number.isFinite)) continue;
      rooms.push({ floorNum: fl.floor_number ?? 0, name: (o.name as string) ?? "Room", x, y, w, l, z: band?.wallZ ?? 0 });
    }
  });
  return { rooms, plotW: plot.width, plotL: plot.length };
}

export function Room3DPick({ config }: { config: Any }) {
  const { camera, gl, scene, raycaster } = useThree();
  const selection = useConfigStore((s) => s.selection);
  const { rooms, plotW, plotL } = useMemo(() => buildRooms(config), [config]);

  useEffect(() => {
    const el = gl.domElement;
    let downX = 0, downY = 0, downT = 0;
    const onDown = (e: PointerEvent) => { downX = e.clientX; downY = e.clientY; downT = Date.now(); };
    const onUp = (e: PointerEvent) => {
      // Ignore orbit drags / long presses — only a quick, still click selects.
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5 || Date.now() - downT > 500) return;
      const rect = el.getBoundingClientRect();
      const ndc = new Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      if (!hits.length) return;
      const p = hits[0].point;
      const mx = p.x + plotW / 2, my = p.z + plotL / 2, py = p.y;
      const cand = rooms.filter((r) => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.l);
      if (!cand.length) return;
      // Prefer the highest floor whose deck sits at/below the click height.
      cand.sort((a, b) => a.z - b.z);
      let pick = cand[0];
      for (const r of cand) if (r.z <= py + 20) pick = r;
      const sel = roomSelectionByName(pick.floorNum, pick.name);
      if (!sel) return;
      const cur = useConfigStore.getState().selection;
      const same = cur && cur.floor === sel.floor && cur.object === sel.object;
      useConfigStore.getState().select(same ? null : sel);
      if (!same) revealSelectedRoomInWdl();
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => { el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerup", onUp); };
  }, [gl, camera, scene, raycaster, rooms, plotW, plotL]);

  // Highlight the selected room's floor.
  const selRoom = useMemo(() => {
    const st = useConfigStore.getState();
    const sel = st.selection;
    if (!sel) return null;
    const cfg = st.config as Any;
    const fl = cfg?.floors?.[sel.floor];
    const o = fl?.objects?.[sel.object];
    if (!o || o.type !== "room") return null;
    const fnum = (fl.floor_number as number | undefined) ?? 0;
    const name = (o.name as string | undefined) ?? "Room";
    return rooms.find((r) => r.floorNum === fnum && r.name === name) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, rooms]);

  if (!selRoom) return null;
  const c = toThreePos(selRoom.x + selRoom.w / 2, selRoom.y + selRoom.l / 2, selRoom.z + 1, plotW, plotL);
  return (
    <mesh position={[c.x, c.y, c.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[selRoom.w, selRoom.l]} />
      <meshBasicMaterial color="#B85028" transparent opacity={0.28} depthWrite={false} />
    </mesh>
  );
}
