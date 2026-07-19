// Standalone Three.js scene for the viewer's 3D tab. Deliberately
// simpler than the editor's <ThreePreview>: no preset toolbar, no
// section cutter, no layer-panel toggle — just an orbit-controlled
// scene that fills its container. The viewer's own HTML/CSS shell
// wraps this canvas.

import { Suspense, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, OrbitControls, Grid, Text, Billboard } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  EffectComposer,
  N8AO,
  ToneMapping,
  SMAA,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { House3D } from "../three/House3D";
import { readPlotBounds } from "../three/coords";
import { expandRoomWalls, type HouseConfig } from "../svg2d/expand";
import { ViewerLayerPanel } from "./LayerPanel";
import { ViewerLightingPanel } from "./LightingPanel";
import { ViewerInteriorPanel } from "./InteriorPanel";
import { useConfigStore } from "../state/configStore";
import { useLightingStore } from "../three/lighting";
import { useInteriorStore, interiorMove } from "../three/interiorView";

// Optional camera auto-rotate, for recording a smooth turntable GIF of the
// model (the hero on the landing page). Off by default so it never affects
// normal use. Enable by adding ?spin to the app URL (e.g. /app/?spin), or
// ?spin=<speed> to tune it — higher is faster, roughly 60/speed seconds per
// full revolution (so ?spin=6 ≈ 10s per turn, ?spin=4 ≈ 15s).
const SPIN_PARAM = new URLSearchParams(window.location.search).get("spin");
const AUTO_ROTATE = SPIN_PARAM !== null;
const AUTO_ROTATE_SPEED =
  SPIN_PARAM && !Number.isNaN(parseFloat(SPIN_PARAM))
    ? parseFloat(SPIN_PARAM)
    : 6.0;

function ViewerScene() {
  // Subscribe to useConfigStore so property-panel edits re-render the
  // scene without any external glue. If the store is empty (initial
  // load), render nothing until the config arrives.
  const config = useConfigStore((s) => s.config) as HouseConfig | null;
  // Runtime lighting (⚙️ panel). Defaults reproduce the previous look.
  const ambient = useLightingStore((s) => s.ambient);
  const sun = useLightingStore((s) => s.sun);
  const env = useLightingStore((s) => s.env);
  const background = useLightingStore((s) => s.background);
  // Interior walk-through: when a room is chosen, the camera drops to eye
  // level inside it and OrbitControls hands off to the first-person rig.
  const interior = useInteriorStore((s) => s.target);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  if (!config) return null;
  // expandRoomWalls throws on invalid openings; falls back to reading
  // the plot directly from the raw config so the scene camera stays
  // consistent while House3D handles the error.
  const plot = useMemo(() => {
    try {
      return readPlotBounds(expandRoomWalls(config));
    } catch {
      return readPlotBounds(config as unknown as Record<string, unknown>);
    }
  }, [config]);
  // Rough bounding sphere: floor plan diagonal + a chunky vertical
  // allowance (the roof reaches ~30-35% of the plot's larger side).
  // Distance = R / sin(fov/2) gives the closest we can be while still
  // fitting the sphere at the given FOV; add a 1.4× margin so the
  // house isn't glued to the frame edges.
  const FOV = 45;
  const houseHeightGuess = Math.max(plot.width, plot.length) * 0.35;
  const boundRadius = Math.hypot(plot.width, plot.length, houseHeightGuess) / 2;
  const fitDist = boundRadius / Math.sin((FOV / 2) * Math.PI / 180);
  const camDist = fitDist * 1.4;
  // OrbitControls' target defaults to (0,0,0), but our house sits on
  // Y=0 and reaches up to Y ≈ houseHeightGuess, so its geometric
  // centre is at (0, houseHeightGuess/2, 0). Aim the camera there so
  // the model lands in the middle of the frame instead of clinging
  // to the top.
  const targetY = houseHeightGuess / 2;
  // Camera position: sit at camDist * 0.55 along X/Z for the diagonal,
  // and lift Y so the vector to the (elevated) target still points
  // slightly downward — matches the intuitive "looking down at the
  // house from a hilltop" view.
  const cx = camDist * 0.55;
  const cy = camDist * 0.55 + targetY;
  const cz = camDist * 0.55;

  return (
    <Canvas
      shadows
      camera={{
        position: [cx, cy, cz],
        fov: FOV,
        near: 1,
        far: camDist * 20,
      }}
      gl={{ antialias: true }}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <ambientLight intensity={ambient} />
      <directionalLight
        position={[camDist * 0.6, camDist * 0.85, camDist * 0.35]}
        intensity={sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      {/* Same HDRI the original <model-viewer> used for the skybox +
          image-based lighting. Loaded from Poly Haven's CDN so we
          don't have to bundle the ~1 MB file. `environmentIntensity`
          and `background` are driven by the ⚙️ lighting panel. */}
      <Suspense fallback={null}>
        <Environment
          files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/citrus_orchard_road_puresky_1k.hdr"
          environmentIntensity={env}
          background={background}
        />
      </Suspense>
      <Grid
        args={[plot.width * 2, plot.length * 2]}
        cellSize={10}
        cellThickness={0.5}
        cellColor="#334155"
        sectionSize={100}
        sectionThickness={1}
        sectionColor="#475569"
        fadeDistance={camDist * 3}
        infiniteGrid={false}
        position={[0, -0.02, 0]}
      />
      <House3D config={config} />
      <OrientationGizmo plot={plot} />
      {!interior && (
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.1}
          target={[0, targetY, 0]}
          autoRotate={AUTO_ROTATE}
          autoRotateSpeed={AUTO_ROTATE_SPEED}
        />
      )}
      <InteriorController
        exteriorPos={[cx, cy, cz]}
        exteriorTarget={[0, targetY, 0]}
        exteriorFov={FOV}
        controlsRef={controlsRef}
      />
      <EffectComposer multisampling={0} enableNormalPass>
        <N8AO
          aoRadius={12}
          intensity={2.5}
          distanceFalloff={0.5}
          color="black"
        />
        <SMAA />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  );
}

