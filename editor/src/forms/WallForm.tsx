import type { Wall, Opening, Side } from "../schema/houseConfig";
import type { Selection } from "../state/configStore";
import { useConfigStore } from "../state/configStore";
import { SelectField, TextField, Section, ObjectMeasureField } from "./fields";

const SIDES: Side[] = ["north", "south", "east", "west"];
const KINDS = [
  { value: "door" as const, label: "Door" },
  { value: "window" as const, label: "Window" },
];

export function WallForm({ wall, selection }: { wall: Wall; selection: Selection }) {
  const replace = useConfigStore((s) => s.replaceObject);
  const patch = (next: Partial<Wall>) => replace(selection, { ...wall, ...next });
  const mpatch = (p: Record<string, unknown>) =>
    replace(selection, { ...wall, ...p } as Wall);
  const wobj = wall as unknown as Record<string, unknown>;

  const dx = wall.end_x - wall.start_x;
  const dy = wall.end_y - wall.start_y;
  const wallLength = Math.hypot(dx, dy);
  const isHorizontal = Math.abs(dx) > Math.abs(dy);
  const defaultFacing: Side = isHorizontal ? "north" : "east";

  const addOpening = (kind: "door" | "window") => {
    const openings = [
      ...(wall.openings ?? []),
      {
        kind,
        offset: 0,
        width: kind === "door" ? 30 : 40,
        height: kind === "door" ? 65 : 40,
        ...(kind === "window" ? { sill_height: 25 } : {}),
      },
    ];
    patch({ openings });
  };

  const updateOpening = (i: number, next: Partial<Opening>) => {
    const openings = [...(wall.openings ?? [])];
    openings[i] = { ...openings[i], ...next };
    patch({ openings });
  };

  const deleteOpening = (i: number) => {
    const openings = (wall.openings ?? []).filter((_, idx) => idx !== i);
    patch({ openings });
  };

  return (
    <div>
      <Section title="Identity">
        <TextField label="Name" value={wall.name} onCommit={(v) => patch({ name: v })} />
        <TextField
          label="Material"
          value={wall.material}
          onCommit={(v) => patch({ material: v || undefined })}
        />
      </Section>

      <Section title="Endpoints">
        <div className="grid grid-cols-2 gap-x-2">
          <ObjectMeasureField object={wobj} field="start_x" label="Start X" patch={mpatch} />
          <ObjectMeasureField object={wobj} field="start_y" label="Start Y" patch={mpatch} />
          <ObjectMeasureField object={wobj} field="end_x" label="End X" patch={mpatch} />
          <ObjectMeasureField object={wobj} field="end_y" label="End Y" patch={mpatch} />
        </div>
        <div className="text-[10px] text-slate-500">
          Length {wallLength.toFixed(1)} · {isHorizontal ? "E–W" : "N–S"}
        </div>
      </Section>

      <Section title="Height & orientation">
        <ObjectMeasureField object={wobj} field="height" label="Height" patch={mpatch} allowEmpty />
        <ObjectMeasureField
          object={wobj}
          field="height_end"
          label="Height end"
          patch={mpatch}
          allowEmpty
          hint="sloping wall — height at end"
        />
        <ObjectMeasureField
          object={wobj}
          field="z_offset"
          label="Z offset"
          patch={mpatch}
          allowEmpty
          hint="above floor base (10u=1ft); blank = on slab"
        />
        <SelectField
          label="Facing"
          hint={`default: ${defaultFacing}`}
          value={wall.facing ?? defaultFacing}
          onChange={(v) => patch({ facing: v as Side })}
          options={SIDES.map((s) => ({ value: s, label: s }))}
        />
      </Section>

      <Section
        title="Openings"
        actions={
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => addOpening("door")}
              className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
            >
              + Door
            </button>
            <button
              type="button"
              onClick={() => addOpening("window")}
              className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
            >
              + Window
            </button>
          </div>
        }
      >
        {(wall.openings ?? []).length === 0 && (
          <div className="text-[11px] text-slate-500">No openings yet.</div>
        )}
        {(wall.openings ?? []).map((op, i) => (
          <div key={i} className="mb-1 rounded bg-slate-900 p-2">
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
              <span>
                <span className="capitalize">{op.kind}</span>
                {op.name ? ` · ${op.name}` : ""}
              </span>
              <button
                type="button"
                onClick={() => deleteOpening(i)}
                className="rounded bg-slate-800 px-1 py-0.5 text-[10px] text-red-300 hover:bg-red-900"
              >
                Delete
              </button>
            </div>
            <TextField label="Name" value={op.name} onCommit={(v) => updateOpening(i, { name: v || undefined })} />
            <SelectField
              label="Kind"
              value={op.kind}
              onChange={(v) => updateOpening(i, { kind: v })}
              options={KINDS}
            />
            <div className="grid grid-cols-2 gap-x-2">
              <ObjectMeasureField
                object={op as unknown as Record<string, unknown>}
                field="offset"
                label="Offset"
                patch={(p) => updateOpening(i, p as Partial<Opening>)}
                min={0}
                max={wallLength}
              />
              <ObjectMeasureField
                object={op as unknown as Record<string, unknown>}
                field="width"
                label="Width"
                patch={(p) => updateOpening(i, p as Partial<Opening>)}
                min={0.01}
              />
              <ObjectMeasureField
                object={op as unknown as Record<string, unknown>}
                field="height"
                label="Height"
                patch={(p) => updateOpening(i, p as Partial<Opening>)}
                min={0.01}
              />
              {op.kind === "window" && (
                <ObjectMeasureField
                  object={op as unknown as Record<string, unknown>}
                  field="sill_height"
                  label="Sill height"
                  patch={(p) => updateOpening(i, p as Partial<Opening>)}
                  min={0}
                  allowEmpty
                />
              )}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}
