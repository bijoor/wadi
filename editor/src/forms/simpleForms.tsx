import type { HouseObject, Side } from "../schema/houseConfig";
import type { Selection } from "../state/configStore";
import { useConfigStore } from "../state/configStore";
import { NumberField, TextField, SelectField, Section, ObjectMeasureField } from "./fields";

// A generic patch helper — narrowed at each callsite via the object type
// discriminator so the store's replaceObject call still stays type-safe.

const SIDES: Side[] = ["north", "south", "east", "west"];

export function PillarForm({
  obj, selection,
}: {
  obj: Extract<HouseObject, { type: "pillar" }>;
  selection: Selection;
}) {
  const replace = useConfigStore((s) => s.replaceObject);
  const patch = (next: Partial<typeof obj>) => replace(selection, { ...obj, ...next });
  const mpatch = (p: Record<string, unknown>) => replace(selection, { ...obj, ...p } as typeof obj);
  const o = obj as unknown as Record<string, unknown>;
  return (
    <div>
      <Section title="Identity">
        <TextField label="Name" value={obj.name} onCommit={(v) => patch({ name: v })} />
      </Section>
      <Section title="Position & size">
        <div className="grid grid-cols-2 gap-x-2">
          <ObjectMeasureField object={o} field="x" label="X" hint="top-left corner" patch={mpatch} />
          <ObjectMeasureField object={o} field="y" label="Y" hint="top-left corner" patch={mpatch} />
          <ObjectMeasureField object={o} field="width" label="Width" patch={mpatch} min={0.01} allowEmpty hint="X extent" />
          <ObjectMeasureField object={o} field="length" label="Length" patch={mpatch} min={0.01} allowEmpty hint="Y extent" />
          <ObjectMeasureField object={o} field="height" label="Height" patch={mpatch} min={0.01} />
          <ObjectMeasureField object={o} field="z_offset" label="Z offset" patch={mpatch} allowEmpty hint="above floor base (10u=1ft)" />
        </div>
      </Section>
    </div>
  );
}

export function BeamForm({
  obj, selection,
}: {
  obj: Extract<HouseObject, { type: "beam" }>;
  selection: Selection;
}) {
  const replace = useConfigStore((s) => s.replaceObject);
  const patch = (next: Partial<typeof obj>) => replace(selection, { ...obj, ...next });
  const mpatch = (p: Record<string, unknown>) => replace(selection, { ...obj, ...p } as typeof obj);
  const o = obj as unknown as Record<string, unknown>;
  return (
    <div>
      <Section title="Identity">
        <TextField label="Name" value={obj.name ?? ""} onCommit={(v) => patch({ name: v || undefined })} />
      </Section>
      <Section title="Position & size">
        <div className="grid grid-cols-2 gap-x-2">
          <ObjectMeasureField object={o} field="x" label="X" patch={mpatch} />
          <ObjectMeasureField object={o} field="y" label="Y" patch={mpatch} />
          <ObjectMeasureField object={o} field="width" label="Width" patch={mpatch} min={0.01} />
          <ObjectMeasureField object={o} field="length" label="Length" patch={mpatch} min={0.01} />
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <ObjectMeasureField
            object={o}
            field="height"
            label="Thickness"
            patch={mpatch}
            allowEmpty
            min={0.01}
            hint="defaults to floor's slab thickness"
          />
          <ObjectMeasureField
            object={o}
            field="z_offset"
            label="Z offset"
            patch={mpatch}
            allowEmpty
            hint="lift above floor start (10u = 1ft)"
          />
        </div>
      </Section>
    </div>
  );
}

export function PlinthForm({
  obj, selection,
}: {
  obj: Extract<HouseObject, { type: "plinth" }>;
  selection: Selection;
}) {
  const replace = useConfigStore((s) => s.replaceObject);
  const patch = (next: Partial<typeof obj>) => replace(selection, { ...obj, ...next });
  const mpatch = (p: Record<string, unknown>) => replace(selection, { ...obj, ...p } as typeof obj);
  const o = obj as unknown as Record<string, unknown>;
  return (
    <div>
      <Section title="Identity">
        <TextField label="Name" value={obj.name ?? ""} onCommit={(v) => patch({ name: v || undefined })} />
      </Section>
      <Section title="Plinth (raised base)">
        <div className="mb-2 text-[11px] text-slate-400">
          Raised base the ground floor sits on. Its <b>height</b> is the rise of
          this Plinth floor — set the floor's own height to match.
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <ObjectMeasureField object={o} field="x" label="X" patch={mpatch} />
          <ObjectMeasureField object={o} field="y" label="Y" patch={mpatch} />
          <ObjectMeasureField object={o} field="width" label="Width" patch={mpatch} min={0.01} />
          <ObjectMeasureField object={o} field="length" label="Length" patch={mpatch} min={0.01} />
          <ObjectMeasureField object={o} field="height" label="Height" patch={mpatch} min={0.01} hint="above ground" />
        </div>
      </Section>
    </div>
  );
}

