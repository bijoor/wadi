import { create } from "zustand";
import { persist } from "zustand/middleware";

// Runtime-adjustable lighting for the viewer's 3D scene. The scene reads
// these live (ViewerScene subscribes), and the ⚙️ Lighting panel writes
// them. Defaults reproduce the previously hard-coded look, so an untouched
// scene renders exactly as before.
export interface LightingControl {
  key: "ambient" | "sun" | "env";
  label: string;
  min: number;
  max: number;
  step: number;
}

// Order = display order in the panel.
export const LIGHTING_CONTROLS: LightingControl[] = [
  { key: "ambient", label: "Ambient light", min: 0, max: 2, step: 0.05 },
  { key: "sun", label: "Sun (directional)", min: 0, max: 3, step: 0.05 },
  { key: "env", label: "Sky / environment", min: 0, max: 3, step: 0.05 },
];

export interface LightingState {
  ambient: number; // ambientLight intensity
  sun: number; // directionalLight intensity
  env: number; // scene.environmentIntensity (image-based lighting)
  background: boolean; // show the HDRI sky as the backdrop
  set: (key: LightingControl["key"], value: number) => void;
  setBackground: (on: boolean) => void;
  reset: () => void;
}

// Match the values that were hard-coded in mount3D before this control
// existed (ambient 0.35, sun 1.0, env intensity 1.0, sky background on).
const DEFAULTS = { ambient: 0.35, sun: 1.0, env: 1.0, background: true };

// Persisted to localStorage so the user's lighting preferences survive
// reloads / app restarts. Only the values are stored (not the actions);
// any field missing from an older payload falls back to its default via
// `merge`, so adding new lighting settings later won't break stored state.
export const useLightingStore = create<LightingState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (key, value) =>
        set(() => ({ [key]: value }) as Partial<LightingState>),
      setBackground: (on) => set({ background: on }),
      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: "wadi-lighting",
      partialize: (s) => ({
        ambient: s.ambient,
        sun: s.sun,
        env: s.env,
        background: s.background,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<LightingState>),
      }),
    },
  ),
);
