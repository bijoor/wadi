// Slim toolbar for the viewer's 3D tab. Two dropdown menus (mobile-first,
// space-efficient) for everyone:
//   • "Show/hide layers" — layers rolled up into friendly, config-driven groups
//     (owners toggle whole groups; expand a group to reach its granular layers).
//   • "Change view"      — "Fly around" (orbit) + "Enter <room>" walk-throughs.
// Plus (architect only, via CSS on .v3d-actions) template-preview capture:
//   📸 add current view · ✨ auto angles + plan · 🗂 manage shots.
//
// Mounted into #viewer-3d-toolbar by mount3D.tsx. Capture goes through the
// window bridges (wadiCapture3D / wadiCaptureAngles / wadiCaptureFloorPlan);
// layers via useLayerStore; camera via useInteriorStore.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { effectiveLayers, layerGroups, useLayerStore } from "../three/layers";
import { useConfigStore } from "../state/configStore";
import { listRooms, useInteriorStore } from "../three/interiorView";
import { useSpinStore } from "../three/spinStore";

function readThumbs(config: unknown): string[] {
  const c = config as { thumbnails?: string[]; thumbnail?: string } | null;
  if (c?.thumbnails?.length) return c.thumbnails;
  return c?.thumbnail ? [c.thumbnail] : [];
}

// Close a popover when the user clicks/taps outside it.
function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, onClose]);
  return ref;
}

export function ViewerToolbar3D() {
  const config = useConfigStore((s) => s.config);
  const addThumbnail = useConfigStore((s) => s.addThumbnail);
  const setThumbnails = useConfigStore((s) => s.setThumbnails);

  const thumbs = useMemo(() => readThumbs(config), [config]);
  const [busy, setBusy] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const flashMsg = (m: string) => {
    setFlash(m);
    window.setTimeout(() => setFlash(null), 1600);
  };

  const shot3D = () => {
    const url = window.wadiCapture3D?.(720) ?? null;
    if (!url) {
      alert("Couldn't capture — make sure the 3D model is visible, then try again.");
      return;
    }
    addThumbnail(url);
    flashMsg("Shot added");
  };

  const autoCapture = async () => {
    setBusy(true);
    try {
      const angles = (await window.wadiCaptureAngles?.(3, 720)) ?? [];
      const plan = (await window.wadiCaptureFloorPlan?.()) ?? null;
      const set = [...angles];
      if (plan) set.push(plan);
      if (set.length === 0) {
        alert("Couldn't auto-capture — open the 3D view and try again.");
        return;
      }
      setThumbnails(set);
      flashMsg(`${set.length} previews captured`);
    } finally {
      setBusy(false);
    }
  };

  if (!config) return null;

  return (
    <>
      <div className="v3d-menus">
        <LayersMenu />
        <ViewMenu />
      </div>

      <div className="v3d-actions">
        {flash && <span className="v3d-count">✓ {flash}</span>}
        <button className="v3d-btn" onClick={shot3D} disabled={busy} title="Add the current 3D view to this template's previews">
          📸 <span className="v3d-label">Shot</span>
        </button>
        <button className="v3d-btn" onClick={() => void autoCapture()} disabled={busy} title="Auto-capture 3 angles + the floor plan (replaces the current set)">
          {busy ? "…" : <>✨ <span className="v3d-label">Auto</span></>}
        </button>
        <button className="v3d-btn secondary" onClick={() => setManagerOpen(true)} title="Manage preview images">
          🗂 <span className="v3d-label">Shots</span>
          <span className="v3d-count" style={{ marginLeft: 6 }}>{thumbs.length}</span>
        </button>
      </div>

      {managerOpen && (
        <ShotManager thumbs={thumbs} onChange={setThumbnails} onClose={() => setManagerOpen(false)} />
      )}
    </>
  );
}

// --- "Show/hide layers" dropdown --------------------------------------------

