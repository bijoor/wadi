// Structured form for hip_roof objects. Replaces the read-only JSON
// dump we had while the roof stayed "opaque". Covers the fields the
// roof compute pipeline actually reads:
//
//   ridge_axis, ridge_h_ft, min_overhang_ft
//   framing.house_footprint_ft
//   trusses.type, trusses.positions
//   ridge_ventilation.{extension_ft, end_pani_patti, mesh_screen}
//   tile_density.{mangalore_per_sft, ceiling_per_sft, waste_pct}
//   metal_stock.{default_length_ft, cutting_waste_pct}
//
// Other keys survive untouched via the schema's catchall(z.unknown()).

import type { HouseObject } from "../schema/houseConfig";
import type { Selection } from "../state/configStore";
import { useConfigStore } from "../state/configStore";
import { NumberField, SelectField, TextField, Section } from "./fields";
import { FramingSection } from "./FramingSection";

type HipRoof = Extract<HouseObject, { type: "hip_roof" }>;
type Bag = Record<string, unknown>;

// Immutable-set helper: return a new object with `path` set to `value`.
// Undefined `value` deletes the leaf. Prunes empty objects on the way up.
function setPath(obj: Bag, path: string[], value: unknown): Bag {
  if (path.length === 0) return obj;
  const [head, ...rest] = path;
  if (rest.length === 0) {
    if (value === undefined) {
      const { [head]: _, ...next } = obj;
      void _;
      return next;
    }
    return { ...obj, [head]: value };
  }
  const child = (obj[head] as Bag | undefined) ?? {};
  const nextChild = setPath(child, rest, value);
  if (Object.keys(nextChild).length === 0) {
    const { [head]: _, ...next } = obj;
    void _;
    return next;
  }
  return { ...obj, [head]: nextChild };
}

function get<T>(obj: Bag, path: string[]): T | undefined {
  let cur: unknown = obj;
  for (const p of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Bag)[p];
  }
  return cur as T | undefined;
}

