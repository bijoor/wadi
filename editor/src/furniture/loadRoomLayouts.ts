// App-side loader for the std room-layout pack (wadi-dsl/std-modules/rooms.wdl): compile it
// in the browser and turn it into the placement engine's `Layout[]`. The pure transform lives
// in roomLayouts.ts (configToLayouts); this file is the thin I/O bridge — it bundles the pack
// (`?raw`), compiles it with the std-furniture resolver (rooms.wdl `import`s std-furniture for
// its asset refs), resolves formulas, and caches the result.
//
// Kept out of roomLayouts.ts so that module stays a pure, unit-testable transform (no `?raw` /
// dynamic-import / build-only constructs). The compiler is loaded via the bare
// `wadi-wdl-compiler` specifier the app already uses (aliased to wadi-dsl in vite.config).

import roomsWdl from "../../../wadi-dsl/std-modules/rooms.wdl?raw";
import { resolveParametric } from "../param/resolve";
import { stdResolveModule } from "../io/stdModules";
import { configToLayouts } from "./roomLayouts";
import type { Layout } from "./autoplace";

let cache: Layout[] | null = null;

/** Compile + load the std room-layout pack into `Layout[]` (cached across calls). */
export async function loadRoomLayouts(): Promise<Layout[]> {
  if (cache) return cache;
  const { compileDsl } = await import("wadi-wdl-compiler");
  const compiled = compileDsl(roomsWdl, { resolveModule: stdResolveModule }) as Record<string, unknown>;
  const resolved = resolveParametric(compiled as never).config as Record<string, unknown>;
  cache = configToLayouts(resolved);
  return cache;
}

/** Drop the cached pack (e.g. after the user edits a layout module). */
export function clearRoomLayoutsCache(): void {
  cache = null;
}
