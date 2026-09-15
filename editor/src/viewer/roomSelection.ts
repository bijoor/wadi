// Room selection from the 2D floor plan (plan A1 of the furniture-catalog plan).
//
// The floor-plan generator, in interactive mode, appends a transparent hit rect
// per room keyed by floor number + room name (`.wadi-room-hit`, viewer-only so the
// parity/combined SVG stays byte-identical). Here we turn a click on one of those
// rects into a store selection, highlight the selected room, and keep the highlight
// in sync across re-renders. The furniture-catalog tool reads the same store
// `selection` to know which room to compose.

import { useConfigStore, type Selection } from "../state/configStore";

// deno-lint-ignore no-explicit-any
type AnyConfig = any;

// Map a plan hit-rect (floor number + room name) to the room object's indices in
// the ORIGINAL (unexpanded) config — which is what the store's Selection uses and
// what updateObject writes back through.
export function roomSelectionByName(floorNum: number, name: string): Selection | null {
  const cfg = useConfigStore.getState().config as AnyConfig;
  const floors = cfg?.floors ?? [];
  for (let fi = 0; fi < floors.length; fi++) {
    const fl = floors[fi];
    if ((fl?.floor_number ?? 0) !== floorNum) continue;
    const objs = fl?.objects ?? [];
    for (let oi = 0; oi < objs.length; oi++) {
      if (objs[oi]?.type === "room" && ((objs[oi]?.name as string | undefined) ?? "Room") === name) {
        return { floor: fi, object: oi };
      }
    }
  }
  return null;
}

// The (floorNumber, name) of the currently selected room, or null when the current
// selection is not a room.
function selectedRoomTag(): { floorNum: number; name: string } | null {
  const st = useConfigStore.getState();
  const sel = st.selection;
  if (!sel) return null;
  const cfg = st.config as AnyConfig;
  const fl = cfg?.floors?.[sel.floor];
  const obj = fl?.objects?.[sel.object];
  if (!obj || obj.type !== "room") return null;
  return { floorNum: (fl?.floor_number as number | undefined) ?? 0, name: (obj.name as string | undefined) ?? "Room" };
}

// Re-apply the `.sel` class to the hit rect matching the current selection. Called
// on selection change and whenever the plan SVG is (re)injected into the DOM.
export function applyRoomHighlight(): void {
  const tag = selectedRoomTag();
  document.querySelectorAll<SVGElement>(".wadi-room-hit").forEach((el) => {
    const match = !!tag &&
      el.getAttribute("data-floor") === String(tag.floorNum) &&
      el.getAttribute("data-room") === tag.name;
    el.classList.toggle("sel", match);
  });
}

let wired = false;

export function wireRoomSelection(): void {
  if (wired) return;
  wired = true;

  // Delegated click: select the clicked room (toggle off if it is already selected).
  document.addEventListener("click", (e) => {
    const target = e.target as Element | null;
    const hit = target?.closest?.(".wadi-room-hit") as SVGElement | null;
    if (!hit) return;
    const floorNum = Number(hit.getAttribute("data-floor") ?? "0");
    const name = hit.getAttribute("data-room") ?? "";
    const sel = roomSelectionByName(floorNum, name);
    if (!sel) return;
    const cur = useConfigStore.getState().selection;
    const same = cur && cur.floor === sel.floor && cur.object === sel.object;
    useConfigStore.getState().select(same ? null : sel);
    applyRoomHighlight();
  });

  // Keep the highlight in sync when the selection changes elsewhere.
  let lastSel = useConfigStore.getState().selection;
  useConfigStore.subscribe((s) => {
    if (s.selection !== lastSel) {
      lastSel = s.selection;
      requestAnimationFrame(applyRoomHighlight);
    }
  });

  // The plan tab re-injects fresh SVG on each render; it calls this to restore the
  // highlight afterwards.
  (window as unknown as { applyRoomHighlight?: () => void }).applyRoomHighlight = applyRoomHighlight;
}