export function HipRoofForm({
  obj,
  selection,
}: {
  obj: HipRoof;
  selection: Selection;
}) {
  const replace = useConfigStore((s) => s.replaceObject);
  const bag = obj as unknown as Bag;

  // Every mutation goes through here — sets one leaf via setPath, then
  // hands the whole object back to the store. Casts are safe because
  // hip_roof has a `catchall(z.unknown())` schema.
  const setAt = (path: string[], value: unknown) => {
    const next = setPath(bag, path, value);
    replace(selection, next as unknown as HipRoof);
  };

  const positions = (get<number[]>(bag, ["trusses", "positions"]) ?? []).slice();
  const footprint = get<number[]>(bag, ["framing", "house_footprint_ft"]) ?? [];

  // dMax — max overhang from the eave to the ridge in project units. The
  // pipeline uses this to convert min_pitch_deg → ridge_h so the
  // steepest hip face still meets the requested pitch. Guaranteed same
  // formula the derivation uses (see roofGeometry.ts::deriveHipRoofGeometry).
  const houseTransU = (footprint[0] ?? 30) * 10;
  const houseLongU = (footprint[1] ?? 40) * 10;
  const ridgeYStart = positions[0] ?? houseLongU * 0.2;
  const ridgeYEnd = positions[positions.length - 1] ?? houseLongU * 0.8;
  const dMax = Math.max(houseTransU / 2, ridgeYStart, houseLongU - ridgeYEnd);

  const usingAngle = get<number>(bag, ["min_pitch_deg"]) !== undefined;

  return (
    <div>
      <Section title="Roof">
        <TextField
          label="Name"
          hint="Shown in the object tree. Optional."
          value={(get<string>(bag, ["name"]) as string | undefined) ?? ""}
          onCommit={(v) => setAt(["name"], v || undefined)}
        />
      </Section>

      <Section title="Roof geometry">
        <SelectField
          label="Ridge axis"
          value={(get<string>(bag, ["ridge_axis"]) as "x" | "y" | undefined) ?? "y"}
          onChange={(v) => setAt(["ridge_axis"], v)}
          options={[
            { value: "y", label: "y (ridge runs N–S)" },
            { value: "x", label: "x (ridge runs E–W)" },
          ]}
        />
        <SelectField
          label="Specify pitch by"
          value={usingAngle ? "angle" : "height"}
          onChange={(v) => {
            // Round-trip the current value between the two representations
            // via dMax so the user's pitch is preserved on toggle.
            if (v === "angle") {
              const h = get<number>(bag, ["ridge_h"]) ??
                (get<number>(bag, ["ridge_h_ft"]) ?? 0) * 10;
              const deg = dMax > 0 && h > 0
                ? Math.round((Math.atan2(h, dMax) * 180 / Math.PI) * 10) / 10
                : 30;
              setAt(["ridge_h"], undefined);
              setAt(["ridge_h_ft"], undefined);
              setAt(["min_pitch_deg"], deg);
            } else {
              const deg = get<number>(bag, ["min_pitch_deg"]) ?? 30;
              const h = Math.round(dMax * Math.tan(deg * Math.PI / 180));
              setAt(["min_pitch_deg"], undefined);
              setAt(["ridge_h_ft"], undefined);
              setAt(["ridge_h"], h);
            }
          }}
          options={[
            { value: "height", label: "Ridge height (units)" },
            { value: "angle", label: "Min pitch angle (°)" },
          ]}
        />
        <div className="grid grid-cols-2 gap-x-2">
          {usingAngle ? (
            <NumberField
              label="Min pitch"
              hint="degrees (0..90)"
              value={get<number>(bag, ["min_pitch_deg"])}
              onCommit={(v) => v !== undefined && setAt(["min_pitch_deg"], v)}
              min={0.1}
              max={89.9}
            />
          ) : (
            <NumberField
              label="Ridge height"
              hint="units above wall top"
              value={get<number>(bag, ["ridge_h"]) ??
                (get<number>(bag, ["ridge_h_ft"]) !== undefined
                  ? (get<number>(bag, ["ridge_h_ft"]) as number) * 10
                  : undefined)}
              onCommit={(v) => {
                if (v === undefined) return;
                // Migrate on edit: drop the legacy _ft key and write the unit form.
                setAt(["ridge_h_ft"], undefined);
                setAt(["ridge_h"], v);
              }}
              min={0.01}
            />
          )}
          <NumberField
            label="Min overhang"
            hint="units"
            value={get<number>(bag, ["min_overhang"]) ??
              (get<number>(bag, ["min_overhang_ft"]) !== undefined
                ? (get<number>(bag, ["min_overhang_ft"]) as number) * 10
                : undefined)}
            onCommit={(v) => {
              if (v === undefined) return;
              setAt(["min_overhang_ft"], undefined);
              setAt(["min_overhang"], v);
            }}
            min={0.01}
          />
        </div>
      </Section>

      <Section title="Position & footprint (Phase 2)">
        <div className="mb-2 text-[11px] text-slate-400">
          Roof rectangle in project units (10 units = 1 ft), matching
          rooms / floor_slab. Multiple roofs can be placed on the same
          floor at different positions to compose courtyards, L-shapes,
          etc. Blank = falls back to <code>framing.house_footprint_ft</code>
          at (0, 0).
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField
            label="X"
            hint="NW corner"
            value={get<number>(bag, ["x"])}
            onCommit={(v) => setAt(["x"], v)}
            allowEmpty
          />
          <NumberField
            label="Y"
            hint="NW corner"
            value={get<number>(bag, ["y"])}
            onCommit={(v) => setAt(["y"], v)}
            allowEmpty
          />
          <NumberField
            label="Width"
            hint="transverse (X)"
            value={get<number>(bag, ["width"])}
            onCommit={(v) => setAt(["width"], v)}
            allowEmpty
            min={0.01}
          />
          <NumberField
            label="Length"
            hint="longitudinal (Y)"
            value={get<number>(bag, ["length"])}
            onCommit={(v) => setAt(["length"], v)}
            allowEmpty
            min={0.01}
          />
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          Legacy fallback (feet — kept for existing configs):
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField
            label="Trans (ft)"
            value={footprint[0]}
            onCommit={(v) => {
              if (v === undefined) return;
              setAt(["framing", "house_footprint_ft"], [v, footprint[1] ?? 0]);
            }}
            allowEmpty
            min={0.01}
          />
          <NumberField
            label="Long (ft)"
            value={footprint[1]}
            onCommit={(v) => {
              if (v === undefined) return;
              setAt(["framing", "house_footprint_ft"], [footprint[0] ?? 0, v]);
            }}
            allowEmpty
            min={0.01}
          />
        </div>
      </Section>

      <Section
        title="Trusses"
        actions={
          <button
            type="button"
            onClick={() => {
              // Add a truss at the midpoint of the two furthest existing
              // ones, or seed with a plausible position if empty.
              const next = [...positions];
              if (next.length >= 2) {
                const mid = (next[0] + next[next.length - 1]) / 2;
                next.splice(1, 0, mid);
              } else if (next.length === 1) {
                next.push(next[0] + 100);
              } else {
                const long = (footprint[1] ?? 40) * 10;
                next.push(long * 0.2, long * 0.5, long * 0.8);
              }
              next.sort((a, b) => a - b);
              setAt(["trusses", "positions"], next);
            }}
            className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-normal text-emerald-300 hover:bg-slate-700"
            title="Add truss position"
          >
            + Truss
          </button>
        }
      >
        <div className="mb-2 text-[11px] text-slate-400">
          Fink-truss positions in project units along the ridge axis.
          Strictly increasing. First value must be &gt; 0; last must be
          &lt; longitudinal footprint in units (ft × 10).
        </div>
        <SelectField
          label="Truss type"
          value={(get<string>(bag, ["trusses", "type"]) as string | undefined) ?? "fink"}
          onChange={(v) => setAt(["trusses", "type"], v)}
          options={[{ value: "fink", label: "fink" }]}
        />
        {positions.length === 0 ? (
          <div className="rounded border border-amber-800 bg-amber-950/40 p-2 text-[11px] text-amber-200">
            No truss positions defined — the roof compute needs at least
            two. Click <b>+ Truss</b> above to seed with defaults.
          </div>
        ) : (
          positions.map((p, i) => (
            <div key={i} className="mb-1 flex items-center gap-2">
              <div className="flex-1">
                <NumberField
                  label={`Position #${i + 1}`}
                  value={p}
                  onCommit={(v) => {
                    if (v === undefined) return;
                    const next = [...positions];
                    next[i] = v;
                    setAt(["trusses", "positions"], next);
                  }}
                  min={0.01}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = positions.filter((_, j) => j !== i);
                  setAt(["trusses", "positions"], next);
                }}
                className="mt-4 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-normal text-red-300 hover:bg-red-900"
                title="Remove this truss"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </Section>

      <FramingSection bag={bag} setAt={setAt} />

      <Section title="Ridge ventilation (optional)">
        <NumberField
          label="Ridge extension (ft)"
          hint="0 disables the vent"
          value={get<number>(bag, ["ridge_ventilation", "extension_ft"])}
          onCommit={(v) =>
            setAt(
              ["ridge_ventilation", "extension_ft"],
              v === undefined || v === 0 ? undefined : v,
            )
          }
          allowEmpty
          min={0}
        />
      </Section>

      <Section title="Tile density (BOM)">
        <div className="mb-2 text-[11px] text-slate-400">
          Drives the Roof material BOM. Blank = default (1.33 / 1.5 tiles
          per sft, 10 % waste).
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField
            label="Mangalore /sft"
            value={get<number>(bag, ["tile_density", "mangalore_per_sft"])}
            onCommit={(v) => setAt(["tile_density", "mangalore_per_sft"], v)}
            allowEmpty
            min={0.01}
          />
          <NumberField
            label="Ceiling /sft"
            value={get<number>(bag, ["tile_density", "ceiling_per_sft"])}
            onCommit={(v) => setAt(["tile_density", "ceiling_per_sft"], v)}
            allowEmpty
            min={0.01}
          />
          <NumberField
            label="Waste (0..1)"
            hint="0.10 = 10 %"
            value={get<number>(bag, ["tile_density", "waste_pct"])}
            onCommit={(v) => setAt(["tile_density", "waste_pct"], v)}
            allowEmpty
            min={0}
            max={1}
          />
        </div>
      </Section>

      <Section title="Metal stock (BOM)">
        <div className="mb-2 text-[11px] text-slate-400">
          Stock length + cutting waste for the Metal BOM's pieces-to-order
          calc. Blank = default (20 ft, 0 % waste).
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField
            label="Stock length (ft)"
            value={get<number>(bag, ["metal_stock", "default_length_ft"])}
            onCommit={(v) => setAt(["metal_stock", "default_length_ft"], v)}
            allowEmpty
            min={0.01}
          />
          <NumberField
            label="Cutting waste"
            hint="0.05 = 5 %"
            value={get<number>(bag, ["metal_stock", "cutting_waste_pct"])}
            onCommit={(v) => setAt(["metal_stock", "cutting_waste_pct"], v)}
            allowEmpty
            min={0}
            max={1}
          />
        </div>
      </Section>

      <Section title="Material">
        <TextField
          label="Material key"
          value={get<string>(bag, ["material"])}
          onCommit={(v) => setAt(["material"], v || undefined)}
          placeholder="palette key from GLOBAL_CONFIG.colors"
        />
      </Section>
    </div>
  );
}
