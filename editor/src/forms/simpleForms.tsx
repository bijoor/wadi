import type { HouseObject, Side } from "../schema/houseConfig";
import type { Selection } from "../state/configStore";
import { useConfigStore } from "../state/configStore";
import { NumberField, TextField, SelectField, Section } from "./fields";

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
  return (
    <div>
      <Section title="Identity">
        <TextField label="Name" value={obj.name} onCommit={(v) => patch({ name: v })} />
      </Section>
      <Section title="Position & size">
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField label="X (centre)" value={obj.x} onCommit={(v) => v !== undefined && patch({ x: v })} />
          <NumberField label="Y (centre)" value={obj.y} onCommit={(v) => v !== undefined && patch({ y: v })} />
          <NumberField label="Width" value={obj.width} onCommit={(v) => patch({ width: v })} min={0.01} allowEmpty hint="X extent" />
          <NumberField label="Length" value={obj.length} onCommit={(v) => patch({ length: v })} min={0.01} allowEmpty hint="Y extent" />
          <NumberField label="Height" value={obj.height} onCommit={(v) => v !== undefined && patch({ height: v })} min={0.01} />
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
  return (
    <div>
      <Section title="Identity">
        <TextField label="Name" value={obj.name ?? ""} onCommit={(v) => patch({ name: v || undefined })} />
      </Section>
      <Section title="Position & size">
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField label="X" value={obj.x} onCommit={(v) => v !== undefined && patch({ x: v })} />
          <NumberField label="Y" value={obj.y} onCommit={(v) => v !== undefined && patch({ y: v })} />
          <NumberField label="Width" value={obj.width} onCommit={(v) => v !== undefined && patch({ width: v })} min={0.01} />
          <NumberField label="Length" value={obj.length} onCommit={(v) => v !== undefined && patch({ length: v })} min={0.01} />
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField
            label="Thickness"
            value={obj.height}
            onCommit={(v) => patch({ height: v })}
            allowEmpty
            min={0.01}
            hint="defaults to floor's slab thickness"
          />
          <NumberField
            label="Z offset"
            value={obj.z_offset}
            onCommit={(v) => patch({ z_offset: v })}
            allowEmpty
            hint="lift above floor start (10u = 1ft)"
          />
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
  return (
    <div>
      <Section title="Identity">
        <TextField label="Name" value={obj.name ?? ""} onCommit={(v) => patch({ name: v || undefined })} />
      </Section>
      <Section title="Slab footprint">
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField label="X" value={obj.x} onCommit={(v) => v !== undefined && patch({ x: v })} />
          <NumberField label="Y" value={obj.y} onCommit={(v) => v !== undefined && patch({ y: v })} />
          <NumberField label="Width" value={obj.width} onCommit={(v) => v !== undefined && patch({ width: v })} min={0.01} />
          <NumberField label="Length" value={obj.length} onCommit={(v) => v !== undefined && patch({ length: v })} min={0.01} />
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField
            label="Thickness"
            value={obj.thickness}
            onCommit={(v) => patch({ thickness: v })}
            allowEmpty
            min={0}
            hint="defaults to floor's slab thickness"
          />
          <NumberField
            label="Z offset"
            value={obj.z_offset}
            onCommit={(v) => patch({ z_offset: v })}
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
  return (
    <div>
      <Section title="Identity">
        <TextField label="Name" value={obj.name ?? ""} onCommit={(v) => patch({ name: v || undefined })} />
      </Section>
      <Section title="Position & shape">
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField label="Start X" value={obj.start_x} onCommit={(v) => v !== undefined && patch({ start_x: v })} />
          <NumberField label="Start Y" value={obj.start_y} onCommit={(v) => v !== undefined && patch({ start_y: v })} />
          <NumberField label="Step width" value={obj.step_width} onCommit={(v) => v !== undefined && patch({ step_width: v })} min={0.01} />
          <NumberField label="Step tread" value={obj.step_tread} onCommit={(v) => v !== undefined && patch({ step_tread: v })} min={0.01} />
          <NumberField label="Step rise" value={obj.step_rise} onCommit={(v) => v !== undefined && patch({ step_rise: v })} min={0.01} />
          <NumberField label="# Steps" value={obj.num_steps} onCommit={(v) => v !== undefined && patch({ num_steps: Math.round(v) })} min={1} step={1} />
          <NumberField
            label="Z offset"
            value={obj.z_offset}
            onCommit={(v) => patch({ z_offset: v })}
            allowEmpty
            hint="first step lift above floor (10u = 1ft) — for a landing"
          />
        </div>
        <SelectField
          label="Direction"
          value={obj.direction}
          onChange={(v) => patch({ direction: v as Side })}
          options={SIDES.map((s) => ({ value: s, label: s }))}
        />
        <TextField
          label="Material"
          value={obj.material}
          onCommit={(v) => patch({ material: v || undefined })}
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
      </Section>
    </div>
  );
}