// First-person "walk-through" rig. Active only when a room is selected in
// the interior store: the camera drops to eye level in the room, drag
// rotates the view (yaw/pitch), and WASD / arrow keys walk on the floor
// plane (hold Shift to move faster). On exit it restores the exterior
// orbit camera + target + FOV.
function InteriorController({
  exteriorPos,
  exteriorTarget,
  exteriorFov,
  controlsRef,
}: {
  exteriorPos: [number, number, number];
  exteriorTarget: [number, number, number];
  exteriorFov: number;
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
}) {
  const target = useInteriorStore((s) => s.target);
  const { camera, gl } = useThree();
  const yaw = useRef(Math.PI); // look toward -Z (north) by default
  const pitch = useRef(-0.05);
  const pos = useRef<[number, number, number]>([0, 0, 0]);
  const keys = useRef<Record<string, boolean>>({});

  const setFov = (f: number) => {
    const c = camera as unknown as { fov?: number; updateProjectionMatrix: () => void };
    if (typeof c.fov === "number") {
      c.fov = f;
      c.updateProjectionMatrix();
    }
  };

  // Enter / exit transitions.
  useEffect(() => {
    if (target) {
      pos.current = [...target.eye] as [number, number, number];
      yaw.current = Math.PI;
      pitch.current = -0.05;
      camera.position.set(target.eye[0], target.eye[1], target.eye[2]);
      setFov(72);
    } else {
      camera.position.set(exteriorPos[0], exteriorPos[1], exteriorPos[2]);
      setFov(exteriorFov);
      const c = controlsRef.current;
      if (c) {
        c.target.set(exteriorTarget[0], exteriorTarget[1], exteriorTarget[2]);
        c.update();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // Input listeners — only while a room is active.
  useEffect(() => {
    if (!target) return;
    const el = gl.domElement;
    // Track the look-drag by pointerId so a second finger (e.g. on the
    // joystick) doesn't hijack it — enables look + move at once on touch.
    let lookId: number | null = null;
    let lx = 0;
    let ly = 0;
    const down = (e: PointerEvent) => {
      if (lookId !== null) return; // already looking with another pointer
      lookId = e.pointerId;
      lx = e.clientX;
      ly = e.clientY;
      el.style.cursor = "grabbing";
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== lookId) return;
      yaw.current += (e.clientX - lx) * 0.0045; // drag right → look right
      pitch.current = Math.max(-1.45, Math.min(1.45, pitch.current + (e.clientY - ly) * 0.0045));
      lx = e.clientX;
      ly = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === lookId) {
        lookId = null;
        el.style.cursor = "grab";
      }
    };
    const isField = (t: EventTarget | null) => {
      const n = t as HTMLElement | null;
      return !!n && (n.tagName === "INPUT" || n.tagName === "TEXTAREA" || n.isContentEditable);
    };
    const kd = (e: KeyboardEvent) => {
      if (isField(e.target)) return;
      keys.current[e.key.toLowerCase()] = true;
    };
    const ku = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    el.style.cursor = "grab";
    // Stop the browser turning touch-drags into scroll/zoom gestures so
    // drag-to-look works on touch devices (OrbitControls normally does this,
    // but it's unmounted in interior mode).
    const prevTouch = el.style.touchAction;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      el.style.cursor = "";
      el.style.touchAction = prevTouch;
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      keys.current = {};
    };
  }, [target, gl]);

  useFrame((_, delta) => {
    if (!target) return;
    const k = keys.current;
    const run = k["shift"] ? 2.4 : 1;
    const speed = 55 * run * Math.min(delta, 0.05);
    // Keyboard (digital) blended with the on-screen joystick (analog),
    // each clamped to [-1, 1].
    const kf = (k["w"] || k["arrowup"] ? 1 : 0) - (k["s"] || k["arrowdown"] ? 1 : 0);
    const ks = (k["d"] || k["arrowright"] ? 1 : 0) - (k["a"] || k["arrowleft"] ? 1 : 0);
    const fwd = Math.max(-1, Math.min(1, kf + interiorMove.y));
    const strafe = Math.max(-1, Math.min(1, ks + interiorMove.x));
    if (fwd || strafe) {
      const fx = Math.sin(yaw.current);
      const fz = Math.cos(yaw.current); // horizontal forward
      const rx = Math.cos(yaw.current);
      const rz = -Math.sin(yaw.current); // right
      pos.current[0] += (fx * fwd + rx * strafe) * speed;
      pos.current[2] += (fz * fwd + rz * strafe) * speed;
    }
    camera.position.set(pos.current[0], pos.current[1], pos.current[2]);
    const cp = Math.cos(pitch.current);
    camera.lookAt(
      pos.current[0] + Math.sin(yaw.current) * cp,
      pos.current[1] + Math.sin(pitch.current),
      pos.current[2] + Math.cos(yaw.current) * cp,
    );
  });

  return null;
}

// Simple orientation gizmo sitting just OUTSIDE the NW corner of the
// GROUND plane (so it never overlaps the green lawn). Three SOLID axis
// bars (boxes, not coplanar flats — so nothing z-fights) show the project
// coordinate frame, labelled with both the axis name and the compass
// direction:
//   Three +X → project +x → East   (red)
//   Three +Z → project +y → South  (green)   [N = -Z, the top of the plan]
//   Three +Y → project +z → up     (blue)
function OrientationGizmo({ plot }: { plot: { width: number; length: number } }) {
  const halfW = plot.width / 2;
  const halfL = plot.length / 2;
  const R = Math.max(20, Math.min(halfW, halfL) * 0.22);
  // The GroundPlane spans plot × 1.5 centred on the origin (half-extent
  // 0.75 × plot); place the gizmo just beyond that NW corner on the grid.
  const cx = -(plot.width * 0.75 + R * 1.6);
  const cz = -(plot.length * 0.75 + R * 1.6);
  // Sit on the ground; the vertical (z) bar rises from here.
  const y = 0;

  const L = R;               // horizontal axis half-length
  const bar = R * 0.06;      // bar thickness
  const fs = R * 0.55;       // label size
  const pad = R * 0.35;      // label offset past the tip

  const RED = "#dc2626";     // x / East–West
  const GRN = "#16a34a";     // y / North–South
  const BLU = "#2563eb";     // z / up

  const Label = ({
    p, text, color, size = fs,
  }: {
    p: [number, number, number];
    text: string;
    color: string;
    size?: number;
  }) => (
    <Billboard position={p}>
      <Text
        fontSize={size}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={size * 0.05}
        outlineColor="#ffffff"
      >
        {text}
      </Text>
    </Billboard>
  );

  return (
    <group position={[cx, y, cz]}>
      {/* x axis (E–W) */}
      <mesh position={[0, bar, 0]}>
        <boxGeometry args={[2 * L, bar, bar]} />
        <meshBasicMaterial color={RED} />
      </mesh>
      {/* y axis (N–S) */}
      <mesh position={[0, bar, 0]}>
        <boxGeometry args={[bar, bar, 2 * L]} />
        <meshBasicMaterial color={GRN} />
      </mesh>
      {/* z axis (up) */}
      <mesh position={[0, bar + L, 0]}>
        <boxGeometry args={[bar, 2 * L, bar]} />
        <meshBasicMaterial color={BLU} />
      </mesh>

      {/* Compass letters at the four horizontal tips. */}
      <Label p={[L + pad, bar, 0]} text="E" color={RED} />
      <Label p={[-L - pad, bar, 0]} text="W" color={RED} />
      <Label p={[0, bar, L + pad]} text="S" color={GRN} />
      <Label p={[0, bar, -L - pad]} text="N" color={GRN} />

      {/* Axis names — smaller than the compass letters. */}
      <Label p={[L * 0.5, bar + pad * 0.6, 0]} text="x" color={RED} size={fs * 0.55} />
      <Label p={[0, bar + pad * 0.6, L * 0.5]} text="y" color={GRN} size={fs * 0.55} />
      <Label p={[0, bar + 2 * L + pad * 0.8, 0]} text="z" color={BLU} size={fs * 0.55} />
    </group>
  );
}

export function mountViewer3D(container: HTMLElement): void {
  const root = createRoot(container);
  root.render(<ViewerScene />);
}

// Mount the layer-visibility checkboxes into a separate HTML slot.
// Both the scene and the panel share the same Zustand `useLayerStore`,
// so toggling here immediately re-renders the scene without any glue.
export function mountViewerLayerPanel(container: HTMLElement): void {
  const root = createRoot(container);
  root.render(<ViewerLayerPanel />);
}

// Mount the lighting sliders into the ⚙️ settings panel. Shares the
// useLightingStore with ViewerScene, so dragging a slider re-lights the
// scene live.
export function mountViewerLightingPanel(container: HTMLElement): void {
  const root = createRoot(container);
  root.render(<ViewerLightingPanel />);
}

// Mount the interior-walk-through room picker. Shares useInteriorStore with
// the scene's first-person rig.
export function mountViewerInteriorPanel(container: HTMLElement): void {
  const root = createRoot(container);
  root.render(<ViewerInteriorPanel />);
}