function LayersMenu() {
  const config = useConfigStore((s) => s.config);
  const groups = useMemo(() => layerGroups(config), [config]);
  const defs = useMemo(() => effectiveLayers(config), [config]);
  const defById = useMemo(() => new Map(defs.map((d) => [d.id, d])), [defs]);
  const allIds = useMemo(() => defs.map((d) => d.id), [defs]);

  const visible = useLayerStore((s) => s.visible);
  const toggle = useLayerStore((s) => s.toggle);
  const setMany = useLayerStore((s) => s.setMany);

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const ref = useOutsideClose(open, () => setOpen(false));

  const isOn = (id: string) => visible[id] !== false;
  const groupState = (ids: string[]): "on" | "off" | "some" => {
    const on = ids.filter(isOn).length;
    return on === 0 ? "off" : on === ids.length ? "on" : "some";
  };

  return (
    <div className="v3d-menu" ref={ref}>
      <button className="v3d-menu-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        🗂 <span className="v3d-label">Show/hide layers</span> <span className="v3d-caret">▾</span>
      </button>
      {open && (
        <div className="v3d-pop" role="menu">
          <div className="v3d-pop-head">
            <span>Show/hide layers</span>
            <span className="v3d-pop-allnone">
              <button onClick={() => setMany(allIds, true)}>All</button>
              <button onClick={() => setMany(allIds, false)}>None</button>
            </span>
          </div>
          {groups.map((g) => {
            const st = groupState(g.layerIds);
            const canExpand = g.layerIds.length > 1;
            const isExp = !!expanded[g.label];
            return (
              <div key={g.label} className="v3d-grp">
                <div className="v3d-pop-row">
                  <input
                    type="checkbox"
                    checked={st !== "off"}
                    ref={(el) => {
                      if (el) el.indeterminate = st === "some";
                    }}
                    onChange={() => setMany(g.layerIds, st !== "on")}
                  />
                  <span className="v3d-grp-label" onClick={() => setMany(g.layerIds, st !== "on")}>
                    {g.label}
                  </span>
                  {canExpand && (
                    <button
                      className="v3d-grp-exp"
                      title={isExp ? "Hide layers" : "Show individual layers"}
                      onClick={() => setExpanded((e) => ({ ...e, [g.label]: !isExp }))}
                    >
                      {isExp ? "▾" : "▸"}
                    </button>
                  )}
                </div>
                {canExpand && isExp && (
                  <div className="v3d-sublist">
                    {g.layerIds.map((id) => {
                      const def = defById.get(id);
                      return (
                        <label key={id} className="v3d-pop-subrow">
                          <input type="checkbox" checked={isOn(id)} onChange={() => toggle(id)} />
                          <span className="v3d-swatch" style={{ backgroundColor: def?.color ?? "#888" }} />
                          {def?.label ?? id}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- "Change view" dropdown --------------------------------------------------

function ViewMenu() {
  const config = useConfigStore((s) => s.config);
  const rooms = useMemo(() => listRooms(config), [config]);
  const target = useInteriorStore((s) => s.target);
  const enter = useInteriorStore((s) => s.enter);
  const exit = useInteriorStore((s) => s.exit);

  // Auto-spin (turntable) — shared with the 3D scene via useSpinStore. It only
  // animates in "Fly around" (orbit) mode, so its enabler sits on that row.
  const spinEnabled = useSpinStore((s) => s.enabled);
  const spinSpeed = useSpinStore((s) => s.speed);
  const setSpinEnabled = useSpinStore((s) => s.setEnabled);
  const setSpinSpeed = useSpinStore((s) => s.setSpeed);

  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));

  // Group the walk-into rooms by floor, preserving listRooms order.
  const floors = useMemo(() => {
    const out: { name: string; rooms: typeof rooms }[] = [];
    for (const r of rooms) {
      let g = out.find((f) => f.name === r.floorName);
      if (!g) {
        g = { name: r.floorName, rooms: [] };
        out.push(g);
      }
      g.rooms.push(r);
    }
    return out;
  }, [rooms]);

  const pretty = (s: string) => s.replace(/_/g, " ");

  return (
    <div className="v3d-menu" ref={ref}>
      <button className="v3d-menu-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        📷 <span className="v3d-label">Change view</span> <span className="v3d-caret">▾</span>
      </button>
      {open && (
        <div className="v3d-pop" role="menu">
          <div className="v3d-pop-head"><span>Change view</span></div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              className={`v3d-pop-item${!target ? " active" : ""}`}
              style={{ flex: 1 }}
              onClick={() => {
                exit();
                setOpen(false);
              }}
            >
              🕊️ Fly around
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const next = !spinEnabled;
                setSpinEnabled(next);
                if (next && target) exit(); // pop to Fly around so the spin is visible
              }}
              title={spinEnabled ? "Stop auto-spin" : "Auto-spin (turntable)"}
              aria-label="Auto-spin"
              aria-pressed={spinEnabled}
              style={{
                flexShrink: 0,
                width: "2rem",
                height: "2rem",
                marginRight: "0.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "6px",
                border: spinEnabled ? "1px solid #4348c9" : "1px solid #d0d0d8",
                background: spinEnabled ? "#eef0ff" : "transparent",
                color: spinEnabled ? "#4348c9" : "#888",
                cursor: "pointer",
                fontSize: "1.05rem",
                lineHeight: 1,
              }}
            >
              ⟳
            </button>
          </div>
          {spinEnabled && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.1rem 0.85rem 0.45rem",
              }}
            >
              <span style={{ fontSize: "0.68rem", color: "#999" }}>Spin speed</span>
              <input
                type="range"
                min={1}
                max={16}
                step={1}
                value={spinSpeed}
                onChange={(e) => setSpinSpeed(parseFloat(e.target.value))}
                style={{ flex: 1 }}
                aria-label="Auto-spin speed"
              />
            </div>
          )}
          {floors.map((f) => (
            <div key={f.name}>
              <div className="v3d-pop-floor">{f.name}</div>
              {f.rooms.map((r) => (
                <button
                  key={r.key}
                  className={`v3d-pop-item${target?.key === r.key ? " active" : ""}`}
                  onClick={() => {
                    enter({ key: r.key, label: `${f.name}: ${r.name}`, eye: r.eye });
                    setOpen(false);
                  }}
                >
                  Enter {pretty(r.name)}
                </button>
              ))}
            </div>
          ))}
          {rooms.length === 0 && <div className="v3d-pop-empty">No rooms to enter.</div>}
        </div>
      )}
    </div>
  );
}

function ShotManager({
  thumbs,
  onChange,
  onClose,
}: {
  thumbs: string[];
  onChange: (next: string[]) => void;
  onClose: () => void;
}) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= thumbs.length) return;
    const next = [...thumbs];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const setCover = (i: number) => {
    if (i === 0) return;
    const next = [...thumbs];
    const [it] = next.splice(i, 1);
    next.unshift(it);
    onChange(next);
  };
  const del = (i: number) => onChange(thumbs.filter((_, k) => k !== i));

  // Portal to <body>: the toolbar's `backdrop-filter` makes it a containing
  // block for `position: fixed`, so an in-tree modal anchors to the thin
  // toolbar strip (bottom of screen) instead of the viewport. Escape it.
  return createPortal(
    <div className="shot-mgr-backdrop" onClick={onClose}>
      <div className="shot-mgr-card" onClick={(e) => e.stopPropagation()}>
        <div className="shot-mgr-head">
          <h3>Template previews</h3>
          <button className="shot-mgr-ibtn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="shot-mgr-sub">
          These images show in the owner gallery. The first is the cover. Use 📸 Shot
          to add the current 3D view, ✨ Auto for a fresh set of angles + the plan,
          or 📸 on the Layout tab to add a 2D sheet. Reorder, set the cover, or delete below.
        </p>
        <div className="shot-mgr-grid">
          {thumbs.length === 0 && (
            <div className="shot-mgr-empty">No previews yet — use 📸 Shot or ✨ Auto to add some.</div>
          )}
          {thumbs.map((url, i) => (
            <div key={i} className={`shot-mgr-item${i === 0 ? " cover" : ""}`}>
              <div className="shot-mgr-thumb">
                <img src={url} alt={`preview ${i + 1}`} />
              </div>
              <div className="shot-mgr-row">
                {i === 0 ? <span className="cover-tag">Cover</span> : <span className="idx">#{i + 1}</span>}
                <button className="shot-mgr-ibtn" onClick={() => move(i, -1)} disabled={i === 0} title="Move left">◀</button>
                <button className="shot-mgr-ibtn" onClick={() => move(i, 1)} disabled={i === thumbs.length - 1} title="Move right">▶</button>
                {i !== 0 && (
                  <button className="shot-mgr-ibtn" onClick={() => setCover(i)} title="Make cover">★</button>
                )}
                <button className="shot-mgr-ibtn danger" onClick={() => del(i)} title="Delete">🗑</button>
              </div>
            </div>
          ))}
        </div>
        <div className="shot-mgr-foot">
          {thumbs.length > 0 && (
            <button className="shot-mgr-ibtn danger" onClick={() => onChange([])}>Clear all</button>
          )}
          <button className="shot-mgr-ibtn shot-mgr-close" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function mountViewer3DToolbar(container: HTMLElement): void {
  createRoot(container).render(<ViewerToolbar3D />);
}
