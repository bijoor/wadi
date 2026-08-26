// The room-graph as a READ-ONLY plan (plans/floor-planner-graph-integration.md).
// Rooms render as blocks at their RESOLVED positions, connections as edges
// (green = the rooms share a wall, red = not), guides as reference lines.
//
// There is exactly ONE interaction, and only in the full studio (architect
// persona, not an embedded preview): SELECT a room, whose properties then open
// in the shared studio property panel (RoomForm + its Connections section).
// Everywhere else — the owner app, and the WDL editor's embedded preview — the
// Graph is purely for viewing; the design is edited as WDL code / via the forms,
// never by dragging on this canvas.

import { useMemo } from "react";
import { useConfigStore } from "../state/configStore";
import { buildRefsView } from "../param/refsView";
import { resolvedGeneratedGuidesForConfig } from "../param/resolve";
import { roomBlocksOf, connectionSatisfied, edgeList, center } from "./graphModel";

const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

// Push every `origin + k·step` that falls in [lo, hi] into `out`. Capped so a
// tiny spacing can't flood the canvas with thousands of lines.
function tileAxis(origin: number, step: number, lo: number, hi: number, out: number[], cap = 240): void {
  if (!(step > 0)) return;
  let v = origin + Math.ceil((lo - origin) / step) * step;
  for (let n = 0; v <= hi && n < cap; v += step, n++) out.push(v);
}

// Selection is enabled only in the full studio: architect persona AND not an
// embedded preview (the WDL editor boots its preview with ?panels=off / ?embed=1
// and is read-only — edit the .wdl there). Read from the shell each render; the
// component re-renders on every store change, so this tracks the current mode.
function graphSelectable(): boolean {
  if (typeof document === "undefined") return false;
  if (document.body.dataset.persona === "owner") return false;
  const q = new URLSearchParams(window.location.search);
  if (q.get("panels") === "off" || q.get("embed") === "1") return false;
  return true;
}

export function GraphView() {
  const config = useConfigStore((s) => s.config);
  const selection = useConfigStore((s) => s.selection);
  const select = useConfigStore((s) => s.select);
  const activeFloor = useConfigStore((s) => s.activeFloorIdx);

  const floorIdx = Math.min(activeFloor, (config?.floors?.length ?? 1) - 1);
  const blocks = useMemo(() => (config ? roomBlocksOf(config, floorIdx) : []), [config, floorIdx]);
  const edges = useMemo(() => edgeList(blocks), [blocks]);
  const refs = useMemo(() => buildRefsView(config), [config]);
  const genGuides = useMemo(() => resolvedGeneratedGuidesForConfig(config), [config]);

  if (!config || !config.floors?.length) return <div className="graph-empty">No model loaded.</div>;

  const selectable = graphSelectable();
  const site = (config.site ?? {}) as Record<string, unknown>;
  const px0 = num(site.reference_x), py0 = num(site.reference_y);
  let minX = px0, minY = py0, maxX = px0 + num(site.plot_width, 100), maxY = py0 + num(site.plot_length, 100);
  for (const b of blocks) { minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.l); }
  const pad = Math.max(maxX - minX, maxY - minY) * 0.06 + 5;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const W = Math.max(1, maxX - minX), H = Math.max(1, maxY - minY);
  const stroke = Math.max(W, H) / 400;

  // Guide lines drawn as a reference grid. NAMED guides use their explicit line
  // positions (from the refs view). GENERATED guides tile origin + k·spacing
  // across the visible plan — independent of `extent` (which only bounds the
  // picker / 2D overlay), so a generated grid is visible here even when the
  // author didn't set an extent.
  const xGuides = refs.grids.filter((g) => !g.generated).flatMap((g) => g.xLines.filter((l) => l.value != null).map((l) => l.value as number));
  const yGuides = refs.grids.filter((g) => !g.generated).flatMap((g) => g.yLines.filter((l) => l.value != null).map((l) => l.value as number));
  for (const gg of genGuides.values()) {
    tileAxis(gg.ox, gg.dx, minX, maxX, xGuides);
    tileAxis(gg.oy, gg.dy, minY, maxY, yGuides);
  }

  const selBlock = selection && selection.floor === floorIdx ? blocks.find((b) => b.index === selection.object) ?? null : null;
  const floorName = (config.floors[floorIdx] as { name?: string }).name ?? `Floor ${floorIdx}`;

  return (
    <div className="graph-view">
      <div className="graph-toolbar">
        <span className="graph-hint">
          {selectable
            ? "Read-only plan — click a room to edit its properties in the panel."
            : "Read-only plan — edit the design in the WDL code."}
        </span>
        {config.floors.length > 1 && (
          <span className="graph-floor" title="Switch floors in the left panel">{floorName}</span>
        )}
      </div>

      <div className="graph-body">
        <svg
          className="graph-canvas"
          viewBox={`${minX} ${minY} ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={() => { if (selectable) select(null); }}
        >
          {xGuides.map((v, i) => (
            <line key={`gx${i}`} x1={v} y1={minY} x2={v} y2={maxY} stroke="#6366f1" strokeOpacity={0.35} strokeWidth={stroke * 0.8} strokeDasharray={`${stroke * 2} ${stroke * 2}`} pointerEvents="none" />
          ))}
          {yGuides.map((v, i) => (
            <line key={`gy${i}`} x1={minX} y1={v} x2={maxX} y2={v} stroke="#6366f1" strokeOpacity={0.35} strokeWidth={stroke * 0.8} strokeDasharray={`${stroke * 2} ${stroke * 2}`} pointerEvents="none" />
          ))}
          <rect x={px0} y={py0} width={num(site.plot_width, 100)} height={num(site.plot_length, 100)} fill="none" stroke="#111827" strokeWidth={stroke * 2} />
          {blocks.map((b, i) => {
            const sel = selBlock?.index === b.index;
            return (
              <g
                key={b.index}
                onPointerDown={selectable ? (e) => { e.stopPropagation(); select({ floor: floorIdx, object: b.index }); } : undefined}
                style={{ cursor: selectable ? "pointer" : "default" }}
              >
                <rect x={b.x} y={b.y} width={b.w} height={b.l} fill={`hsl(${(i * 57) % 360} 45% 88%)`} stroke={sel ? "#2563eb" : "#334155"} strokeWidth={sel ? stroke * 2.5 : stroke * 1.2} />
                <text x={b.x + b.w / 2} y={b.y + b.l / 2} textAnchor="middle" fontSize={Math.min(b.w, b.l) * 0.14} fill="#111827">{b.name}</text>
                <text x={b.x + b.w / 2} y={b.y + b.l / 2 + Math.min(b.w, b.l) * 0.16} textAnchor="middle" fontSize={Math.min(b.w, b.l) * 0.1} fill="#4b5563">{Math.round(b.w)}×{Math.round(b.l)}</text>
              </g>
            );
          })}
          {/* Edge colour = the C11 rule: green when the connection is realized
              (overlap on a wall + a door in it, or the wall left off both rooms),
              red when it's declared but blocked / not adjacent. */}
          {edges.map(([a, b], i) => {
            const ca = center(a), cb = center(b), ok = connectionSatisfied(a, b);
            return <line key={i} x1={ca.cx} y1={ca.cy} x2={cb.cx} y2={cb.cy} stroke={ok ? "#16a34a" : "#ef4444"} strokeWidth={stroke * 1.6} strokeDasharray={`${stroke * 4} ${stroke * 3}`} pointerEvents="none" />;
          })}
        </svg>
      </div>
    </div>
  );
}
