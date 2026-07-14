// Standalone Three.js scene for the viewer's 3D tab. Deliberately
// simpler than the editor's <ThreePreview>: no preset toolbar, no
// section cutter, no layer-panel toggle — just an orbit-controlled
// scene that fills its container. The viewer's own HTML/CSS shell
// wraps this canvas.

import { Suspense, useMemo } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, Grid, Text } from "@react-three/drei";
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
import { useConfigStore } from "../state/configStore";

function ViewerScene() {
  // Subscribe to useConfigStore so property-panel edits re-render the
  // scene without any external glue. If the store is empty (initial
  // load), render nothing until the config arrives.
  const config = useConfigStore((s) => s.config) as HouseConfig | null;
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
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[camDist * 0.6, camDist * 0.85, camDist * 0.35]}
        intensity={1.0}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      {/* Same HDRI the original <model-viewer> used for the skybox +
          image-based lighting. Loaded from Poly Haven's CDN so we
          don't have to bundle the ~1 MB file. */}
      <Suspense fallback={null}>
        <Environment
          files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/citrus_orchard_road_puresky_1k.hdr"
          background
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
      <CompassRose plot={plot} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        target={[0, targetY, 0]}
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

// Flat compass rose laid on the ground just outside the plot's NW
// corner. Standard map convention: N points to Three's -Z axis (which
// corresponds to Inkscape Y=0, the top of the floor plan). N arrow is
// coloured red; the other three are white/grey. Everything sits on
// the XZ plane at y=0.01 so it renders just above the grid without
// z-fighting.
function CompassRose({ plot }: { plot: { width: number; length: number } }) {
  const halfW = plot.width / 2;
  const halfL = plot.length / 2;
  // Radius sized to a fraction of the plot so it's readable but not
  // dominant. Position: offset outside the NW corner of the plot.
  const R = Math.max(20, Math.min(halfW, halfL) * 0.22);
  const pad = R * 1.3;
  const cx = -halfW - pad;
  const cz = -halfL - pad;
  const y = 0.02;
  const letterSize = R * 0.45;

  // A single triangular "arrow" pointing along +Z (south) in local
  // space; the caller rotates it to face N / S / E / W. Colour is red
  // for the N arrow only, white for the other three.
  const Arrow = ({
    dir,
    color,
  }: {
    dir: "N" | "S" | "E" | "W";
    color: string;
  }) => {
    const rotY =
      dir === "N" ? Math.PI : dir === "S" ? 0 : dir === "E" ? Math.PI / 2 : -Math.PI / 2;
    return (
      <group rotation={[0, rotY, 0]}>
        <mesh position={[0, 0, R * 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
          {/* Triangle: base at hub, tip at radius R. */}
          <shapeGeometry args={[buildTriangle(R * 0.9, R * 0.35)]} />
          <meshBasicMaterial color={color} side={2 /* DoubleSide */} />
        </mesh>
      </group>
    );
  };

  const letter = (
    ch: string,
    color: string,
    pos: [number, number, number],
  ) => (
    <Text
      position={pos}
      rotation={[-Math.PI / 2, 0, 0]}
      fontSize={letterSize}
      color={color}
      anchorX="center"
      anchorY="middle"
      outlineWidth={letterSize * 0.08}
      outlineColor="black"
    >
      {ch}
    </Text>
  );

  return (
    <group position={[cx, y, cz]}>
      {/* Backing disc so the rose reads against any ground colour. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[R * 1.35, 48]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.7} />
      </mesh>
      {/* Outer ring. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[R * 1.3, R * 1.35, 48]} />
        <meshBasicMaterial color="#ffffff" side={2} />
      </mesh>
      {/* Central hub. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <circleGeometry args={[R * 0.1, 24]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <Arrow dir="N" color="#dc2626" />
      <Arrow dir="S" color="#e5e7eb" />
      <Arrow dir="E" color="#e5e7eb" />
      <Arrow dir="W" color="#e5e7eb" />
      {letter("N", "#ffffff", [0, 0.02, -R * 1.65])}
      {letter("S", "#ffffff", [0, 0.02, R * 1.65])}
      {letter("E", "#ffffff", [R * 1.65, 0.02, 0])}
      {letter("W", "#ffffff", [-R * 1.65, 0.02, 0])}
    </group>
  );
}

// Build an isoceles triangle Shape whose apex sits at (0, -length/2) and
// whose base spans ±width/2 on X at (0, +length/2). Used for the compass
// arrows — the parent group rotates it per direction.
function buildTriangle(length: number, width: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -length / 2);
  s.lineTo(-width / 2, length / 2);
  s.lineTo(width / 2, length / 2);
  s.closePath();
  return s;
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
