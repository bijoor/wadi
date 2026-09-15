// Furniture catalog LEFT tool (plan part B1). For the room selected in the 2D
// floor plan, compose its `furniture` container: browse the catalog, add pieces,
// anchor them to the nine wall/corner points, and Apply the set back to the model.
//
// It reuses wadi's own placement engine — the same `pieceFootprint` / `anchorPoints`
// / `validateLayout` the floor-planner LayoutEditor and the auto-furnisher use — so
// the composed layout matches exactly what auto-placement and 3D render. Editing is
// a DRAFT: changes stay local until Apply writes them, as one undo step.

import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { useConfigStore } from "../state/configStore";
import { FURNITURE_CATALOG, FURNITURE_CATEGORIES, furnitureAsset } from "../furniture/catalog";
import { validateLayout, type Piece } from "../furniture/autoplace";
import { anchorPoints, anchorFacing, gapForCenter } from "../svg2d/furnitureAnchor";
import { DEFAULT_GLOBAL_CONFIG } from "../svg2d/config";
import { furnishRoom } from "../furniture/furnish";
import { loadRoomLayouts } from "../furniture/loadRoomLayouts";
import type { ItemAsset } from "../schema/houseConfig";

// deno-lint-ignore no-explicit-any
type Any = any;

const ANCHORS = [
  "top-left", "top", "top-right",
  "left", "center", "right",
  "bottom-left", "bottom", "bottom-right",
] as const;

// One furniture piece in the draft. `kind:"item"` is a GLB RoomItem (asset); a
// `kind:"counter"` is the parametric kitchen counter (a furniture-capable element,
// RoomCounter) — length/depth/height + optional cabinet/sink/hob fixtures. Both share
// the same anchor + gap + rotation placement.
interface DraftPiece {
  key: string;
  kind: "item" | "counter";
  name: string;
  anchor: string;
  gap_x: number;
  gap_y: number;
  rotation?: number;
  // item
  asset?: ItemAsset;
  // counter
  length?: number;
  depth?: number;
  height?: number;
  cabinet?: boolean;
  sink?: boolean;
  hob?: boolean;
}

let pieceSeq = 0;
const newKey = () => `fp${++pieceSeq}`;

// A synthetic asset so a counter Piece has the shape autoplace expects; its footprint
// override (below) is what actually drives the box, so dimensions are unused.
const COUNTER_ASSET = { id: "counter", name: "Kitchen counter", dimensions: [0, 0, 0] } as unknown as ItemAsset;
const COUNTER_CATALOG = [{ id: "counter", name: "Kitchen counter", category: "Kitchen" }];

// The room the current store selection points at, with its resolved geometry.
interface SelectedRoom {
  floor: number;
  object: number;
  floorNum: number;
  name: string;
  w: number;
  l: number;
  wallT: number;
  units: { system?: string; per_unit?: number } | undefined;
  room: Any;
}

function readSelectedRoom(state: Any): SelectedRoom | null {
  const sel = state.selection;
  const cfg = state.config;
  if (!sel || !cfg) return null;
  const floor = cfg.floors?.[sel.floor];
  const room = floor?.objects?.[sel.object];
  if (!room || room.type !== "room") return null;
  const w = Number(room.width), l = Number(room.length);
  if (!isFinite(w) || !isFinite(l) || w <= 0 || l <= 0) return null;
  const wallT = Number(
    room.wall_thickness ?? cfg.defaults?.wall_thickness ?? DEFAULT_GLOBAL_CONFIG.wall_thickness,
  );
  return {
    floor: sel.floor, object: sel.object,
    floorNum: (floor.floor_number as number | undefined) ?? sel.floor + 1,
    name: (room.name as string) ?? "Room",
    w, l, wallT: isFinite(wallT) ? wallT : DEFAULT_GLOBAL_CONFIG.wall_thickness,
    units: cfg.units, room,
  };
}

