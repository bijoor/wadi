// Editor for the two top-level house fields — site and plinth. Rendered
// by PropertyPanel when useConfigStore.siteEditorOpen is true (toggled
// from the Sidebar's "🏠 House settings" button).
//
// site: plot dimensions + reference origin
// plinth: raised base rectangle + height

import { useConfigStore } from "../state/configStore";
import { NumberField, SelectField, TextField, Section } from "./fields";
import { DEFAULT_GLOBAL_CONFIG } from "../svg2d/config";
import { resolveLayers } from "../three/layers";

type UnitSystem =
  | "feet_inches"
  | "feet"
  | "meters"
  | "centimeters"
  | "millimeters";

const UNIT_SYSTEM_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: "feet_inches", label: "Feet & inches (12' 6\")" },
  { value: "feet", label: "Feet (decimal, 12.5')" },
  { value: "meters", label: "Meters (3.81 m)" },
  { value: "centimeters", label: "Centimeters (381 cm)" },
  { value: "millimeters", label: "Millimeters (3810 mm)" },
];

export function HouseSettingsForm() {
  const config = useConfigStore((s) => s.config);
  const updateSite = useConfigStore((s) => s.updateSite);
  const updatePlinth = useConfigStore((s) => s.updatePlinth);
  const updateDefaults = useConfigStore((s) => s.updateDefaults);
  const updateUnits = useConfigStore((s) => s.updateUnits);

  if (!config) return null;
  const site = config.site;
  const plinth = config.plinth;
  const defaults = (config as { defaults?: { floor_height?: number; wall_height?: number; slab_thickness?: number; wall_thickness?: number } }).defaults ?? {};
  const units = (config as { units?: { system?: UnitSystem; per_unit?: number; precision?: number } }).units ?? {};
  const unitSystem: UnitSystem = units.system ?? "feet_inches";

  return (
    <div>
      <Section title="Site (plot dimensions)">
        <div className="mb-2 text-[11px] text-slate-400">
          Overall plot the house sits on. Units follow the project
          convention: 10 units = 1 ft.
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField
            label="Plot width"
            hint="X extent (units)"
            value={site.plot_width}
            onCommit={(v) => v !== undefined && updateSite({ plot_width: v })}
            min={0.01}
          />
          <NumberField
            label="Plot length"
            hint="Y extent (units)"
            value={site.plot_length}
            onCommit={(v) => v !== undefined && updateSite({ plot_length: v })}
            min={0.01}
          />
          <NumberField
            label="Reference X"
            hint="origin offset"
            value={site.reference_x}
            onCommit={(v) => v !== undefined && updateSite({ reference_x: v })}
          />
          <NumberField
            label="Reference Y"
            hint="origin offset"
            value={site.reference_y}
            onCommit={(v) => v !== undefined && updateSite({ reference_y: v })}
          />
        </div>
      </Section>

      <Section title="Plinth (raised base)">
        <div className="mb-2 text-[11px] text-slate-400">
          Raised base on which the ground floor sits. Usually matches the
          plot in width/length. Height is how tall the plinth stands
          above ground.
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField
            label="X"
            hint="offset from plot NW corner"
            value={plinth.x}
            onCommit={(v) => v !== undefined && updatePlinth({ x: v })}
          />
          <NumberField
            label="Y"
            hint="offset from plot NW corner"
            value={plinth.y}
            onCommit={(v) => v !== undefined && updatePlinth({ y: v })}
          />
          <NumberField
            label="Width"
            hint="X extent"
            value={plinth.width}
            onCommit={(v) => v !== undefined && updatePlinth({ width: v })}
            min={0.01}
          />
          <NumberField
            label="Length"
            hint="Y extent"
            value={plinth.length}
            onCommit={(v) => v !== undefined && updatePlinth({ length: v })}
            min={0.01}
          />
          <NumberField
            label="Height"
            hint="above ground"
            value={plinth.height}
            onCommit={(v) => v !== undefined && updatePlinth({ height: v })}
            min={0.01}
          />
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          Tip: per-floor heights + slab thickness live on each floor —
          pick a floor in the sidebar, then click{" "}
          <b>⚙ Floor settings</b>.
        </div>
      </Section>

      <Section title="Defaults (used by any floor without an override)">
        <div className="mb-2 text-[11px] text-slate-400">
          House-wide fallbacks used when a floor doesn't specify its own
          <code className="mx-1 rounded bg-slate-800 px-1">height</code> /
          <code className="mx-1 rounded bg-slate-800 px-1">wall_height</code> /
          <code className="mx-1 rounded bg-slate-800 px-1">slab_thickness</code> /
          <code className="mx-1 rounded bg-slate-800 px-1">wall_thickness</code>.
          Leave blank to fall back to the built-in code defaults
          ({DEFAULT_GLOBAL_CONFIG.floor_height} /{" "}
          {DEFAULT_GLOBAL_CONFIG.wall_height} /{" "}
          {DEFAULT_GLOBAL_CONFIG.floor_slab_thickness} /{" "}
          {DEFAULT_GLOBAL_CONFIG.wall_thickness}). All are independent — no
          relationship enforced. Wall thickness is house-wide; a room or wall
          can still override it per-object.
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField
            label="Floor height"
            hint={`code default ${DEFAULT_GLOBAL_CONFIG.floor_height}`}
            value={defaults.floor_height}
            onCommit={(v) => updateDefaults({ floor_height: v })}
            allowEmpty
            min={0.01}
          />
          <NumberField
            label="Wall height"
            hint={`code default ${DEFAULT_GLOBAL_CONFIG.wall_height}`}
            value={defaults.wall_height}
            onCommit={(v) => updateDefaults({ wall_height: v })}
            allowEmpty
            min={0.01}
          />
          <NumberField
            label="Slab thickness"
            hint={`code default ${DEFAULT_GLOBAL_CONFIG.floor_slab_thickness}`}
            value={defaults.slab_thickness}
            onCommit={(v) => updateDefaults({ slab_thickness: v })}
            allowEmpty
            min={0}
          />
          <NumberField
            label="Wall thickness"
            hint={`house-wide · code default ${DEFAULT_GLOBAL_CONFIG.wall_thickness}`}
            value={defaults.wall_thickness}
            onCommit={(v) => updateDefaults({ wall_thickness: v })}
            allowEmpty
            min={0.01}
          />
        </div>
      </Section>

      <Section title="Dimension units (drawing labels)">
        <div className="mb-2 text-[11px] text-slate-400">
          How lengths are <b>labelled</b> on the plans, elevations and
          sections. Display-only — the geometry always stays in project
          units. <b>Units per display unit</b> is how many project units
          equal one label unit (10 → 10 units = 1 ft; 100 → 100 units = 1 m).
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <div className="col-span-2">
            <SelectField<UnitSystem>
              label="System"
              hint="default: feet & inches"
              value={unitSystem}
              options={UNIT_SYSTEM_OPTIONS}
              onChange={(v) => updateUnits({ system: v })}
            />
          </div>
          <NumberField
            label="Units per display unit"
            hint={`default ${DEFAULT_GLOBAL_CONFIG.dimensions.unit_conversion}`}
            value={units.per_unit}
            onCommit={(v) => updateUnits({ per_unit: v })}
            allowEmpty
            min={0.0001}
          />
          <NumberField
            label="Precision"
            hint="decimals · decimal systems only"
            value={units.precision}
            onCommit={(v) => updateUnits({ precision: v })}
            allowEmpty
            min={0}
            disabled={unitSystem === "feet_inches"}
          />
        </div>
      </Section>

      <LayersSection />
    </div>
  );
}

