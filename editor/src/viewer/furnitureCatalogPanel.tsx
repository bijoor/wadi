// Furniture catalog LEFT tool (plan part B1). For the room selected in the 2D
// floor plan, compose its `furniture` container: browse the catalog, add pieces,
// anchor them to the nine wall/corner points, and Apply the set back to the model.
//
// It reuses wadi's own placement engine — the same `pieceFootprint` / `anchorPoints`
// / `validateLayout` the floor-planner LayoutEditor and the auto-furnisher use — so
// the composed layout matches exactly what auto-placement and 3D render. Editing is
// a DRAFT: changes stay local until Apply writes them, as one undo step.

import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { useConfigStore } from "../state/configStore";
import { FURNITURE_CATALOG, FURNITURE_CATEGORIES, furnitureAsset } from "../furniture/catalog";
import { validateLayout, type Piece } from "../furniture/autoplace";
import { anchorPoints, anchorFacing } from "../svg2d/furnitureAnchor";
import { DEFAULT_GLOBAL_CONFIG } from "../svg2d/config";
import type { ItemAsset } from "../schema/houseConfig";

// deno-lint-ignore no-explicit-any
type Any = any;

const ANCHORS = [
  "top-left", "top", "top-right",
  "left", "center", "right",
  "bottom-left", "bottom", "bottom-right",
] as const;

// One furniture piece in the draft. Mirrors a RoomItem (asset + anchor + gaps +
// rotation) plus a stable React key.
interface DraftPiece {
  key: string;
  asset: ItemAsset;
  anchor: string;
  gap_x: number;
  gap_y: number;
  rotation?: number;
}

let pieceSeq = 0;
const newKey = () => `fp${++pieceSeq}`;

// The room the current store selection points at, with its resolved geometry.
interface SelectedRoom {
  floor: number;
  object: number;
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
  const room = cfg.floors?.[sel.floor]?.objects?.[sel.object];
  if (!room || room.type !== "room") return null;
  const w = Number(room.width), l = Number(room.length);
  if (!isFinite(w) || !isFinite(l) || w <= 0 || l <= 0) return null;
  const wallT = Number(
    room.wall_thickness ?? cfg.defaults?.wall_thickness ?? DEFAULT_GLOBAL_CONFIG.wall_thickness,
  );
  return {
    floor: sel.floor, object: sel.object,
    name: (room.name as string) ?? "Room",
    w, l, wallT: isFinite(wallT) ? wallT : DEFAULT_GLOBAL_CONFIG.wall_thickness,
    units: cfg.units, room,
  };
}

// Seed the draft from a room's existing furniture (the `furniture` container first,
// then any hand-authored `items`).
function seedDraft(room: Any): DraftPiece[] {
  const items: Any[] = room?.furniture?.items ?? room?.items ?? [];
  return items
    .filter((it) => it && it.asset && Array.isArray(it.asset.dimensions))
    .map((it) => ({
      key: newKey(),
      asset: it.asset as ItemAsset,
      anchor: (it.anchor as string) ?? "center",
      gap_x: Number(it.gap_x) || 0,
      gap_y: Number(it.gap_y) || 0,
      rotation: typeof it.rotation === "number" ? it.rotation : undefined,
    }));
}