// Seed the draft from ALL of a room's existing furniture — both the `furniture`
// container and any hand-authored direct `items` — so composing then Apply (which
// moves everything into the container and clears direct items) never drops or
// duplicates a piece.
function seedDraft(room: Any): DraftPiece[] {
  const items: Any[] = [...(room?.furniture?.items ?? []), ...(room?.items ?? [])];
  const counters: Any[] = [...(room?.furniture?.counters ?? []), ...(room?.counters ?? [])];
  const itemPieces: DraftPiece[] = items
    .filter((it) => it && it.asset && Array.isArray(it.asset.dimensions))
    .map((it) => ({
      key: newKey(), kind: "item", name: (it.asset.name as string) ?? "Item",
      asset: it.asset as ItemAsset,
      anchor: (it.anchor as string) ?? "center",
      gap_x: Number(it.gap_x) || 0,
      gap_y: Number(it.gap_y) || 0,
      rotation: typeof it.rotation === "number" ? it.rotation : undefined,
    }));
  const counterPieces: DraftPiece[] = counters
    .filter((c) => c && (c.depth != null))
    .map((c) => ({
      key: newKey(), kind: "counter", name: (c.name as string) ?? "Kitchen counter",
      anchor: (c.anchor as string) ?? "top-left",
      gap_x: Number(c.gap_x) || 0,
      gap_y: Number(c.gap_y) || 0,
      rotation: typeof c.rotation === "number" ? c.rotation : undefined,
      length: typeof c.length === "number" ? c.length : undefined,
      depth: Number(c.depth), height: Number(c.height) || 36,
      cabinet: !!c.cabinet, sink: !!c.sink, hob: !!c.hob,
    }));
  return [...itemPieces, ...counterPieces];
}

// Serialize the draft back into a room `furniture` container's items + counters.
function draftToContainer(draft: DraftPiece[]): { items: Any[]; counters: Any[] } {
  const items = draft.filter((d) => d.kind === "item").map((d) => ({
    asset: d.asset, anchor: d.anchor,
    ...(d.gap_x ? { gap_x: d.gap_x } : {}), ...(d.gap_y ? { gap_y: d.gap_y } : {}),
    ...(typeof d.rotation === "number" ? { rotation: d.rotation } : {}),
  }));
  const counters = draft.filter((d) => d.kind === "counter").map((d) => ({
    ...(d.name ? { name: d.name } : {}), anchor: d.anchor,
    ...(d.gap_x ? { gap_x: d.gap_x } : {}), ...(d.gap_y ? { gap_y: d.gap_y } : {}),
    ...(typeof d.rotation === "number" ? { rotation: d.rotation } : {}),
    ...(typeof d.length === "number" ? { length: d.length } : {}),
    depth: d.depth, height: d.height,
    ...(d.cabinet ? { cabinet: true } : {}), ...(d.sink ? { sink: true } : {}), ...(d.hob ? { hob: true } : {}),
  }));
  return { items, counters };
}

// Best-guess furnish type for a room: its explicit room_type / auto_type, else
// inferred from the room name (Bedroom → bedroom, Verandah → balcony, …).
const NAME_TYPE_ALIASES: Record<string, string[]> = {
  bedroom: ["bed"], bath: ["bath", "toilet", "wc", "washroom"], kitchen: ["kitchen", "cook"],
  living: ["living", "hall", "lounge", "family"], dining: ["dining", "diner"],
  study: ["study", "office", "work"], terrace: ["terrace", "deck"],
  balcony: ["balcony", "verandah", "veranda", "porch", "sit"],
};
function guessRoomType(room: Any, roomTypes: string[]): string {
  const explicit = (room?.furniture?.auto_type as string | undefined) ?? (room?.room_type as string | undefined);
  if (explicit) return explicit;
  const name = String(room?.name ?? "").toLowerCase();
  const direct = roomTypes.find((t) => name.includes(t));
  if (direct) return direct;
  for (const [t, keys] of Object.entries(NAME_TYPE_ALIASES)) {
    if (roomTypes.includes(t) && keys.some((k) => name.includes(k))) return t;
  }
  return roomTypes[0] ?? "";
}

