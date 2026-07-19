// Structured form for shed_roof objects. Single sloped panel
// specified by slope_dir (where the water runs to) + rise (or
// min_pitch_deg).

import type { HouseObject } from "../schema/houseConfig";
import type { Selection } from "../state/configStore";
import { useConfigStore } from "../state/configStore";
import { NumberField, SelectField, TextField, Section } from "./fields";
import { FramingSection } from "./FramingSection";

type ShedRoof = Extract<HouseObject, { type: "shed_roof" }>;
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

export function ShedRoofForm({
  obj,
  selection,
}: {
  obj: ShedRoof;
  selection: Selection;
}) {
  const replace = useConfigStore((s) => s.replaceObject);
  const bag = obj as unknown as Bag;
  const setAt = (path: string[], value: unknown) => {
    const next = setPath(bag, path, value);
    replace(selection, next as unknown as ShedRoof);
  };

  const usingAngle = get<number>(bag, ["min_pitch_deg"]) !== undefined;
  const slopeDir = (get<string>(bag, ["slope_dir"]) as "north" | "south" | "east" | "west" | undefined) ?? "south";
  // Run = horizontal span perpendicular to the high/low edges.
  const width = Number(get<number>(bag, ["width"]) ?? 300);
  const length = Number(get<number>(bag, ["length"]) ?? 400);
  const run = slopeDir === "north" || slopeDir === "south" ? length : width;

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

      <Section title="Position & footprint">
        <div className="mb-2 text-[11px] text-slate-400">
          Roof rectangle in project units (10 units = 1 ft). Position
          via X / Y (NW corner). Multiple shed roofs can compose more
          complex forms.
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField label="X" hint="NW corner" value={get<number>(bag, ["x"])} onCommit={(v) => setAt(["x"], v)} allowEmpty />
          <NumberField label="Y" hint="NW corner" value={get<number>(bag, ["y"])} onCommit={(v) => setAt(["y"], v)} allowEmpty />
          <NumberField label="Width" hint="X extent" value={get<number>(bag, ["width"])} onCommit={(v) => setAt(["width"], v)} allowEmpty min={0.01} />
          <NumberField label="Length" hint="Y extent" value={get<number>(bag, ["length"])} onCommit={(v) => setAt(["length"], v)} allowEmpty min={0.01} />
        </div>
      </Section>

      <Section title="Slope">
        <SelectField
          label="Slope direction"
          value={slopeDir}
          onChange={(v) => setAt(["slope_dir"], v)}
          options={[
            { value: "south", label: "south (water runs south)" },
            { value: "north", label: "north" },
            { value: "east", label: "east" },
            { value: "west", label: "west" },
          ]}
        />
        <SelectField
          label="Specify pitch by"
          value={usingAngle ? "angle" : "rise"}
          onChange={(v) => {
            if (v === "angle") {
              const rise = Number(get<number>(bag, ["rise"]) ?? 0);
              const deg = run > 0 && rise > 0
                ? Math.round((Math.atan2(rise, run) * 180 / Math.PI) * 10) / 10
                : 15;
              setAt(["rise"], undefined);
              setAt(["min_pitch_deg"], deg);
            } else {
              const deg = get<number>(bag, ["min_pitch_deg"]) ?? 15;
              const rise = Math.round(run * Math.tan(deg * Math.PI / 180));
              setAt(["min_pitch_deg"], undefined);
              setAt(["rise"], rise);
            }
          }}
          options={[
            { value: "rise", label: "Rise (units)" },
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
              label="Rise"
              hint="units above wall top at high edge"
              value={get<number>(bag, ["rise"])}
              onCommit={(v) => v !== undefined && setAt(["rise"], v)}
              min={0.01}
            />
          )}
          <NumberField
            label="Min overhang"
            hint="units, all 4 sides"
            value={get<number>(bag, ["min_overhang"])}
            onCommit={(v) => v !== undefined && setAt(["min_overhang"], v)}
            min={0.01}
          />
        </div>
      </Section>

      <FramingSection bag={bag} setAt={setAt} />

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
