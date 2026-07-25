// Permanent slim toolbar for the viewer's 3D tab (architect only; CSS-hidden
// for owners). Two jobs:
//   1. Layer quick-toggles — the visibility layers, always visible as pills,
//      so layers are obvious instead of hidden behind the 📚 icon.
//   2. Template-preview capture — 📸 add the current 3D view, ✨ auto-capture a
//      set of oblique angles + the floor plan, and 🗂 manage the shot list
//      (reorder / set cover / delete).
//
// Mounted into #viewer-3d-toolbar by mount3D.tsx. Capture goes through the
// window bridges registered by mount3D (wadiCapture3D / wadiCaptureAngles) and
// main.ts (wadiCaptureFloorPlan); the shots persist on config.thumbnails via
// the store and are written out on Save.

import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { effectiveLayers, useLayerStore } from "../three/layers";
import { useConfigStore } from "../state/configStore";

function readThumbs(config: unknown): string[] {
  const c = config as { thumbnails?: string[]; thumbnail?: string } | null;
  if (c?.thumbnails?.length) return c.thumbnails;
  return c?.thumbnail ? [c.thumbnail] : [];
}

export function ViewerToolbar3D() {
  const config = useConfigStore((s) => s.config);
  const addThumbnail = useConfigStore((s) => s.addThumbnail);
  const setThumbnails = useConfigStore((s) => s.setThumbnails);

  const layers = useMemo(() => effectiveLayers(config), [config]);
  const visible = useLayerStore((s) => s.visible);
  const toggle = useLayerStore((s) => s.toggle);

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
      <div className="v3d-chips">
        {layers.map((l) => {
          const on = visible[l.id] !== false;
          return (
            <span
              key={l.id}
              className={`v3d-chip${on ? "" : " off"}`}
              onClick={() => toggle(l.id)}
              title={`${on ? "Hide" : "Show"} ${l.label}`}
            >
              <span className="v3d-dot" style={{ backgroundColor: l.color }} />
              <span className="v3d-lbl">{l.label}</span>
            </span>
          );
        })}
      </div>

      <div className="v3d-actions">
        {flash && <span className="v3d-count">✓ {flash}</span>}
        <button className="v3d-btn" onClick={shot3D} disabled={busy} title="Add the current 3D view to this template's previews">
          📸 Shot
        </button>
        <button className="v3d-btn" onClick={() => void autoCapture()} disabled={busy} title="Auto-capture 3 angles + the floor plan (replaces the current set)">
          {busy ? "…" : "✨ Auto"}
        </button>
        <button className="v3d-btn secondary" onClick={() => setManagerOpen(true)} title="Manage preview images">
          🗂 Shots
          <span className="v3d-count" style={{ marginLeft: 6 }}>{thumbs.length}</span>
        </button>
      </div>

      {managerOpen && (
        <ShotManager
          thumbs={thumbs}
          onChange={setThumbnails}
          onClose={() => setManagerOpen(false)}
        />
      )}
    </>
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

  return (
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
                {i === 0 ? (
                  <span className="cover-tag">Cover</span>
                ) : (
                  <span className="idx">#{i + 1}</span>
                )}
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
    </div>
  );
}

export function mountViewer3DToolbar(container: HTMLElement): void {
  createRoot(container).render(<ViewerToolbar3D />);
}
