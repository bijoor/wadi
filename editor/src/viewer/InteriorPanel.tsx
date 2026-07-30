// Interior walk-through helpers. The room picker itself now lives in the
// toolbar "Change view" dropdown (Toolbar3D ViewMenu) — the old 🎥 side-panel
// list has been retired. This component stays mounted (into the hidden
// #viewer-interior-panel) only so the on-screen movement joystick + hint keep
// rendering when a room is entered. Both portal into the 3D scene container,
// not this panel. Shares useInteriorStore with the scene's first-person rig.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { interiorMove, useInteriorStore } from "../three/interiorView";

export function ViewerInteriorPanel() {
  const target = useInteriorStore((s) => s.target);
  return (
    <>
      {target && <HintBanner targetKey={target.key} />}
      {target && <MoveJoystick />}
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
