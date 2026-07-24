import { create } from "zustand";
import { temporal } from "zundo";
import type { HouseConfig, HouseObject } from "../schema/houseConfig";
import { makeDefault, makeDefaultFloor, type AddableObjectType } from "./defaultFactory";
import { resolveParametric } from "../param/resolve";
import { reportFormulaWarnings } from "../param/warnings";

// Identity of the currently-selected object in the sidebar tree. `floor`
// is the index into HOUSE_CONFIG.floors; `object` is the index into that
// floor's objects array. `null` means nothing selected.
export interface Selection {
  floor: number;
  object: number;
}

interface ConfigState {
  config: HouseConfig | null;
  filename: string | null;
  // Full filesystem path — populated only when running inside Tauri and
  // the config was opened/saved via a native dialog. Used to distinguish
  // Save (write-in-place) from Save As (prompt for path).
  filePath: string | null;
  selection: Selection | null;
  // When true the PropertyPanel replaces its object form with the House
  // settings form (site + plinth). Mutually exclusive with `selection` —
  // picking an object clears it, and opening it clears the selection.
  siteEditorOpen: boolean;
  // When set, the PropertyPanel shows FloorPropertiesForm for that floor
  // index. Mutex with selection + siteEditorOpen (setter clears the
  // others, and picking an object / opening site editor clears this).
  floorEditorIdx: number | null;
  validationErrors: { path: string; message: string }[];
  dirty: boolean;

  loadConfig: (config: HouseConfig, filename?: string, filePath?: string | null) => void;
  setFilePath: (filePath: string | null) => void;
  // Clear the dirty flag after a successful save (Save / Save As).
  markSaved: () => void;
  clearConfig: () => void;
  select: (sel: Selection | null) => void;
  setSiteEditorOpen: (open: boolean) => void;
  setFloorEditor: (idx: number | null) => void;
  updateSite: (patch: Partial<HouseConfig["site"]>) => void;
  // Patches the house-level defaults block (floor_height / wall_height
  // / slab_thickness). Passing undefined for a field deletes it (so it
  // falls back to the code globals); passing a number sets it.
  updateDefaults: (patch: {
    floor_height?: number | undefined;
    wall_height?: number | undefined;
    slab_thickness?: number | undefined;
    wall_thickness?: number | undefined;
  }) => void;
  // Patches the house-level display-units block (system / per_unit /
  // precision). Display-only — geometry stays in project units. Passing
  // undefined for a field deletes it (falls back to feet & inches,
  // 10 units = 1 ft).
  updateUnits: (patch: {
    system?: NonNullable<HouseConfig["units"]>["system"] | undefined;
    per_unit?: number | undefined;
    precision?: number | undefined;
  }) => void;
  // Replaces the house-level 3D visibility layer list. Pass an empty array
  // or undefined to clear it (falls back to the built-in default layers).
  updateLayers: (layers: NonNullable<HouseConfig["layers"]> | undefined) => void;
  // Replace the house-level parametric `variables` / `points` tables. Pass an
  // empty object or undefined to clear (a non-parametric house). Both go
  // through the resolver seam, so editing a variable re-resolves every object
  // formula that references it.
  updateVariables: (variables: NonNullable<HouseConfig["variables"]> | undefined) => void;
  // Import a loaded .wadi (HouseConfig) as a reusable component (flatten its
  // floors→objects, copy variables/points, seed params from its variable names).
  importComponentFromWadi: (id: string, wadiConfig: HouseConfig) => void;
  updatePoints: (points: NonNullable<HouseConfig["points"]> | undefined) => void;
  // Owner-facing Configurator metadata (which variables/points a template
  // exposes to the Gharkul app + how to present them). Ignored by the resolver.
  updateConfigurator: (configurator: NonNullable<HouseConfig["configurator"]> | undefined) => void;
  // Patches a floor's top-level fields (name, height, slab_thickness).
  // The `objects` array is edited via updateObject / insertObject etc.
  updateFloor: (floorIdx: number, patch: Partial<HouseConfig["floors"][number]>) => void;

  // Object mutations — all bump `dirty` and are captured by the
  // temporal middleware so Cmd/Ctrl+Z rewinds them.
  updateObject: (sel: Selection, patch: Partial<HouseObject>) => void;
  replaceObject: (sel: Selection, next: HouseObject) => void;
  deleteObject: (sel: Selection) => void;
  duplicateObject: (sel: Selection) => Selection | null;
  insertObject: (floor: number, obj: HouseObject) => Selection;
  // Convenience wrappers used by Sidebar's "+" buttons. Both auto-select
  // the freshly created item so the property panel opens for editing.
  addObject: (floor: number, type: AddableObjectType) => Selection | null;
  addFloor: () => number | null;
  // Reorder a floor within the stack. delta -1 moves it DOWN (earlier in the
  // array = lower z), +1 moves it UP. floor_number is renumbered to the new
  // array index so it always tracks stack position. Returns the moved floor's
  // new index, or null if the move was out of range.
  moveFloor: (floorIdx: number, delta: number) => number | null;

