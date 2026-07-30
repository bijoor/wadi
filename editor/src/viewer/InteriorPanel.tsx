// Room list for the interior walk-through. Mounted into the 🎥 camera
// panel (#viewer-interior-panel, inside #viewer-camera-panel) by
// mount3D.tsx. Pick a room → the 3D camera drops to eye level inside it
// (drag to look, joystick/WASD to walk); "Overview" returns to orbit.
// Shares useInteriorStore with the scene's first-person rig.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useConfigStore } from "../state/configStore";
import { interiorMove, listRooms, useInteriorStore } from "../three/interiorView";
import { useSpinStore } from "../three/spinStore";

// Close the 🎥 popup after a selection (mirrors the vanilla toggleCamera
// in viewer.html — the panel's open/closed state is a CSS `.active` class).
function closeCameraPanel() {
  document.getElementById("viewer-camera-panel")?.classList.remove("active");
}

export function ViewerInteriorPanel() {
  const config = useConfigStore((s) => s.config);
  const target = useInteriorStore((s) => s.target);
  const enter = useInteriorStore((s) => s.enter);
  const exit = useInteriorStore((s) => s.exit);
  const rooms = useMemo(() => listRooms(config), [config]);

  // Auto-spin (turntable) — shared with the 3D scene via useSpinStore. It only
  // takes effect in Overview (orbit) mode, so its toggle lives right on that row.
  const spinEnabled = useSpinStore((s) => s.enabled);
  const spinSpeed = useSpinStore((s) => s.speed);
  const setSpinEnabled = useSpinStore((s) => s.setEnabled);
  const setSpinSpeed = useSpinStore((s) => s.setSpeed);

  // Group rooms by floor, preserving the order listRooms returns.
  const floors: { name: string; rooms: typeof rooms }[] = [];
  for (const r of rooms) {
    let g = floors.find((f) => f.name === r.floorName);
    if (!g) {
      g = { name: r.floorName, rooms: [] };
      floors.push(g);
    }
    g.rooms.push(r);
  }

  const rowBase: React.CSSProperties = {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "none",
    border: "none",
    borderRadius: "6px",
    padding: "0.35rem 0.5rem",
    margin: "0.1rem 0",
    color: "#333",
    fontSize: "0.85rem",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
  const rowActive: React.CSSProperties = {
    ...rowBase,
    background: "#eef0ff",
    color: "#4348c9",
    fontWeight: 600,
  };

  return (
    <>
      {/* Overview (orbit) + inline auto-spin toggle. Spin only animates in this
          "fly around" mode, so its enabler sits right against the row. */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <button
          style={{ ...(!target ? rowActive : rowBase), flex: 1 }}
          onClick={() => {
            exit();
            closeCameraPanel();
          }}
        >
          Overview (orbit)
        </button>
        <button
          onClick={() => {
            const next = !spinEnabled;
            setSpinEnabled(next);
            if (next && target) exit(); // pop to orbit so the spin is visible
          }}
          title={spinEnabled ? "Stop auto-spin" : "Auto-spin (turntable)"}
          aria-label="Auto-spin"
          aria-pressed={spinEnabled}
          style={{
            flexShrink: 0,
            width: "1.9rem",
            height: "1.9rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "6px",
            border: spinEnabled ? "1px solid #4348c9" : "1px solid #ddd",
            background: spinEnabled ? "#eef0ff" : "#fff",
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
            margin: "0.15rem 0 0.35rem",
            padding: "0 0.15rem",
          }}
        >
          <span style={{ fontSize: "0.68rem", color: "#999", width: "3.4rem" }}>Spin speed</span>
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
      {rooms.length === 0 ? (
        <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.4rem" }}>
          No rooms to walk into.
        </div>
      ) : (
        <>
      {floors.map((f) => (
        <div key={f.name} style={{ marginTop: "0.4rem" }}>
          <div
            style={{
              fontSize: "0.68rem",
              color: "#999",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              margin: "0.25rem 0.5rem 0.1rem",
            }}
          >
            {f.name}
          </div>
          {f.rooms.map((r) => (
            <button
              key={r.key}
              style={target?.key === r.key ? rowActive : rowBase}
              onClick={() => {
                enter({ key: r.key, label: `${f.name}: ${r.name}`, eye: r.eye });
                closeCameraPanel();
              }}
            >
              {r.name}
            </button>
          ))}
        </div>
      ))}
      {target && <HintBanner targetKey={target.key} />}
      {target && <MoveJoystick />}
        </>
      )}
    </>
  );
}

// Transient "how to move" hint. Shows when a room is entered and fades
// itself out after a few seconds so it doesn't sit over the model. Re-shows
// each time a different room is selected. Portaled to <body>, top-centre,
// click-through.
function HintBanner({ targetKey }: { targetKey: string }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    setShow(true);
    const t = window.setTimeout(() => setShow(false), 5000);
    return () => window.clearTimeout(t);
  }, [targetKey]);

  if (!show) return null;

  // Anchor to the 3-D scene container (position: relative) so the banner
  // sits just inside the top of the model view — clear of the tab strip on
  // desktop and the header on mobile — rather than over the viewport chrome.
  const host = document.getElementById("viewer-3d-scene") ?? document.body;

  return createPortal(
    <div
      style={{
        position: "absolute",
        top: "14px",
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: "min(90%, 360px)",
        textAlign: "center",
        background: "rgba(255,255,255,0.92)",
        color: "#475569",
        fontSize: "0.75rem",
        padding: "0.3rem 0.7rem",
        borderRadius: "8px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
        pointerEvents: "none",
        zIndex: 15,
      }}
    >
      drag to look · joystick or WASD to walk
    </div>,
    host,
  );
}