// -------------------------------------------------------------------
// Layers editor — manage the house's 3D visibility layers. Objects are
// assigned to a layer via the per-object "Layer" dropdown; the layers
// menu in the 3D view toggles whole layers. When the house has no custom
// list yet, this shows the built-in defaults and materializes them into
// the config on the first edit.
// -------------------------------------------------------------------
function LayersSection() {
  const config = useConfigStore((s) => s.config);
  const updateLayers = useConfigStore((s) => s.updateLayers);
  const layers = resolveLayers(config);

  const commit = (next: { id: string; label: string; color?: string }[]) =>
    updateLayers(next);

  const patchAt = (
    i: number,
    patch: Partial<{ id: string; label: string; color: string }>,
  ) => commit(layers.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const removeAt = (i: number) => commit(layers.filter((_, j) => j !== i));

  // Swap a layer with its neighbour. Array order = display order in the
  // 3D view's 📚 layers menu, so this reorders the menu.
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= layers.length) return;
    const next = layers.slice();
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  const add = () => {
    // Unique id: layerN not already taken.
    const taken = new Set(layers.map((l) => l.id));
    let n = layers.length + 1;
    while (taken.has(`layer${n}`)) n++;
    commit([...layers, { id: `layer${n}`, label: `Layer ${n}`, color: "#888888" }]);
  };

  return (
    <Section title="Layers (3D visibility)">
      <div className="mb-2 text-[11px] text-slate-400">
        Toggle-able groups in the 3D view's 📚 layers menu. Assign an object
        to a layer with the <b>Layer</b> dropdown at the top of its editor;
        unassigned objects fall back to an automatic mapping. Use <b>▲▼</b> to
        reorder — the list order is the menu order. Editing here overrides the
        built-in defaults for this house.
      </div>
      <div className="space-y-1">
        {layers.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded-t bg-slate-800 px-1 text-[9px] leading-tight text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                title="Move up"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === layers.length - 1}
                className="rounded-b bg-slate-800 px-1 text-[9px] leading-tight text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                title="Move down"
              >
                ▼
              </button>
            </div>
            <input
              type="color"
              value={l.color ?? "#888888"}
              onChange={(e) => patchAt(i, { color: e.target.value })}
              className="h-6 w-6 shrink-0 cursor-pointer rounded border border-slate-700 bg-transparent"
              title="Layer colour"
            />
            <div className="flex-1">
              <TextField
                label=""
                value={l.label}
                onCommit={(v) => patchAt(i, { label: v || l.id })}
              />
            </div>
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="shrink-0 rounded bg-slate-800 px-2 py-1 text-[10px] text-red-300 hover:bg-red-900"
              title="Remove layer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={add}
          className="rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-600"
        >
          + Add layer
        </button>
        <button
          type="button"
          onClick={() => updateLayers(undefined)}
          className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
          title="Clear the custom list and use the built-in default layers"
        >
          Reset to defaults
        </button>
      </div>
      <div className="mt-1 text-[10px] text-slate-500">
        Removing a layer that objects are assigned to leaves those objects
        pointing at a missing id — they'll appear under that id in the menu
        until reassigned.
      </div>
    </Section>
  );
}