  setValidationErrors: (errs: { path: string; message: string }[]) => void;
}

// Actions in this set do NOT participate in undo history — they'd
// otherwise pollute Cmd+Z with load events / selection moves / validator
// runs. Only the config-mutating ops are captured.
const NON_TRACKED_KEYS = new Set<keyof ConfigState>([
  "filename",
  "filePath",
  "selection",
  "validationErrors",
]);

export const useConfigStore = create<ConfigState>()(
  // <TState, Mps, Mcs, UState> — UState is the partialize slice (only
  // `config` participates in undo history; see partialize below).
  temporal<ConfigState, [], [], { config: HouseConfig | null }>(
    (rawSet, get) => {
      // Parametric resolution seam. Wrap `set` once here so EVERY mutation
      // (typed actions, loadConfig, duplicate, external watcher) that produces
      // a new `config` runs the resolver, and the resolved config lands in the
      // SAME set() — so undo captures user-edit + resolution as one snapshot
      // and all subscribers re-derive from resolved numbers. Patches without a
      // (truthy) `config` — selection setters, null-config early returns — pass
      // through untouched. Non-parametric houses hit the resolver's fast path
      // (same reference, zero cost), keeping existing behavior byte-identical.
      const set = ((partial: unknown, replace?: boolean) => {
        const wrap = (patch: unknown): unknown => {
          if (
            patch &&
            typeof patch === "object" &&
            "config" in patch &&
            (patch as { config?: unknown }).config
          ) {
            const { config, warnings } = resolveParametric(
              (patch as { config: HouseConfig }).config,
            );
            reportFormulaWarnings(warnings);
            return { ...(patch as object), config };
          }
          return patch;
        };
        const rs = rawSet as (p: unknown, r?: boolean) => void;
        if (typeof partial === "function") {
          return rs(
            (s: unknown) => wrap((partial as (s: unknown) => unknown)(s)),
            replace,
          );
        }
        return rs(wrap(partial), replace);
      }) as typeof rawSet;

      return {
      config: null,
      filename: null,
      filePath: null,
      selection: null,
      siteEditorOpen: false,
      floorEditorIdx: null,
      validationErrors: [],
      dirty: false,

      loadConfig: (config, filename, filePath) => {
        set({
          config,
          filename: filename ?? null,
          filePath: filePath ?? null,
          selection: null,
          siteEditorOpen: false,
          floorEditorIdx: null,
          validationErrors: [],
          dirty: false,
        });
        // Fresh load ⇒ clear undo history so Cmd+Z can't undo past
        // the load boundary into a previous file's state.
        useConfigStore.temporal.getState().clear();
      },

      setFilePath: (filePath) => set({ filePath }),

      markSaved: () => set({ dirty: false }),

      clearConfig: () => {
        set({
          config: null,
          filename: null,
          filePath: null,
          selection: null,
          siteEditorOpen: false,
          floorEditorIdx: null,
          validationErrors: [],
          dirty: false,
        });
        useConfigStore.temporal.getState().clear();
      },

      // Panel-selection setters — the three (selection / siteEditorOpen /
      // floorEditorIdx) are mutually exclusive. Whichever the user picks
      // last wins; the other two are cleared.
      select: (sel) =>
        set((state) => ({
          selection: sel,
          siteEditorOpen: sel ? false : state.siteEditorOpen,
          floorEditorIdx: sel ? null : state.floorEditorIdx,
        })),
      setSiteEditorOpen: (open) =>
        set((state) => ({
          siteEditorOpen: open,
          selection: open ? null : state.selection,
          floorEditorIdx: open ? null : state.floorEditorIdx,
        })),
      setFloorEditor: (idx) =>
        set((state) => ({
          floorEditorIdx: idx,
          selection: idx !== null ? null : state.selection,
          siteEditorOpen: idx !== null ? false : state.siteEditorOpen,
        })),

      updateSite: (patch) =>
        set((state) => {
          if (!state.config) return state;
          return {
            config: { ...state.config, site: { ...state.config.site, ...patch } },
            dirty: true,
          };
        }),

      updateDefaults: (patch) =>
        set((state) => {
          if (!state.config) return state;
          const cur = (state.config as { defaults?: Record<string, number> }).defaults ?? {};
          const next: Record<string, number> = { ...cur };
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined) delete next[k];
            else next[k] = v;
          }
          const cleaned: Record<string, number> | undefined =
            Object.keys(next).length === 0 ? undefined : next;
          return {
            config: { ...state.config, defaults: cleaned } as HouseConfig,
            dirty: true,
          };
        }),

      updateUnits: (patch) =>
        set((state) => {
          if (!state.config) return state;
          const cur =
            (state.config as { units?: Record<string, unknown> }).units ?? {};
          const next: Record<string, unknown> = { ...cur };
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined) delete next[k];
            else next[k] = v;
          }
          const cleaned =
            Object.keys(next).length === 0 ? undefined : next;
          return {
            config: { ...state.config, units: cleaned } as HouseConfig,
            dirty: true,
          };
        }),

      updateLayers: (layers) =>
        set((state) => {
          if (!state.config) return state;
          const cleaned = layers && layers.length > 0 ? layers : undefined;
          return {
            config: { ...state.config, layers: cleaned } as HouseConfig,
            dirty: true,
          };
        }),

      updateVariables: (variables) =>
        set((state) => {
          if (!state.config) return state;
          const cleaned =
            variables && Object.keys(variables).length > 0 ? variables : undefined;
          return {
            config: { ...state.config, variables: cleaned } as HouseConfig,
            dirty: true,
          };
        }),

      updateConfigurator: (configurator) =>
        set((state) => {
          if (!state.config) return state;
          const cleaned =
            configurator && configurator.inputs?.length ? configurator : undefined;
          return {
            config: { ...state.config, configurator: cleaned } as HouseConfig,
            dirty: true,
          };
        }),

      importComponentFromWadi: (id, wadiConfig) =>
        set((state) => {
          if (!state.config || !id) return state;
          const objects = (wadiConfig.floors ?? []).flatMap((f) => f.objects ?? []);
          const vars = wadiConfig.variables ?? {};
          // Only literal-number variables are treated as input params; `= formula`
          // variables are derived internals and stay out of the param list.
          const def = {
            name: id,
            variables: vars,
            points: wadiConfig.points,
            params: Object.entries(vars)
              .filter(([, v]) => typeof v === "number")
              .map(([name]) => ({ name })),
            objects,
          } as NonNullable<HouseConfig["components"]>[string];
          const components = { ...(state.config.components ?? {}), [id]: def };
          return { config: { ...state.config, components } as HouseConfig, dirty: true };
        }),

      updatePoints: (points) =>
        set((state) => {
          if (!state.config) return state;
          const cleaned =
            points && Object.keys(points).length > 0 ? points : undefined;
          return {
            config: { ...state.config, points: cleaned } as HouseConfig,
            dirty: true,
          };
        }),

      updateFloor: (floorIdx, patch) =>
        set((state) => {
          if (!state.config) return state;
          const floors = state.config.floors.map((f, i) =>
            i === floorIdx ? { ...f, ...patch } : f,
          );
          return {
            config: { ...state.config, floors },
            dirty: true,
          };
        }),

      updateObject: (sel, patch) =>
        set((state) => {
          if (!state.config) return state;
          return {
            config: mutateObject(state.config, sel, (o) => ({
              ...o,
              ...patch,
            }) as HouseObject),
            dirty: true,
          };
        }),

      replaceObject: (sel, next) =>
        set((state) => {
          if (!state.config) return state;
          return {
            config: mutateObject(state.config, sel, () => next),
            dirty: true,
          };
        }),

      deleteObject: (sel) =>
        set((state) => {
          if (!state.config) return state;
          const floors = state.config.floors.map((f, fi) => {
            if (fi !== sel.floor) return f;
            return {
              ...f,
              objects: f.objects.filter((_, oi) => oi !== sel.object),
            };
          });
          const nextSel = pickNearestSelection(state.config, sel);
          return {
            config: { ...state.config, floors },
            selection: nextSel,
            dirty: true,
          };
        }),

      duplicateObject: (sel) => {
        let newSel: Selection | null = null;
        set((state) => {
          if (!state.config) return state;
          const src = state.config.floors[sel.floor]?.objects[sel.object];
          if (!src) return state;
          const copy = structuredClone(src) as HouseObject;
          // Bump the name if it has one, otherwise leave the type alone.
          if ("name" in copy && typeof copy.name === "string") {
            copy.name = uniqueName(state.config, sel.floor, copy.name);
          }
          const floors = state.config.floors.map((f, fi) => {
            if (fi !== sel.floor) return f;
            const objects = [...f.objects];
            objects.splice(sel.object + 1, 0, copy);
            return { ...f, objects };
          });
          newSel = { floor: sel.floor, object: sel.object + 1 };
          return {
            config: { ...state.config, floors },
            selection: newSel,
            dirty: true,
          };
        });
        return newSel;
      },

      insertObject: (floor, obj) => {
        let sel: Selection = { floor, object: 0 };
        set((state) => {
          if (!state.config) return state;
          const floors = state.config.floors.map((f, fi) => {
            if (fi !== floor) return f;
            return { ...f, objects: [...f.objects, obj] };
          });
          sel = { floor, object: floors[floor].objects.length - 1 };
          return {
            config: { ...state.config, floors },
            selection: sel,
            dirty: true,
          };
        });
        return sel;
      },

      addObject: (floor, type) => {
        const state = get();
        if (!state.config) return null;
        const existing = state.config.floors[floor]?.objects ?? [];
        const obj = makeDefault(type, state.config, existing);
        return state.insertObject(floor, obj);
      },

      addFloor: () => {
        let newFloorIdx: number | null = null;
        set((state) => {
          if (!state.config) return state;
          const nextNumber =
            (state.config.floors[state.config.floors.length - 1]?.floor_number ?? -1) + 1;
          const nextFloor = makeDefaultFloor(state.config, nextNumber);
          const floors = [...state.config.floors, nextFloor];
          newFloorIdx = floors.length - 1;
          return {
            config: { ...state.config, floors },
            selection: null,
            dirty: true,
          };
        });
        return newFloorIdx;
      },

      moveFloor: (floorIdx, delta) => {
        let resultIdx: number | null = null;
        set((state) => {
          if (!state.config) return state;
          const floors = [...state.config.floors];
          const target = floorIdx + delta;
          if (
            floorIdx < 0 || floorIdx >= floors.length ||
            target < 0 || target >= floors.length
          ) {
            return state; // out of range — no-op
          }
          [floors[floorIdx], floors[target]] = [floors[target], floors[floorIdx]];
          // Keep floor_number == array index (= stack position, 0 = bottom).
          const renumbered = floors.map((f, i) => ({ ...f, floor_number: i }));
          resultIdx = target;
          return {
            config: { ...state.config, floors: renumbered },
            dirty: true,
          };
        });
        return resultIdx;
      },

      setValidationErrors: (validationErrors) => set({ validationErrors }),
      };
    },
    {
      // Only diff the `config` field for undo history — other state
      // (selection, validation, filename) is ephemeral and shouldn't
      // create undo entries.
      partialize: (state) => ({ config: state.config }),
      // Debounce rapid same-field edits so a single "typing" session
      // is one undo step, not one per keystroke.
      handleSet: (handleSet) => {
        let t: ReturnType<typeof setTimeout> | null = null;
        return (...args: unknown[]) => {
          if (t) clearTimeout(t);
          t = setTimeout(() => {
            (handleSet as (...a: unknown[]) => void)(...args);
            t = null;
          }, 250);
        };
      },
      limit: 100,
    },
  ),
);