// On-screen thumb joystick for movement — writes interiorMove (analog, the
// scene reads it each frame). Works with touch and mouse, so touch devices
// can walk (and look at the same time with a second finger). Uses pointer
// capture so a drag that leaves the pad keeps tracking.
const KNOB_R = 46; // px of knob travel

function MoveJoystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const activeId = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const start = (e: React.PointerEvent) => {
    if (activeId.current !== null) return;
    activeId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (e.pointerId !== activeId.current || !baseRef.current) return;
    const r = baseRef.current.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > KNOB_R) {
      dx = (dx / d) * KNOB_R;
      dy = (dy / d) * KNOB_R;
    }
    setKnob({ x: dx, y: dy });
    interiorMove.x = -dx / KNOB_R; // strafe — pad-right strafes right (felt swapped otherwise)
    interiorMove.y = -dy / KNOB_R; // forward (up on the pad = +)
  };
  const end = (e: React.PointerEvent) => {
    if (e.pointerId !== activeId.current) return;
    activeId.current = null;
    setKnob({ x: 0, y: 0 });
    interiorMove.x = 0;
    interiorMove.y = 0;
  };

  // Portal into the 3-D scene container (position: relative) so the pad sits
  // at the bottom-left of the MODEL viewport — clear of the left panel — via
  // `position: absolute`. It also inherits the container's tab visibility:
  // every other tab's `.view-container` is `display:none`, so the pad shows
  // ONLY on the 3D Model tab. (The picker's own parent has a CSS transform,
  // which is why we don't anchor here with `position: fixed`.)
  const host = document.getElementById("viewer-3d-scene") ?? document.body;

  return createPortal(
    <div
      ref={baseRef}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      title="Drag to walk"
      style={{
        position: "absolute",
        left: 24,
        bottom: 28,
        width: 108,
        height: 108,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.28)",
        border: "2px solid rgba(255,255,255,0.6)",
        boxShadow: "0 2px 14px rgba(0,0,0,0.25)",
        touchAction: "none",
        cursor: "grab",
        zIndex: 12,
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 48,
          height: 48,
          marginLeft: -24,
          marginTop: -24,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.9)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          transform: `translate(${knob.x}px, ${knob.y}px)`,
          pointerEvents: "none",
        }}
      />
    </div>,
    host,
  );
}
