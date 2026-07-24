// Editor for the two top-level house fields — site and plinth. Rendered
// by PropertyPanel when useConfigStore.siteEditorOpen is true (toggled
// from the Sidebar's "🏠 House settings" button).
//
// site: plot dimensions + reference origin
// plinth: raised base rectangle + height

import type { HouseConfig } from "../schema/houseConfig";
import { useConfigStore } from "../state/configStore";
import { pickAndLoadConfig } from "../io/fileIO";
import { symbolError } from "../param/resolve";
import { NumberField, SelectField, TextField, Section, ObjectMeasureField } from "./fields";
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
  const updateDefaults = useConfigStore((s) => s.updateDefaults);
  const updateUnits = useConfigStore((s) => s.updateUnits);

  if (!config) return null;
  const site = config.site;
  const defaults = (config as { defaults?: { floor_height?: number; wall_height?: number; slab_thickness?: number; wall_thickness?: number } }).defaults ?? {};
  const units = (config as { units?: { system?: UnitSystem; per_unit?: number; precision?: number } }).units ?? {};
  const unitSystem: UnitSystem = units.system ?? "feet_inches";

  // Formula-aware patch adapters for the smart ObjectMeasureField. Each routes
  // to the group's store action (which merges, including the `formulas` map).
  const sitePatch = (p: Record<string, unknown>) => updateSite(p as Partial<HouseConfig["site"]>);
  const defaultsPatch = (p: Record<string, unknown>) =>
    updateDefaults(p as Parameters<typeof updateDefaults>[0]);
  const siteObj = site as unknown as Record<string, unknown>;
  const defaultsObj = defaults as unknown as Record<string, unknown>;

  return (
    <div>
      <Section title="Site (plot dimensions)">
        <div className="mb-2 text-[11px] text-slate-400">
          Overall plot the house sits on. Units follow the project
          convention: 10 units = 1 ft.
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <ObjectMeasureField object={siteObj} field="plot_width" label="Plot width" hint="X extent (units)" patch={sitePatch} min={0.01} />
          <ObjectMeasureField object={siteObj} field="plot_length" label="Plot length" hint="Y extent (units)" patch={sitePatch} min={0.01} />
          <ObjectMeasureField object={siteObj} field="reference_x" label="Reference X" hint="origin offset" patch={sitePatch} />
          <ObjectMeasureField object={siteObj} field="reference_y" label="Reference Y" hint="origin offset" patch={sitePatch} />
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
          <ObjectMeasureField object={defaultsObj} field="floor_height" label="Floor height" hint={`code default ${DEFAULT_GLOBAL_CONFIG.floor_height}`} patch={defaultsPatch} allowEmpty min={0.01} />
          <ObjectMeasureField object={defaultsObj} field="wall_height" label="Wall height" hint={`code default ${DEFAULT_GLOBAL_CONFIG.wall_height}`} patch={defaultsPatch} allowEmpty min={0.01} />
          <ObjectMeasureField object={defaultsObj} field="slab_thickness" label="Slab thickness" hint={`code default ${DEFAULT_GLOBAL_CONFIG.floor_slab_thickness}`} patch={defaultsPatch} allowEmpty min={0} />
          <ObjectMeasureField object={defaultsObj} field="wall_thickness" label="Wall thickness" hint={`house-wide · code default ${DEFAULT_GLOBAL_CONFIG.wall_thickness}`} patch={defaultsPatch} allowEmpty min={0.01} />
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

      <VariablesSection />
      <PointsSection />
      <ConfiguratorSection />
      <ComponentsSection />

      <LayersSection />
    </div>
  );
}

// -------------------------------------------------------------------
// Parametric variables & points (plans/object-relationships-plan.md). Named
// house-level values that object fields can reference via "= formula". A value
// is a formula iff it starts with "="; otherwise a plain number. Editing a
// variable re-resolves every object formula that references it (through the
// store's resolver seam).
// -------------------------------------------------------------------

