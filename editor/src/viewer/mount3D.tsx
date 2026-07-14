// Standalone Three.js scene for the viewer's 3D tab. Deliberately
// simpler than the editor's <ThreePreview>: no preset toolbar, no
// section cutter, no layer-panel toggle — just an orbit-controlled
// scene that fills its container. The viewer's own HTML/CSS shell
// wraps this canvas.

import { Suspense, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, Grid } from "@react-three/drei";
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

function ViewerScene({ config }: { config: HouseConfig }) {
  const plot = useMemo(() => readPlotBounds(expandRoomWalls(config)), [config]);
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

export function mountViewer3D(container: HTMLElement, config: HouseConfig): void {
  const root = createRoot(container);
  root.render(<ViewerScene config={config} />);
}

// Mount the layer-visibility checkboxes into a separate HTML slot.
// Both the scene and the panel share the same Zustand `useLayerStore`,
// so toggling here immediately re-renders the scene without any glue.
export function mountViewerLayerPanel(container: HTMLElement): void {
  const root = createRoot(container);
  root.render(<ViewerLayerPanel />);
}
