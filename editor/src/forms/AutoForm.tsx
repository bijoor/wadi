import type { HouseObject } from "../schema/houseConfig";
import type { Selection } from "../state/configStore";
import { useConfigStore } from "../state/configStore";
import { fieldToFormControl, type FieldSpec, type FormControlSpec } from "../registry/fieldSchema";
import { Section, TextField, SelectField, ObjectMeasureField } from "./fields";

// A property-panel form GENERATED from a primitive's `fields` (P2b;
// plans/primitive-componentization.md §2.3). Renders the SAME widgets the hand-
// written forms use — derived from each field's kind — so a primitive gets a working
// form from `fields` alone (a bespoke `Form` still overrides for polish). Wired as
// the PropertyPanel fallback for a registered node that carries `fields` but no
// `Form` — the mechanism a new primitive (P5) uses.
export function AutoForm({
  fields,
  obj,
  selection,
}: {
  fields: readonly FieldSpec[];
  obj: HouseObject;
  selection: Selection;
}) {
  const replace = useConfigStore((s) => s.replaceObject);
  const patch = (p: Record<string, unknown>) =>
    replace(selection, { ...(obj as object), ...p } as HouseObject);
  const o = obj as unknown as Record<string, unknown>;

  const controls = fields.map(fieldToFormControl);
  const nonGeom = controls.filter((c) => c.control !== "measure");
  const geom = controls.filter((c) => c.control === "measure");

  const setText = (c: FormControlSpec, v: string) =>
    patch({ [c.name]: c.allowEmpty ? v || undefined : v });

  return (
    <div>
      {nonGeom.length > 0 && (
        <Section title="Details">
          {nonGeom.map((c) => {
            if (c.control === "text") {
              return (
                <TextField
                  key={c.name}
                  label={c.label}
                  hint={c.hint}
                  value={(o[c.name] as string | undefined) ?? ""}
                  onCommit={(v) => setText(c, v)}
                />
              );
            }
            if (c.control === "select") {
              return (
                <SelectField
                  key={c.name}
                  label={c.label}
                  hint={c.hint}
                  value={(o[c.name] as string | undefined) ?? c.values?.[0] ?? ""}
                  onChange={(v) => patch({ [c.name]: v })}
                  options={(c.values ?? []).map((v) => ({ value: v, label: v }))}
                />
              );
            }
            // flag → checkbox
            return (
              <label
                key={c.name}
                className="mt-1 flex items-center gap-2 text-[11px] text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={Boolean(o[c.name])}
                  onChange={(e) => patch({ [c.name]: e.target.checked || undefined })}
                  className="accent-emerald-500"
                />
                {c.label}
              </label>
            );
          })}
        </Section>
      )}
      {geom.length > 0 && (
        <Section title="Geometry">
          <div className="grid grid-cols-2 gap-x-2">
            {geom.map((c) => (
              <ObjectMeasureField
                key={c.name}
                object={o}
                field={c.name}
                label={c.label}
                hint={c.hint}
                patch={patch}
                min={c.min}
                allowEmpty={c.allowEmpty}
                integer={c.integer}
              />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