// Parse a text value into a stored variable value: "= expr" stays a formula
// string; a finite number is stored as a number; anything else is kept as the
// raw string (the resolver will warn).
function parseVarValue(raw: string): number | string {
  const v = raw.trim();
  if (v.startsWith("=")) return v;
  if (v !== "" && Number.isFinite(Number(v))) return Number(v);
  return v;
}
const varValueStr = (val: number | string | undefined): string =>
  val === undefined ? "" : typeof val === "number" ? String(val) : val;

// Compact stacked ▲▼ reorder buttons (mirrors the Layers editor).
function MoveButtons({
  i,
  count,
  onMove,
}: {
  i: number;
  count: number;
  onMove: (i: number, dir: -1 | 1) => void;
}) {
  return (
    <div className="flex shrink-0 flex-col pb-1">
      <button
        type="button"
        onClick={() => onMove(i, -1)}
        disabled={i === 0}
        className="rounded-t bg-slate-800 px-1 text-[9px] leading-tight text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
        title="Move up"
      >
        ▲
      </button>
      <button
        type="button"
        onClick={() => onMove(i, 1)}
        disabled={i === count - 1}
        className="rounded-b bg-slate-800 px-1 text-[9px] leading-tight text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
        title="Move down"
      >
        ▼
      </button>
    </div>
  );
}

function VariablesSection() {
  const config = useConfigStore((s) => s.config);
  const updateVariables = useConfigStore((s) => s.updateVariables);
  const vars = ((config as { variables?: Record<string, number | string> })?.variables ??
    {}) as Record<string, number | string>;
  const entries = Object.entries(vars);

  const commit = (next: Record<string, number | string>) =>
    updateVariables(Object.keys(next).length > 0 ? next : undefined);

  const setValueAt = (key: string, raw: string) =>
    commit({ ...vars, [key]: parseVarValue(raw) });

  const renameAt = (oldKey: string, newKeyRaw: string) => {
    const newKey = newKeyRaw.trim();
    if (!newKey || newKey === oldKey || newKey in vars) return;
    const next: Record<string, number | string> = {};
    for (const [k, val] of entries) next[k === oldKey ? newKey : k] = val;
    commit(next);
  };

  const removeAt = (key: string) => {
    const next = { ...vars };
    delete next[key];
    commit(next);
  };

  const add = () => {
    const taken = new Set(Object.keys(vars));
    let n = entries.length + 1;
    while (taken.has(`v${n}`)) n++;
    commit({ ...vars, [`v${n}`]: 0 });
  };

  // Reorder rows for legibility. Purely cosmetic — the resolver is
  // order-independent (it topologically resolves regardless of row order).
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= entries.length) return;
    const next = entries.slice();
    [next[i], next[j]] = [next[j], next[i]];
    commit(Object.fromEntries(next));
  };

  return (
    <Section title="Variables (parametric)">
      <div className="mb-2 text-[11px] text-slate-400">
        Named values object fields can reference. A value starting with{" "}
        <code className="mx-0.5 rounded bg-slate-800 px-1">=</code> is a formula
        and may reference other variables (e.g.{" "}
        <code className="mx-0.5 rounded bg-slate-800 px-1">= colA + bay</code>).
        Type <code className="mx-0.5 rounded bg-slate-800 px-1">= name</code> in
        any object coordinate field to bind it.
      </div>
      <div className="space-y-1">
        {entries.map(([key, val], i) => {
          const err = symbolError(config, `variables/${key}`);
          return (
          <div key={key} className="flex items-end gap-2">
            <MoveButtons i={i} count={entries.length} onMove={move} />
            <div className="flex-1">
              <TextField label="" value={key} onCommit={(v) => renameAt(key, v)} />
            </div>
            <span className="pb-1.5 text-slate-500">=</span>
            <div className="flex-1">
              <TextField
                label=""
                value={varValueStr(val)}
                onCommit={(v) => setValueAt(key, v)}
                placeholder="number or = formula"
                error={err ?? undefined}
              />
            </div>
            <span
              className="w-4 shrink-0 pb-1.5 text-center text-[11px] text-red-400"
              title={err ?? undefined}
            >
              {err ? "⚠" : ""}
            </span>
            <button
              type="button"
              onClick={() => removeAt(key)}
              className="mb-1 shrink-0 rounded bg-slate-800 px-2 py-1 text-[10px] text-red-300 hover:bg-red-900"
              title="Remove variable"
            >
              ✕
            </button>
          </div>
          );
        })}
        {entries.length === 0 && (
          <div className="text-[11px] text-slate-500">No variables yet.</div>
        )}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-600"
      >
        + Add variable
      </button>
    </Section>
  );
}

