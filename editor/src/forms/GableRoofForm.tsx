// Structured form for gable_roof objects. Similar shape to HipRoofForm
// but without the truss list (Phase 1a — trusses land in 1b) and with
// a gable-specific "gable_overhang_ft" field for optional overhang past
// the ridge ends.

import type { HouseObject } from "../schema/houseConfig";
import type { Selection } from "../state/configStore";
import { useConfigStore } from "../state/configStore";
import { NumberField, SelectField, TextField, Section } from "./fields";
import { FramingSection } from "./FramingSection";

type GableRoof = Extract<HouseObject, { type: "gable_roof" }>;
type Bag = Record<string, unknown>;

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

export function GableRoofForm({
  obj,
  selection,
}: {
  obj: GableRoof;
  selection: Selection;
}) {
  const replace = useConfigStore((s) => s.replaceObject);
  const bag = obj as unknown as Bag;
  const setAt = (path: string[], value: unknown) => {
    const next = setPath(bag, path, value);
    replace(selection, next as unknown as GableRoof);
  };

  const footprint = get<number[]>(bag, ["framing", "house_footprint_ft"]) ?? [];
  const positions = (get<number[]>(bag, ["trusses", "positions"]) ?? []).slice();

  return (
    <div>
      <Section title="Roof geometry">
        <SelectField
          label="Ridge axis"
          value={(get<string>(bag, ["ridge_axis"]) as "x" | "y" | undefined) ?? "y"}
          onChange={(v) => setAt(["ridge_axis"], v)}
          options={[{ value: "y", label: "y (ridge runs N–S)" }]}
        />
        <SelectField
          label="Specify pitch by"
          value={get<number>(bag, ["min_pitch_deg"]) !== undefined ? "angle" : "height"}
          onChange={(v) => {
            // Half-transverse in project units. Prefer `width` (units)
            // over the legacy `framing.house_footprint_ft`.
            const wU = get<number>(bag, ["width"]) ?? (footprint[0] ?? 30) * 10;
            const half = wU / 2;
            if (v === "angle") {
              const h = get<number>(bag, ["ridge_h"]) ??
                (get<number>(bag, ["ridge_h_ft"]) ?? 0) * 10;
              const deg = half > 0 && h > 0
                ? Math.round((Math.atan2(h, half) * 180 / Math.PI) * 10) / 10
                : 30;
              setAt(["ridge_h"], undefined);
              setAt(["ridge_h_ft"], undefined);
              setAt(["min_pitch_deg"], deg);
            } else {
              const deg = get<number>(bag, ["min_pitch_deg"]) ?? 30;
              const h = Math.round(half * Math.tan(deg * Math.PI / 180));
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
          {get<number>(bag, ["min_pitch_deg"]) !== undefined ? (
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
                setAt(["ridge_h_ft"], undefined);
                setAt(["ridge_h"], v);
              }}
              min={0.01}
            />
          )}
          <NumberField
            label="Min overhang"
            hint="units, E+W eaves"
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
          <NumberField
            label="Gable overhang"
            hint="units, past ridge ends"
            value={get<number>(bag, ["gable_overhang"]) ??
              (get<number>(bag, ["gable_overhang_ft"]) !== undefined
                ? (get<number>(bag, ["gable_overhang_ft"]) as number) * 10
                : undefined)}
            onCommit={(v) => {
              setAt(["gable_overhang_ft"], undefined);
              setAt(["gable_overhang"], v);
            }}
            allowEmpty
            min={0}
          />
        </div>
      </Section>

      <Section title="Position & footprint (Phase 2)">
        <div className="mb-2 text-[11px] text-slate-400">
          Roof rectangle in project units (10 units = 1 ft), matching
          rooms / floor_slab. Multiple roofs can coexist on the same
          floor at different positions. Blank = falls back to
          <code>framing.house_footprint_ft</code> at (0, 0).
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

      <FramingSection bag={bag} setAt={setAt} />

      {/* Trusses — optional for gable. Mirrors the hip form's structure
          (same config path `trusses.{type,positions}`) so BOM +
          rendering pipelines share the same reader. */}
      <Section
        title="Trusses (optional)"
        actions={
          <button
            type="button"
            onClick={() => {
              // Add a truss at the midpoint of the two furthest existing
              // ones, or seed with a plausible position if empty.
              const next = [...positions];
              const long =
                get<number>(bag, ["length"]) ?? (footprint[1] ?? 40) * 10;
              // Gable trusses are optional — click + Truss adds exactly
              // one at a time. First one lands at 50 %; subsequent ones
              // at the midpoint of the two furthest neighbours.
              if (next.length >= 2) {
                const mid = (next[0] + next[next.length - 1]) / 2;
                next.splice(1, 0, mid);
              } else if (next.length === 1) {
                next.push(next[0] + long * 0.3);
              } else {
                next.push(long * 0.5);
              }
              next.sort((a, b) => a - b);
              if (!get<string>(bag, ["trusses", "type"])) {
                setAt(["trusses", "type"], "fink");
              }
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
          Truss positions in project units along the ridge axis. Optional —
          a plain gable renders with just rafters + purlins if no trusses
          are set. When present, one triangle truss (bottom chord + two
          top chords + king post) is drawn at each position.
        </div>
        <SelectField
          label="Truss type"
          value={
            (get<string>(bag, ["trusses", "type"]) as string | undefined) ??
            "fink"
          }
          onChange={(v) => setAt(["trusses", "type"], v)}
          options={[{ value: "fink", label: "fink" }]}
        />
        {positions.length === 0 ? (
          <div className="rounded border border-slate-800 bg-slate-950/40 p-2 text-[11px] text-slate-400">
            No trusses configured. Click <b>+ Truss</b> above to add one;
            leave empty for a plain gable with only rafters.
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
                  // Drop the whole trusses block when the last one is
                  // removed so the config stays clean.
                  if (next.length === 0) setAt(["trusses"], undefined);
                  else setAt(["trusses", "positions"], next);
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