export function GroundForm({
  obj, selection,
}: {
  obj: Extract<HouseObject, { type: "ground" }>;
  selection: Selection;
}) {
  const replace = useConfigStore((s) => s.replaceObject);
  const patch = (next: Partial<typeof obj>) => replace(selection, { ...obj, ...next });
  const mpatch = (p: Record<string, unknown>) => replace(selection, { ...obj, ...p } as typeof obj);
  const o = obj as unknown as Record<string, unknown>;
  return (
    <div>
      <Section title="Identity">
        <TextField label="Name" value={obj.name ?? ""} onCommit={(v) => patch({ name: v || undefined })} />
      </Section>
      <Section title="Ground plane">
        <div className="mb-2 text-[11px] text-slate-400">
          The ground the house sits on. Extent usually matches the plot.
          Sloping ground is a later feature.
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <ObjectMeasureField object={o} field="x" label="X" patch={mpatch} />
          <ObjectMeasureField object={o} field="y" label="Y" patch={mpatch} />
          <ObjectMeasureField object={o} field="width" label="Width" patch={mpatch} min={0.01} />
          <ObjectMeasureField object={o} field="length" label="Length" patch={mpatch} min={0.01} />
          <ObjectMeasureField object={o} field="height" label="Thickness" patch={mpatch} allowEmpty min={0} hint="0 = flat plane" />
        </div>
      </Section>
    </div>
  );
}

export function FloorSlabForm({
  obj, selection,
}: {
  obj: Extract<HouseObject, { type: "floor_slab" }>;
  selection: Selection;
}) {
  const replace = useConfigStore((s) => s.replaceObject);
  const patch = (next: Partial<typeof obj>) => replace(selection, { ...obj, ...next });
  const mpatch = (p: Record<string, unknown>) => replace(selection, { ...obj, ...p } as typeof obj);
  const o = obj as unknown as Record<string, unknown>;
  return (
    <div>
      <Section title="Identity">
        <TextField label="Name" value={obj.name ?? ""} onCommit={(v) => patch({ name: v || undefined })} />
      </Section>
      <Section title="Slab footprint">
        <div className="grid grid-cols-2 gap-x-2">
          <ObjectMeasureField object={o} field="x" label="X" patch={mpatch} />
          <ObjectMeasureField object={o} field="y" label="Y" patch={mpatch} />
          <ObjectMeasureField object={o} field="width" label="Width" patch={mpatch} min={0.01} />
          <ObjectMeasureField object={o} field="length" label="Length" patch={mpatch} min={0.01} />
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <ObjectMeasureField
            object={o}
            field="thickness"
            label="Thickness"
            patch={mpatch}
            allowEmpty
            min={0}
            hint="defaults to floor's slab thickness"
          />
          <ObjectMeasureField
            object={o}
            field="z_offset"
            label="Z offset"
            patch={mpatch}
            allowEmpty
            hint="lift above floor (10u = 1ft) — e.g. a stair landing"
          />
        </div>
      </Section>
    </div>
  );
}

export function StaircaseForm({
  obj, selection,
}: {
  obj: Extract<HouseObject, { type: "staircase" }>;
  selection: Selection;
}) {
  const replace = useConfigStore((s) => s.replaceObject);
  const patch = (next: Partial<typeof obj>) => replace(selection, { ...obj, ...next });
  const mpatch = (p: Record<string, unknown>) => replace(selection, { ...obj, ...p } as typeof obj);
  const o = obj as unknown as Record<string, unknown>;
  return (
    <div>
      <Section title="Identity">
        <TextField label="Name" value={obj.name ?? ""} onCommit={(v) => patch({ name: v || undefined })} />
      </Section>
      <Section title="Position & shape">
        <div className="mb-2 text-[11px] text-slate-400">
          Put the stair on the <b>upper</b> floor it leads to. X / Y / Z anchor its{" "}
          <b>top</b> (where it meets this floor); it descends to the floor below.
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <ObjectMeasureField object={o} field="start_x" label="Top X" patch={mpatch} hint="connection point" />
          <ObjectMeasureField object={o} field="start_y" label="Top Y" patch={mpatch} hint="connection point" />
          <ObjectMeasureField object={o} field="step_width" label="Step width" patch={mpatch} min={0.01} />
          <ObjectMeasureField object={o} field="step_tread" label="Step tread" patch={mpatch} min={0.01} />
          <ObjectMeasureField object={o} field="step_rise" label="Step rise" patch={mpatch} min={0.01} />
          <ObjectMeasureField
            object={o}
            field="rise_height"
            label="Height to cover"
            patch={mpatch}
            allowEmpty
            min={0.01}
            hint="top → floor below; blank = floor-below height. Steps = ÷ step rise"
          />
          <ObjectMeasureField
            object={o}
            field="z_offset"
            label="Top Z"
            patch={mpatch}
            allowEmpty
            hint="top height above floor (blank → flush with this floor)"
          />
        </div>
        <SelectField
          label="Direction"
          value={obj.direction}
          onChange={(v) => patch({ direction: v as Side })}
          options={SIDES.map((s) => ({ value: s, label: s }))}
        />
        <div className="mt-1 text-[11px] text-slate-400">
          The stair descends from its top INTO this direction.
        </div>
        <TextField
          label="Material"
          value={obj.material}
          onCommit={(v) => patch({ material: v || undefined })}
        />
      </Section>
      <Section title="Allocated run (switchback)">
        <div className="mb-2 text-[11px] text-slate-400">
          Space reserved for the stair along its direction. The whole stair
          (flights + landings) is kept within it — set it and a long stair
          auto-splits into switchback flights (more when tight). Blank = one flight.
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <ObjectMeasureField
            object={o}
            field="max_run"
            label="Max run"
            patch={mpatch}
            allowEmpty
            min={0.01}
            hint="allocated length along the direction"
          />
          <ObjectMeasureField
            object={o}
            field="landing_depth"
            label="Landing depth"
            patch={mpatch}
            allowEmpty
            min={0.01}
            hint="blank → equals step width"
          />
          <ObjectMeasureField
            object={o}
            field="landing_thickness"
            label="Landing thickness"
            patch={mpatch}
            allowEmpty
            min={0}
            hint="blank → equals step rise"
          />
          <ObjectMeasureField
            object={o}
            field="flight_gap"
            label="Flight gap"
            patch={mpatch}
            allowEmpty
            min={0}
            hint="stairwell void between flights (e.g. for a wall)"
          />
        </div>
        <SelectField
          label="Turn (going down)"
          value={obj.turn ?? "clockwise"}
          onChange={(v) =>
            patch({ turn: v === "anticlockwise" ? "anticlockwise" : "clockwise" })
          }
          options={[
            { value: "clockwise", label: "clockwise" },
            { value: "anticlockwise", label: "anticlockwise" },
          ]}
        />
      </Section>
    </div>
  );
}