// Author the Gharkul (owner) configurator: expose variables/points as friendly
// inputs. Writes config.configurator; ignored by the resolver / geometry.
type CfgInput = NonNullable<HouseConfig["configurator"]>["inputs"][number];
const CFG_UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "— (raw)" },
  { value: "ft", label: "Feet" },
  { value: "in", label: "Inches" },
  { value: "m", label: "Meters" },
  { value: "percent", label: "Percent" },
  { value: "count", label: "Count" },
];

function ConfiguratorSection() {
  const config = useConfigStore((s) => s.config);
  const updateConfigurator = useConfigStore((s) => s.updateConfigurator);
  const cfg = ((config as { configurator?: NonNullable<HouseConfig["configurator"]> })?.configurator ??
    { inputs: [] }) as NonNullable<HouseConfig["configurator"]>;
  const inputs = cfg.inputs ?? [];

  const vars = Object.keys((config as { variables?: Record<string, unknown> })?.variables ?? {});
  const points = Object.keys((config as { points?: Record<string, unknown> })?.points ?? {});
  const targetOptions = [...points.flatMap((p) => [`${p}.W`, `${p}.L`]), ...vars].map((t) => ({
    value: t,
    label: t,
  }));

  const commit = (nextInputs: CfgInput[], patch: Partial<typeof cfg> = {}) => {
    const next = { ...cfg, ...patch, inputs: nextInputs } as NonNullable<HouseConfig["configurator"]>;
    updateConfigurator(nextInputs.length ? next : undefined);
  };
  const setAt = (i: number, patch: Record<string, unknown>) =>
    commit(inputs.map((inp, j) => (j === i ? ({ ...inp, ...patch } as CfgInput) : inp)));
  const removeAt = (i: number) => commit(inputs.filter((_, j) => j !== i));
  const add = () => {
    const target = targetOptions[0]?.value ?? "";
    commit([...inputs, { target, label: target, unit: "ft" } as CfgInput]);
  };

  return (
    <Section title="Configurator (Gharkul owner inputs)">
      <div className="mb-2 text-[11px] text-slate-400">
        Expose a few variables / points to the <b>Gharkul</b> owner app as friendly
        controls. Each input targets a variable or a point's <code>.W</code>/<code>.L</code>,
        with a label, unit and range (min/max in raw project units).
      </div>
      <TextField
        label="Panel title"
        value={cfg.title ?? ""}
        onCommit={(v) => commit(inputs, { title: v || undefined })}
        placeholder="e.g. Configure your home"
      />
      <div className="mt-2 space-y-2">
        {inputs.map((inp, i) => (
          <div key={i} className="rounded border border-slate-700 p-2">
            <div className="mb-1 flex items-end gap-2">
              <div className="flex-1">
                <SelectField
                  label="Target"
                  value={inp.target}
                  options={targetOptions.length ? targetOptions : [{ value: inp.target, label: inp.target }]}
                  onChange={(v) => setAt(i, { target: v, label: inp.label || v })}
                />
              </div>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="mb-1 shrink-0 rounded bg-slate-800 px-2 py-1 text-[10px] text-red-300 hover:bg-red-900"
                title="Remove input"
              >
                ✕
              </button>
            </div>
            <TextField label="Label" value={inp.label} onCommit={(v) => setAt(i, { label: v })} />
            <TextField
              label="Description"
              value={inp.description ?? ""}
              onCommit={(v) => setAt(i, { description: v || undefined })}
              placeholder="optional help text"
            />
            <div className="grid grid-cols-2 gap-x-2">
              <SelectField
                label="Unit"
                value={inp.unit ?? "none"}
                options={CFG_UNIT_OPTIONS}
                onChange={(v) => setAt(i, { unit: v === "none" ? undefined : v })}
              />
              <TextField
                label="Group"
                value={inp.group ?? ""}
                onCommit={(v) => setAt(i, { group: v || undefined })}
                placeholder="e.g. size"
              />
              <NumberField label="Min" value={inp.min} onCommit={(v) => setAt(i, { min: v })} allowEmpty />
              <NumberField label="Max" value={inp.max} onCommit={(v) => setAt(i, { max: v })} allowEmpty />
              <NumberField label="Step" value={inp.step} onCommit={(v) => setAt(i, { step: v })} allowEmpty min={0} />
            </div>
          </div>
        ))}
        {inputs.length === 0 && (
          <div className="text-[11px] text-slate-500">No owner inputs exposed yet.</div>
        )}
      </div>
      <button
        type="button"
        onClick={add}
        disabled={!targetOptions.length}
        className="mt-2 rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-600 disabled:opacity-40"
      >
        + Add input
      </button>
    </Section>
  );
}

