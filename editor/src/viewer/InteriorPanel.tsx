// Room picker for the interior walk-through. Pick a room → the 3D camera
// drops to eye level inside it (drag to look, WASD/arrows to walk, Shift to
// go faster). "Overview" returns to the orbit camera. Rendered into
// #viewer-interior-panel by mount3D.tsx; shares useInteriorStore with the
// scene's first-person rig.

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useConfigStore } from "../state/configStore";
import { interiorMove, listRooms, useInteriorStore } from "../three/interiorView";

export function ViewerInteriorPanel() {
  const config = useConfigStore((s) => s.config);
  const target = useInteriorStore((s) => s.target);
  const enter = useInteriorStore((s) => s.enter);
  const exit = useInteriorStore((s) => s.exit);
  const rooms = useMemo(() => listRooms(config), [config]);

  if (rooms.length === 0) return null;

  const select: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.15)",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.95)",
    color: "#333",
    fontSize: "0.85rem",
    padding: "0.35rem 0.5rem",
    cursor: "pointer",
    boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", pointerEvents: "auto" }}>
      <span title="Walk inside a room" style={{ fontSize: "1.1rem" }}>🚶</span>
      <select
        value={target?.key ?? ""}
        title="Stand inside a room and look around"
        style={select}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            exit();
            return;
          }
          const r = rooms.find((x) => x.key === v);
          if (r) enter({ key: r.key, label: `${r.floorName}: ${r.name}`, eye: r.eye });
        }}
      >
        <option value="">Overview (orbit)</option>
        {rooms.map((r) => (
          <option key={r.key} value={r.key}>
            {r.floorName}: {r.name}
          </option>
        ))}
      </select>
      {target && (
        <span
          style={{
            fontSize: "0.72rem",
            color: "#475569",
            background: "rgba(255,255,255,0.9)",
            borderRadius: "6px",
            padding: "0.25rem 0.5rem",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          }}
        >
          drag to look · joystick or WASD to walk
        </span>
      )}
      {target && <MoveJoystick />}
    </div>
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

  // Portal to <body> so `position: fixed` resolves against the viewport —
  // the picker's parent has a CSS transform, which would otherwise capture
  // fixed positioning and pin the pad to the top of the screen.
  return createPortal(
    <div
      ref={baseRef}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      title="Drag to walk"
      style={{
        position: "fixed",
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
    document.body,
  );
}