// Roof editors are opaque payloads (framing / trusses / ridge_ventilation
// dicts). Rather than try to expose every knob in a form, show the raw
// JSON for now and let the user edit it externally. Phase 5 can add a
// dedicated roof editor.
export function OpaqueRoofForm({
  obj,
}: {
  obj: Extract<HouseObject, { type: "hip_roof" | "gable_roof" }>;
  selection: Selection;
}) {
  return (
    <div>
      <Section title="Roof (read-only for now)">
        <div className="mb-2 text-[11px] text-slate-400">
          Roof geometry is derived — a form editor lands in Phase 5. Edit
          the raw JSON in the source file for now.
        </div>
        <pre className="max-h-[50vh] overflow-auto rounded bg-slate-950 p-2 font-mono text-[10px] text-slate-300">
          {JSON.stringify(obj, null, 2)}
        </pre>
      </Section>
    </div>
  );
}

// Flat-schema doors and windows (legacy) — supported for backward compat.
export function FlatDoorWindowForm({
  obj, selection,
}: {
  obj: Extract<HouseObject, { type: "door" | "window" }>;
  selection: Selection;
}) {
  const replace = useConfigStore((s) => s.replaceObject);
  const patch = (next: Partial<typeof obj>) => replace(selection, { ...obj, ...next });
  return (
    <div>
      <Section title="Legacy flat opening">
        <div className="mb-2 rounded bg-amber-950/30 p-2 text-[10px] text-amber-300">
          This uses the flat schema. Consider migrating to a nested
          opening inside its parent room's or wall's <code>openings</code>.
        </div>
        <TextField label="Name" value={obj.name} onCommit={(v) => patch({ name: v })} />
        <TextField
          label="Room"
          value={obj.room}
          onCommit={(v) => patch({ room: v || undefined })}
        />
        <TextField
          label="Wall"
          value={obj.wall}
          onCommit={(v) => patch({ wall: v || undefined })}
        />
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField label="X" value={obj.x} onCommit={(v) => v !== undefined && patch({ x: v })} />
          <NumberField label="Y" value={obj.y} onCommit={(v) => v !== undefined && patch({ y: v })} />
          <NumberField label="Width" value={obj.width} onCommit={(v) => v !== undefined && patch({ width: v })} min={0.01} />
          <NumberField label="Height" value={obj.height} onCommit={(v) => v !== undefined && patch({ height: v })} min={0.01} />
          {obj.type === "window" && (
            <NumberField
              label="Sill height"
              value={obj.sill_height}
              onCommit={(v) => patch({ sill_height: v })}
              allowEmpty
            />
          )}
        </div>
        <SelectField
          label="Direction"
          value={obj.direction}
          onChange={(v) => patch({ direction: v as Side })}
          options={SIDES.map((s) => ({ value: s, label: s }))}
        />
        <label className="mt-1 flex items-center gap-2 text-[11px] text-slate-300">
          <input
            type="checkbox"
            checked={obj.open ?? false}
            onChange={(e) => patch({ open: e.target.checked || undefined })}
            className="accent-emerald-500"
          />
          Open — no {obj.type === "door" ? "door leaf" : "glazing/frame"} (bare hole)
        </label>
      </Section>
    </div>
  );
}