function PointsSection() {
  const config = useConfigStore((s) => s.config);
  const updatePoints = useConfigStore((s) => s.updatePoints);
  const points = ((config as {
    points?: Record<string, { x: number | string; y: number | string }>;
  })?.points ?? {}) as Record<string, { x: number | string; y: number | string }>;
  const entries = Object.entries(points);

  const commit = (next: Record<string, { x: number | string; y: number | string }>) =>
    updatePoints(Object.keys(next).length > 0 ? next : undefined);

  const setAxisAt = (key: string, axis: "x" | "y", raw: string) =>
    commit({ ...points, [key]: { ...points[key], [axis]: parseVarValue(raw) } });

  const renameAt = (oldKey: string, newKeyRaw: string) => {
    const newKey = newKeyRaw.trim();
    if (!newKey || newKey === oldKey || newKey in points) return;
    const next: Record<string, { x: number | string; y: number | string }> = {};
    for (const [k, val] of entries) next[k === oldKey ? newKey : k] = val;
    commit(next);
  };

  const removeAt = (key: string) => {
    const next = { ...points };
    delete next[key];
    commit(next);
  };

  const add = () => {
    const taken = new Set(Object.keys(points));
    let n = entries.length + 1;
    while (taken.has(`P${n}`)) n++;
    commit({ ...points, [`P${n}`]: { x: 0, y: 0 } });
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= entries.length) return;
    const next = entries.slice();
    [next[i], next[j]] = [next[j], next[i]];
    commit(Object.fromEntries(next));
  };

  return (
    <Section title="Points (parametric)">
      <div className="mb-2 text-[11px] text-slate-400">
        Named 2D anchors. Each x/y is a number or{" "}
        <code className="mx-0.5 rounded bg-slate-800 px-1">= formula</code> over
        variables/points. Reference a field with{" "}
        <code className="mx-0.5 rounded bg-slate-800 px-1">= P1.x</code>. Synonyms
        (either case):{" "}
        <code className="mx-0.5 rounded bg-slate-800 px-1">.w</code>/
        <code className="mx-0.5 rounded bg-slate-800 px-1">.W</code> = x and{" "}
        <code className="mx-0.5 rounded bg-slate-800 px-1">.l</code>/
        <code className="mx-0.5 rounded bg-slate-800 px-1">.L</code> = y, so a point
        can double as an in-plan rectangle size.
      </div>
      <div className="space-y-1">
        {entries.map(([key, pt], i) => {
          const ex = symbolError(config, `points/${key}.x`);
          const ey = symbolError(config, `points/${key}.y`);
          const err = ex ?? ey ?? null;
          return (
          <div key={key} className="flex items-end gap-2">
            <MoveButtons i={i} count={entries.length} onMove={move} />
            <div className="w-20 shrink-0">
              <TextField label="" value={key} onCommit={(v) => renameAt(key, v)} />
            </div>
            <div className="flex-1">
              <TextField
                label=""
                value={varValueStr(pt.x)}
                onCommit={(v) => setAxisAt(key, "x", v)}
                placeholder="x"
                error={ex ?? undefined}
              />
            </div>
            <div className="flex-1">
              <TextField
                label=""
                value={varValueStr(pt.y)}
                onCommit={(v) => setAxisAt(key, "y", v)}
                placeholder="y"
                error={ey ?? undefined}
              />
            </div>
            <span
              className="w-4 shrink-0 pb-1.5 text-center text-[11px] text-red-400"
              title={err ?? undefined}
            >
              {err ? "⚠" : ""}
            </span>
            <button
              type="button"
              onClick={() => removeAt(key)}
              className="mb-1 shrink-0 rounded bg-slate-800 px-2 py-1 text-[10px] text-red-300 hover:bg-red-900"
              title="Remove point"
            >
              ✕
            </button>
          </div>
          );
        })}
        {entries.length === 0 && (
          <div className="text-[11px] text-slate-500">No points yet.</div>
        )}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-600"
      >
        + Add point
      </button>
    </Section>
  );
}