// Read-only selectors used across components.
export const selectSelectedObject = (state: ConfigState): HouseObject | null => {
  if (!state.config || !state.selection) return null;
  return (
    state.config.floors[state.selection.floor]?.objects[state.selection.object] ??
    null
  );
};

// ---- helpers -------------------------------------------------------

function mutateObject(
  config: HouseConfig,
  sel: Selection,
  updater: (o: HouseObject) => HouseObject,
): HouseConfig {
  return {
    ...config,
    floors: config.floors.map((f, fi) => {
      if (fi !== sel.floor) return f;
      return {
        ...f,
        objects: f.objects.map((o, oi) => (oi === sel.object ? updater(o) : o)),
      };
    }),
  };
}

function pickNearestSelection(
  config: HouseConfig,
  removed: Selection,
): Selection | null {
  const floor = config.floors[removed.floor];
  if (!floor) return null;
  const newLen = floor.objects.length - 1;
  if (newLen <= 0) return null;
  return {
    floor: removed.floor,
    object: Math.min(removed.object, newLen - 1),
  };
}

function uniqueName(
  config: HouseConfig,
  floorIdx: number,
  base: string,
): string {
  const existing = new Set<string>();
  for (const o of config.floors[floorIdx]?.objects ?? []) {
    const n = (o as { name?: string }).name;
    if (typeof n === "string") existing.add(n);
  }
  let attempt = `${base}_copy`;
  let i = 2;
  while (existing.has(attempt)) attempt = `${base}_copy${i++}`;
  return attempt;
}

// Convenience hooks for temporal state (used by the undo/redo shortcut
// handler and the top-bar undo/redo buttons).
NON_TRACKED_KEYS satisfies Set<keyof ConfigState>;
