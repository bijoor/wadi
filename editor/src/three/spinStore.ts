// Camera auto-rotate (turntable) state for the 3D viewer. Drives OrbitControls
// `autoRotate` in mount3D, and is toggled from the 🎥 camera panel. Seeded from
// the `?spin[=speed]` URL flag so the landing-page recording flow (open the app
// at /app/?spin) still starts spinning on load; the panel toggle then controls
// it at runtime. Speed ≈ 60/value seconds per revolution (default 6 ≈ 10 s/turn).
import { create } from "zustand";

const PARAM = new URLSearchParams(window.location.search).get("spin");
const SEED_SPEED = PARAM && !Number.isNaN(parseFloat(PARAM)) ? parseFloat(PARAM) : 6;

interface SpinState {
  enabled: boolean;
  speed: number;
  setEnabled: (v: boolean) => void;
  setSpeed: (n: number) => void;
}

export const useSpinStore = create<SpinState>((set) => ({
  enabled: PARAM !== null,
  speed: SEED_SPEED,
  setEnabled: (v) => set({ enabled: v }),
  setSpeed: (n) => set({ speed: n }),
}));