// -------------------------------------------------------------------
// Layers editor — manage the house's 3D visibility layers. Objects are
// assigned to a layer via the per-object "Layer" dropdown; the layers
// menu in the 3D view toggles whole layers. When the house has no custom
// list yet, this shows the built-in defaults and materializes them into
// the config on the first edit.
// -------------------------------------------------------------------
function ComponentsSection() {
  const config = useConfigStore((s) => s.config);
  const importComponentFromWadi = useConfigStore((s) => s.importComponentFromWadi);
  if (!config) return null;
  const components = (config.components ?? {}) as Record<
    string,
    { name?: string; params?: unknown[]; objects?: unknown[] }
  >;
  const ids = Object.keys(components);

  const importWadi = async () => {
    try {
      const loaded = await pickAndLoadConfig();
      if (!loaded) return;
      const id = (loaded.filename || "component")
        .replace(/\.(wadi|json)$/i, "")
        .replace(/[^a-z0-9_]+/gi, "_");
      importComponentFromWadi(id, loaded.config);
    } catch (e) {
      const msg = (e as Error).message;
      if (!/cancel/i.test(msg)) alert("Import failed: " + msg);
    }
  };

  return (
    <Section title="Components (reusable library)">
      <div className="mb-2 text-[11px] text-slate-400">
        Parameterized sub-models, stored once and placed via a <b>Component</b>{" "}
        object. Editing a definition updates every instance.
      </div>
      {ids.length === 0 ? (
        <div className="mb-2 text-[11px] text-slate-500">No components yet.</div>
      ) : (
        <ul className="mb-2 space-y-1">
          {ids.map((id) => (
            <li key={id} className="flex items-center justify-between text-xs">
              <span className="text-slate-200">
                {components[id].name ?? id}{" "}
                <span className="text-slate-500">({id})</span>
              </span>
              <span className="text-slate-500">
                {components[id].params?.length ?? 0} params ·{" "}
                {components[id].objects?.length ?? 0} objs
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={importWadi}
          className="rounded border border-slate-700 px-2 py-1 text-xs text-emerald-300 hover:bg-slate-800"
        >
          Import .wadi as component…
        </button>
      </div>
    </Section>
  );
}

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