function draftToPieces(draft: DraftPiece[]): Piece[] {
  return draft.map((d) => ({
    name: d.asset.name,
    asset: d.asset as Any,
    anchor: d.anchor,
    gap_x: d.gap_x,
    gap_y: d.gap_y,
    rotation: d.rotation,
  }));
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
  const roomKey = sel ? `${sel.floor}:${sel.object}` : null;

  // Re-seed the draft whenever the selected room changes (not on every edit).
  useEffect(() => {
    if (sel) {
      setDraft(seedDraft(sel.room));
      setSelectedKey(null);
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey]);

  if (!sel) {
    return (
      <div className="fc-empty">
        <h4 className="lt-h">Furniture catalog</h4>
        <p className="fc-hint">Select a room in the <b>Floor Plans</b> view to compose its furniture.</p>
      </div>
    );
  }

  const rect = { x: 0, y: 0, w: sel.w, l: sel.l };
  const pieces = draftToPieces(draft);
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
    setDraft((d) => [...d, { key, asset, anchor: "center", gap_x: 0, gap_y: 0 }]);
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

  const apply = () => {
    const items = draft.map((d) => ({
      asset: d.asset,
      anchor: d.anchor,
      ...(d.gap_x ? { gap_x: d.gap_x } : {}),
      ...(d.gap_y ? { gap_y: d.gap_y } : {}),
      ...(typeof d.rotation === "number" ? { rotation: d.rotation } : {}),
    }));
    const prev = sel.room.furniture ?? {};
    // Hand-composed: mark not-auto and lock so the auto-furnisher leaves it alone.
    // Preserve any counters already in the container.
    const furniture: Any = { ...prev, auto: false, locked: true, items };
    useConfigStore.getState().updateObject({ floor: sel.floor, object: sel.object }, { furniture });
    setDirty(false);
  };
  const reset = () => { setDraft(seedDraft(sel.room)); setSelectedKey(null); setDirty(false); };

  // Canvas scale: draw in project units, let the SVG box scale to the panel width.
  const pad = Math.max(sel.w, sel.l) * 0.04;
  const vb = `${-pad} ${-pad} ${sel.w + 2 * pad} ${sel.l + 2 * pad}`;
  const dot = Math.max(sel.w, sel.l) * 0.018;

  return (
    <div className="fc-root">
      <h4 className="lt-h">Furniture · {sel.name}</h4>

      {/* Room composition canvas */}
      <svg className="fc-canvas" viewBox={vb} preserveAspectRatio="xMidYMid meet">
        <rect x={0} y={0} width={sel.w} height={sel.l} className="fc-room" vectorEffect="non-scaling-stroke" />
        <rect x={sel.wallT} y={sel.wallT} width={sel.w - 2 * sel.wallT} height={sel.l - 2 * sel.wallT}
          className="fc-inner" vectorEffect="non-scaling-stroke" />
        {/* Anchor snap points — click to move the selected piece there */}
        {ANCHORS.map((a) => {
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
        {draft.map((d, i) => {
          const r = validation.rects[i];
          if (!r) return null;
          const bad = validation.flags[i]?.overlap || (validation.flags[i]?.oob?.length ?? 0) > 0;
          const rot = typeof d.rotation === "number" ? d.rotation : anchorFacing(d.anchor);
          const cx = r.cx, cy = r.cy;
          // facing tick: (sin, cos) points the "front" like the LayoutEditor
          const fx = cx + Math.sin((rot * Math.PI) / 180) * (r.halfY || dot * 2);
          const fy = cy + Math.cos((rot * Math.PI) / 180) * (r.halfY || dot * 2);
          const on = d.key === selectedKey;
          return (
            <g key={d.key} onClick={() => setSelectedKey(d.key)} className="fc-piece-g">
              <rect x={r.x0} y={r.y0} width={r.x1 - r.x0} height={r.y1 - r.y0}
                className={`fc-piece${bad ? " bad" : ""}${on ? " sel" : ""}`} vectorEffect="non-scaling-stroke" />
              <line x1={cx} y1={cy} x2={fx} y2={fy} className="fc-facing" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
      </svg>
      <div className={`fc-status${issues ? " bad" : ""}`}>
        {issues ? `${issues} issue${issues > 1 ? "s" : ""} (overlap / out of bounds)` : "All clear"}
        {dirty ? " · unsaved" : ""}
      </div>

      {/* Selected-piece controls */}
      {selectedKey && (() => {
        const d = draft.find((p) => p.key === selectedKey);
        if (!d) return null;
        const rot = typeof d.rotation === "number" ? d.rotation : anchorFacing(d.anchor);
        return (
          <div className="fc-controls">
            <div className="fc-row-head">
              <span className="fc-piece-name">{d.asset.name}</span>
              <button className="fc-x" onClick={() => removePiece(d.key)} title="Remove">✕</button>
            </div>
            <div className="fc-lbl">Anchor</div>
            <div className="fc-anchor-grid">
              {ANCHORS.map((a) => (
                <button key={a} className={`fc-ab${d.anchor === a ? " on" : ""}`}
                  onClick={() => setAnchor(d.key, a)} title={a} />
              ))}
            </div>
            <div className="fc-lbl">Rotation</div>
            <div className="fc-rot">
              {[0, 90, 180, 270].map((r) => (
                <button key={r} className={`fc-rb${rot === r ? " on" : ""}`}
                  onClick={() => update(d.key, { rotation: r })}>{r}°</button>
              ))}
              <button className="fc-rb" onClick={() => update(d.key, { rotation: undefined })} title="Face by anchor">auto</button>
            </div>
          </div>
        );
      })()}

      {/* Catalog browser */}
      <div className="fc-cat-head">Add furniture</div>
      <div className="fc-cats">
        {FURNITURE_CATEGORIES.map((c) => (
          <button key={c} className={`fc-cat${category === c ? " on" : ""}`} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>
      <div className="fc-catalog">
        {FURNITURE_CATALOG.filter((f) => f.category === category).map((f) => (
          <button key={f.id} className="fc-item" onClick={() => addAsset(f.id)} title={`Add ${f.name}`}>
            <span className="fc-item-name">{f.name}</span>
            <span className="fc-item-dim">{f.dimensions[0]}×{f.dimensions[2]}m</span>
          </button>
        ))}
      </div>

      {/* Apply / reset */}
      <div className="fc-actions">
        <button className="fc-apply" disabled={!dirty || issues > 0} onClick={apply}>
          Apply to model
        </button>
        <button className="fc-reset" disabled={!dirty} onClick={reset}>Reset</button>
      </div>
      {issues > 0 && <div className="fc-warn">Resolve the {issues} issue{issues > 1 ? "s" : ""} before applying.</div>}
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
