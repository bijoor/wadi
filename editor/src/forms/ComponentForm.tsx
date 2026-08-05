// Editor for a `component` instance — pick which library component it references,
// place it (x/y/z_offset), and override the component's declared params.

import type { HouseObject } from "../schema/houseConfig";
import type { Selection } from "../state/configStore";
import { useConfigStore } from "../state/configStore";
import { TextField, SelectField, Section, ObjectMeasureField, NumberField } from "./fields";

export function ComponentForm({
  obj, selection,
}: {
  obj: Extract<HouseObject, { type: "component" }>;
  selection: Selection;
}) {
  const config = useConfigStore((s) => s.config);
  const replace = useConfigStore((s) => s.replaceObject);
  const patch = (next: Partial<typeof obj>) => replace(selection, { ...obj, ...next });
  const mpatch = (p: Record<string, unknown>) => replace(selection, { ...obj, ...p } as typeof obj);
  const o = obj as unknown as Record<string, unknown>;

  const components = (config?.components ?? {}) as Record<
    string,
    { name?: string; params?: Array<{ name: string; label?: string; default?: number }> }
  >;
  const ids = Object.keys(components);
  const def = components[obj.ref];
  const params = def?.params ?? [];
  const instParams = (obj.params ?? {}) as Record<string, number | string>;

  const setParam = (name: string, value: number | undefined) => {
    const next = { ...instParams };
    if (value === undefined) delete next[name];
    else next[name] = value;
    patch({ params: Object.keys(next).length ? next : undefined });
  };

  return (
    <div>
      <Section title="Identity">
        <TextField label="Name" value={obj.name ?? ""} onCommit={(v) => patch({ name: v || undefined })} />
      </Section>

      <Section title="Component">
        {ids.length === 0 ? (
          <div className="text-[11px] text-slate-400">
            No components in the library yet — add one from{" "}
            <b>🏠 House settings → Components</b>.
          </div>
        ) : (
          <SelectField
            label="Reference"
            value={obj.ref}
            options={ids.map((id) => ({ value: id, label: components[id].name ?? id }))}
            onChange={(v) => patch({ ref: v })}
          />
        )}
      </Section>

      <Section title="Placement">
        <div className="grid grid-cols-2 gap-x-2">
          <ObjectMeasureField object={o} field="x" label="X" patch={mpatch} hint="on the parent floor" />
          <ObjectMeasureField object={o} field="y" label="Y" patch={mpatch} />
          <ObjectMeasureField object={o} field="rotation" label="Rotation°" patch={mpatch} allowEmpty hint="yaw; 0/90/180/270 for structural, any angle for furniture-only" />
          <ObjectMeasureField object={o} field="z_offset" label="Z offset" patch={mpatch} allowEmpty hint="lift above floor base" />
        </div>
      </Section>

      {params.length > 0 && (
        <Section title="Parameters">
          <div className="mb-2 text-[11px] text-slate-400">
            Override the component's inputs. Blank = the component's default.
          </div>
          <div className="grid grid-cols-2 gap-x-2">
            {params.map((p) => (
              <NumberField
                key={p.name}
                label={p.label ?? p.name}
                value={
                  typeof instParams[p.name] === "number"
                    ? (instParams[p.name] as number)
                    : undefined
                }
                onCommit={(v) => setParam(p.name, v)}
                allowEmpty
              />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
