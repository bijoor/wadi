// Structured form for flat_roof objects. Simpler than hip/gable —
// no ridge, no slopes, no trusses. Fields:
//   x/y/width/length (roof position + size in project units)
//   slab_thickness (deck depth)
//   parapet_height / parapet_thickness (optional railing)
//   overhang (horizontal projection past the wall)

import type { HouseObject } from "../schema/houseConfig";
import type { Selection } from "../state/configStore";
import { useConfigStore } from "../state/configStore";
import { NumberField, TextField, Section } from "./fields";

type FlatRoof = Extract<HouseObject, { type: "flat_roof" }>;
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

export function FlatRoofForm({
  obj,
  selection,
}: {
  obj: FlatRoof;
  selection: Selection;
}) {
  const replace = useConfigStore((s) => s.replaceObject);
  const bag = obj as unknown as Bag;
  const setAt = (path: string[], value: unknown) => {
    const next = setPath(bag, path, value);
    replace(selection, next as unknown as FlatRoof);
  };

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
          via X / Y (NW corner). Multiple flat roofs can be placed on
          the same floor to compose an L-shape or leave a courtyard.
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField label="X" hint="NW corner" value={get<number>(bag, ["x"])} onCommit={(v) => setAt(["x"], v)} allowEmpty />
          <NumberField label="Y" hint="NW corner" value={get<number>(bag, ["y"])} onCommit={(v) => setAt(["y"], v)} allowEmpty />
          <NumberField label="Width" hint="X extent" value={get<number>(bag, ["width"])} onCommit={(v) => setAt(["width"], v)} allowEmpty min={0.01} />
          <NumberField label="Length" hint="Y extent" value={get<number>(bag, ["length"])} onCommit={(v) => setAt(["length"], v)} allowEmpty min={0.01} />
        </div>
      </Section>

      <Section title="Slab">
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField
            label="Slab thickness"
            hint="default 6 (0.6 ft)"
            value={get<number>(bag, ["slab_thickness"])}
            onCommit={(v) => setAt(["slab_thickness"], v)}
            allowEmpty
            min={0.01}
          />
          <NumberField
            label="Overhang"
            hint="default 5"
            value={get<number>(bag, ["overhang"])}
            onCommit={(v) => setAt(["overhang"], v)}
            allowEmpty
            min={0}
          />
        </div>
      </Section>

      <Section title="Parapet (optional railing)">
        <div className="mb-2 text-[11px] text-slate-400">
          Set height = 0 to disable. Parapet wraps the full roof
          perimeter at parapet_thickness thick.
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField
            label="Height"
            hint="default 30 (3 ft)"
            value={get<number>(bag, ["parapet_height"])}
            onCommit={(v) => setAt(["parapet_height"], v)}
            allowEmpty
            min={0}
          />
          <NumberField
            label="Thickness"
            hint="default 8 (0.8 ft)"
            value={get<number>(bag, ["parapet_thickness"])}
            onCommit={(v) => setAt(["parapet_thickness"], v)}
            allowEmpty
            min={0.01}
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