// The clear span of the wall a counter anchor sits on (its auto length fallback).
function wallSpanFor(anchor: string, rect: { w: number; l: number }, wallT: number): number {
  const innerW = rect.w - 2 * wallT, innerL = rect.l - 2 * wallT;
  if (anchor.includes("top") || anchor.includes("bottom")) return innerW;
  if (anchor.includes("left") || anchor.includes("right")) return innerL;
  return innerW;
}

function draftToPieces(draft: DraftPiece[], rect: { w: number; l: number }, wallT: number): Piece[] {
  return draft.map((d) => {
    if (d.kind === "counter") {
      const w = typeof d.length === "number" ? d.length : wallSpanFor(d.anchor, rect, wallT);
      return {
        name: d.name, asset: COUNTER_ASSET as Any, anchor: d.anchor,
        gap_x: d.gap_x, gap_y: d.gap_y, rotation: d.rotation,
        footprint: { w, l: d.depth ?? 22 }, placement: "wall",
      };
    }
    return {
      name: d.asset?.name ?? d.name, asset: d.asset as Any,
      anchor: d.anchor, gap_x: d.gap_x, gap_y: d.gap_y, rotation: d.rotation,
    };
  });
}

function FurnitureCatalogPanel() {
  // Re-render on any store change; we read selection + config imperatively so the
  // seed effect can compare identities.
  const tick = useConfigStore((s) => s.config);
  const selection = useConfigStore((s) => s.selection);
  const sel = useMemo(() => readSelectedRoom(useConfigStore.getState()), [tick, selection]);

  const [draft, setDraft] = useState<DraftPiece[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [category, setCategory] = useState<string>(FURNITURE_CATEGORIES[0] ?? "");
  // Auto-furnish: whether THIS room is engine-managed (auto + unlocked). Manual is the
  // default; a hand-composed set stays locked until the user switches it to Auto here.
  const [auto, setAuto] = useState(false);
  const [autoType, setAutoType] = useState<string>("");
  const [roomTypes, setRoomTypes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Active drag: the piece being dragged + its anchor and half-extents + the pointer
  // and footprint-centre origin, so pointermove can map pixels → a new centre → gaps.
  const dragRef = useRef<
    { key: string; anchor: string; halfX: number; halfY: number; px: number; py: number; cx: number; cy: number } | null
  >(null);
  const roomKey = sel ? `${sel.floor}:${sel.object}` : null;

  // Load the available room-layout types once (for the Auto "furnish as" picker).
  useEffect(() => {
    let live = true;
    loadRoomLayouts().then((layouts) => {
      if (!live) return;
      const types = [...new Set(layouts.map((l) => String((l as Any).type)).filter(Boolean))].sort();
      setRoomTypes(types);
    }).catch(() => { /* no layouts — Auto picker stays empty */ });
    return () => { live = false; };
  }, []);

  // Re-seed the draft + Auto state whenever the selected room changes (not on every edit).
  useEffect(() => {
    if (sel) {
      const fb = sel.room.furniture ?? {};
      setDraft(seedDraft(sel.room));
      setSelectedKey(null);
      setDirty(false);
      setAuto(!!fb.auto && !fb.locked);
      setAutoType(String(fb.auto_type ?? sel.room.room_type ?? ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey]);

  // Once layouts load, fill a still-empty Auto type by inferring from the room name.
  useEffect(() => {
    if (auto && !autoType && roomTypes.length && sel) setAutoType(guessRoomType(sel.room, roomTypes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, autoType, roomTypes]);

  if (!sel) {
    return (
      <div className="fc-empty">
        <h4 className="lt-h">Furniture catalog</h4>
        <p className="fc-hint">Select a room in the <b>Floor Plans</b> view to compose its furniture.</p>
      </div>
    );
  }

  const rect = { x: 0, y: 0, w: sel.w, l: sel.l };
  // In Auto mode the container is engine-managed, so render its LIVE items (read-only);
  // in Manual mode render the editable draft.
  const activeDraft = auto ? seedDraft(sel.room) : draft;
  const pieces = draftToPieces(activeDraft, rect, sel.wallT);
  const validation = validateLayout(pieces, rect, sel.wallT, sel.units);
  const anchors = anchorPoints(rect, sel.wallT);
  const issues = validation.overlaps.length + validation.oob.length;

  const update = (key: string, patch: Partial<DraftPiece>) => {
    setDraft((d) => d.map((p) => (p.key === key ? { ...p, ...patch } : p)));
    setDirty(true);
  };
  const addAsset = (id: string) => {
    const asset = furnitureAsset(id);
    const key = newKey();
    setDraft((d) => [...d, { key, kind: "item", name: asset.name ?? "Item", asset, anchor: "center", gap_x: 0, gap_y: 0 }]);
    setSelectedKey(key);
    setDirty(true);
  };
  const addCounter = () => {
    const key = newKey();
    // Default: a full-wall counter on the top wall (auto length), 22-deep, with a cabinet.
    setDraft((d) => [...d, {
      key, kind: "counter", name: "Kitchen counter",
      anchor: "top-left", gap_x: 0, gap_y: 0,
      length: undefined, depth: 22, height: 36, cabinet: true,
    }]);
    setSelectedKey(key);
    setDirty(true);
  };
  const removePiece = (key: string) => {
    setDraft((d) => d.filter((p) => p.key !== key));
    if (selectedKey === key) setSelectedKey(null);
    setDirty(true);
  };
  const setAnchor = (key: string, anchor: string) => {
    // Move to the new anchor with zero gap, and re-face unless a custom rotation
    // was set (matches the LayoutEditor's SET_ANCHOR behaviour).
    update(key, { anchor, gap_x: 0, gap_y: 0 });
  };

  // Project units per screen pixel (the SVG box scales the viewBox to the panel).
  const unitsPerPx = (): number => {
    const svg = svgRef.current;
    if (!svg) return 1;
    const r = svg.getBoundingClientRect();
    return r.width > 0 ? (sel.w + 2 * pad) / r.width : 1;
  };
  // Drag a piece: map the pointer delta to a new footprint centre, then back to
  // gaps via gapForCenter (the exact inverse of the anchor placement math).
  const onPieceDown = (e: React.PointerEvent, d: DraftPiece, r: { cx: number; cy: number; halfX: number; halfY: number }) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setSelectedKey(d.key);
    dragRef.current = { key: d.key, anchor: d.anchor, halfX: r.halfX, halfY: r.halfY, px: e.clientX, py: e.clientY, cx: r.cx, cy: r.cy };
  };
  const onPieceMove = (e: React.PointerEvent) => {
    const dg = dragRef.current;
    if (!dg) return;
    const k = unitsPerPx();
    const cx = dg.cx + (e.clientX - dg.px) * k;
    const cy = dg.cy + (e.clientY - dg.py) * k;
    const g = gapForCenter(dg.anchor, cx, cy, dg.halfX, dg.halfY, rect, sel.wallT);
    update(dg.key, { gap_x: Math.round(g.gap_x), gap_y: Math.round(g.gap_y) });
  };
  const onPieceUp = () => { dragRef.current = null; };

  const apply = () => {
    const { items, counters } = draftToContainer(draft);
    const prev = sel.room.furniture ?? {};
    // Hand-composed: mark not-auto and lock so the auto-furnisher leaves it alone.
    // Clear the room's DIRECT items + counters (the draft already absorbed them via
    // seedDraft) so nothing double-renders.
    const furniture: Any = { ...prev, auto: false, locked: true, items, counters };
    useConfigStore.getState().updateObject(
      { floor: sel.floor, object: sel.object },
      { furniture, items: [], counters: [] },
    );
    setDirty(false);
  };
  const reset = () => { setDraft(seedDraft(sel.room)); setSelectedKey(null); setDirty(false); };

  // Furnish JUST this room from the current config (the one-room version of the
  // configurator's furnishNow), writing its container back.
  const furnishThisRoom = async (): Promise<void> => {
    const layouts = await loadRoomLayouts();
    const cur = useConfigStore.getState().config as Any;
    if (!cur) return;
    const { config: next, result } = furnishRoom(cur, sel.floorNum, sel.name, layouts as Any);
    if (result.furnished) {
      const nextRoom = (next as Any).floors[sel.floor].objects[sel.object];
      useConfigStore.getState().updateObject({ floor: sel.floor, object: sel.object }, { furniture: nextRoom.furniture });
    }
  };
  // Switch the room to engine-managed (auto + unlocked) with an explicit type source,
  // and furnish it now — unless the config auto-furnish already populated it.
  const enableAuto = async (): Promise<void> => {
    const type = autoType || guessRoomType(sel.room, roomTypes);
    const prev = sel.room.furniture ?? {};
    const alreadyAuto = !!(prev.auto && Array.isArray(prev.items) && prev.items.length);
    useConfigStore.getState().updateObject(
      { floor: sel.floor, object: sel.object },
      { furniture: { ...prev, auto: true, locked: false, auto_type: type }, items: [] },
    );
    setAuto(true); setAutoType(type);
    if (!alreadyAuto) { setBusy(true); try { await furnishThisRoom(); } finally { setBusy(false); } }
  };
  // Switch back to a locked, hand-composed set (freezing whatever is there now).
  const disableAuto = (): void => {
    const { items, counters } = draftToContainer(seedDraft(sel.room));
    const prev = sel.room.furniture ?? {};
    useConfigStore.getState().updateObject(
      { floor: sel.floor, object: sel.object },
      { furniture: { ...prev, auto: false, locked: true, items, counters }, items: [], counters: [] },
    );
    setAuto(false);
    setDraft(seedDraft(sel.room));
  };
  const changeAutoType = async (type: string): Promise<void> => {
    setAutoType(type);
    const prev = sel.room.furniture ?? {};
    useConfigStore.getState().updateObject(
      { floor: sel.floor, object: sel.object },
      { furniture: { ...prev, auto: true, locked: false, auto_type: type } },
    );
    setBusy(true); try { await furnishThisRoom(); } finally { setBusy(false); }
  };

  // Canvas scale: draw in project units, let the SVG box scale to the panel width.
  const pad = Math.max(sel.w, sel.l) * 0.04;
  const vb = `${-pad} ${-pad} ${sel.w + 2 * pad} ${sel.l + 2 * pad}`;
  const dot = Math.max(sel.w, sel.l) * 0.018;

  // Gap is stored in project units; show it in the model's length unit (feet /
  // metres) so the number reads naturally. per_unit = units per foot (or per metre).
  const perUnit = Number(sel.units?.per_unit) || 10;
  const metric = sel.units?.system === "metric" || sel.units?.system === "meters";
  const gapUnitLabel = metric ? "m" : "ft";
  const gapStep = metric ? 0.1 : 0.5;
  const toGapDisplay = (u: number) => +(u / perUnit).toFixed(2);
  const fromGapDisplay = (s: string) => Math.round((Number(s) || 0) * perUnit);

  return (
    <div className="fc-root">
      <h4 className="lt-h">Furniture · {sel.name}</h4>

      {/* Mode: Manual (hand-composed, locked) vs Auto (engine-managed by type). */}
      <div className="fc-mode">
        <button className={`fc-mode-btn${!auto ? " on" : ""}`} onClick={() => { if (auto) disableAuto(); }}>Manual</button>
        <button className={`fc-mode-btn${auto ? " on" : ""}`} onClick={() => { if (!auto) void enableAuto(); }}>Auto</button>
      </div>

      {/* Room composition canvas (interactive in Manual, read-only preview in Auto). */}
      <svg ref={svgRef} className="fc-canvas" viewBox={vb} preserveAspectRatio="xMidYMid meet">
        <rect x={0} y={0} width={sel.w} height={sel.l} className="fc-room" vectorEffect="non-scaling-stroke" />
        <rect x={sel.wallT} y={sel.wallT} width={sel.w - 2 * sel.wallT} height={sel.l - 2 * sel.wallT}
          className="fc-inner" vectorEffect="non-scaling-stroke" />
        {/* Anchor snap points — click to move the selected piece there (Manual only) */}
        {!auto && ANCHORS.map((a) => {
          const p = anchors[a];
          if (!p) return null;
          return (
            <circle key={a} cx={p.x} cy={p.y} r={dot} className="fc-anchor"
              onClick={() => { if (selectedKey) setAnchor(selectedKey, a); }}>
              <title>{a}</title>
            </circle>
          );
        })}
        {/* Piece footprints */}
        {activeDraft.map((d, i) => {
          const r = validation.rects[i];
          if (!r) return null;
          const bad = validation.flags[i]?.overlap || (validation.flags[i]?.oob?.length ?? 0) > 0;
          const rot = typeof d.rotation === "number" ? d.rotation : anchorFacing(d.anchor);
          const cx = r.cx, cy = r.cy;
          // facing tick: (sin, cos) points the "front" like the LayoutEditor
          const fx = cx + Math.sin((rot * Math.PI) / 180) * (r.halfY || dot * 2);
          const fy = cy + Math.cos((rot * Math.PI) / 180) * (r.halfY || dot * 2);
          const on = !auto && d.key === selectedKey;
          return (
            <g key={d.key} className="fc-piece-g">
              <rect x={r.x0} y={r.y0} width={r.x1 - r.x0} height={r.y1 - r.y0}
                className={`fc-piece${bad ? " bad" : ""}${on ? " sel" : ""}`} vectorEffect="non-scaling-stroke"
                {...(auto ? {} : { onPointerDown: (e: React.PointerEvent) => onPieceDown(e, d, r), onPointerMove: onPieceMove, onPointerUp: onPieceUp })} />
              <line x1={cx} y1={cy} x2={fx} y2={fy} className="fc-facing" vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: "none" }} />
            </g>
          );
        })}
      </svg>
      <div className={`fc-status${issues ? " bad" : ""}`}>
        {issues ? `${issues} issue${issues > 1 ? "s" : ""} (overlap / out of bounds)` : "All clear"}
        {!auto && dirty ? " · unsaved" : ""}
      </div>

      {/* Auto mode: pick the furnish type + re-furnish; the room re-flows on resize. */}
      {auto && (
        <div className="fc-auto">
          <div className="fc-lbl">Furnish as</div>
          <div className="fc-auto-row">
            <select value={autoType} onChange={(e) => void changeAutoType(e.target.value)} disabled={busy}>
              {roomTypes.length === 0 && <option value="">(no templates)</option>}
              {roomTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button className="fc-refurnish" disabled={busy} onClick={() => void furnishThisRoom()}>
              {busy ? "Furnishing…" : "Re-furnish"}
            </button>
          </div>
          <p className="fc-hint">This room is furnished automatically by type and re-flows when its size changes. Switch to <b>Manual</b> to place furniture by hand.</p>
        </div>
      )}

      {/* Selected-piece controls (Manual only) */}
      {!auto && selectedKey && (() => {
        const d = draft.find((p) => p.key === selectedKey);
        if (!d) return null;
        const rot = typeof d.rotation === "number" ? d.rotation : anchorFacing(d.anchor);
        return (
          <div className="fc-controls">
            <div className="fc-row-head">
              <span className="fc-piece-name">{d.name}</span>
              <button className="fc-x" onClick={() => removePiece(d.key)} title="Remove">✕</button>
            </div>
            <div className="fc-lbl">Anchor</div>
            <div className="fc-anchor-grid">
              {ANCHORS.map((a) => (
                <button key={a} className={`fc-ab${d.anchor === a ? " on" : ""}`}
                  onClick={() => setAnchor(d.key, a)} title={a} />
              ))}
            </div>
            <div className="fc-lbl">Gap from anchor ({gapUnitLabel})</div>
            <div className="fc-gap">
              <label>X<input type="number" value={toGapDisplay(d.gap_x)} step={gapStep}
                onChange={(e) => update(d.key, { gap_x: fromGapDisplay(e.target.value) })} /></label>
              <label>Y<input type="number" value={toGapDisplay(d.gap_y)} step={gapStep}
                onChange={(e) => update(d.key, { gap_y: fromGapDisplay(e.target.value) })} /></label>
              <button className="fc-gap-zero" title="Reset gap to the anchor"
                onClick={() => update(d.key, { gap_x: 0, gap_y: 0 })}>reset</button>
            </div>
            <div className="fc-lbl">Rotation</div>
            <div className="fc-rot">
              {[0, 90, 180, 270].map((r) => (
                <button key={r} className={`fc-rb${rot === r ? " on" : ""}`}
                  onClick={() => update(d.key, { rotation: r })}>{r}°</button>
              ))}
              <button className="fc-rb" onClick={() => update(d.key, { rotation: undefined })} title="Face by anchor">auto</button>
            </div>
            {d.kind === "counter" && (
              <>
                <div className="fc-lbl">Counter ({gapUnitLabel})</div>
                <div className="fc-gap">
                  <label>Len<input type="number" step={gapStep}
                    placeholder="auto"
                    value={typeof d.length === "number" ? toGapDisplay(d.length) : ""}
                    onChange={(e) => update(d.key, { length: e.target.value === "" ? undefined : fromGapDisplay(e.target.value) })} /></label>
                  <label>Dep<input type="number" step={gapStep}
                    value={toGapDisplay(d.depth ?? 22)}
                    onChange={(e) => update(d.key, { depth: fromGapDisplay(e.target.value) })} /></label>
                  <label>Ht<input type="number" step={gapStep}
                    value={toGapDisplay(d.height ?? 36)}
                    onChange={(e) => update(d.key, { height: fromGapDisplay(e.target.value) })} /></label>
                </div>
                <div className="fc-fixtures">
                  {(["cabinet", "sink", "hob"] as const).map((f) => (
                    <label key={f}><input type="checkbox" checked={!!d[f]}
                      onChange={(e) => update(d.key, { [f]: e.target.checked })} /> {f}</label>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Catalog browser + Apply (Manual only) */}
      {!auto && <>
        <div className="fc-cat-head">Add furniture</div>
        <div className="fc-cats">
          {FURNITURE_CATEGORIES.map((c) => (
            <button key={c} className={`fc-cat${category === c ? " on" : ""}`} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
        <div className="fc-catalog">
          {/* Parametric elements (kitchen counter) — placed as counters, not GLB items. */}
          {COUNTER_CATALOG.filter((c) => c.category === category).map((c) => (
            <button key={c.id} className="fc-item fc-item-el" onClick={addCounter} title={`Add ${c.name}`}>
              <span className="fc-item-name">{c.name}</span>
              <span className="fc-item-dim">parametric</span>
            </button>
          ))}
          {FURNITURE_CATALOG.filter((f) => f.category === category).map((f) => (
            <button key={f.id} className="fc-item" onClick={() => addAsset(f.id)} title={`Add ${f.name}`}>
              <span className="fc-item-name">{f.name}</span>
              <span className="fc-item-dim">{f.dimensions[0]}×{f.dimensions[2]}m</span>
            </button>
          ))}
        </div>
        <div className="fc-actions">
          <button className="fc-apply" disabled={!dirty || issues > 0} onClick={apply}>
            Apply to model
          </button>
          <button className="fc-reset" disabled={!dirty} onClick={reset}>Reset</button>
        </div>
        {issues > 0 && <div className="fc-warn">Resolve the {issues} issue{issues > 1 ? "s" : ""} before applying.</div>}
      </>}
    </div>
  );
}

export function furnitureToolAvailable(): boolean {
  const st = useConfigStore.getState();
  return !!readSelectedRoom(st);
}

let mounted = false;
export function mountFurnitureCatalog(container: HTMLElement): void {
  if (mounted) return;
  mounted = true;
  createRoot(container).render(<FurnitureCatalogPanel />);
}
