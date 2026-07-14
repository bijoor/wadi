// Editor for a floor's top-level fields — name, wall height, slab
// thickness. Rendered by PropertyPanel when useConfigStore.floorEditorIdx
// is set (toggled from the Sidebar's "⚙ Floor settings" button).
//
// The `objects` array on the floor is edited via the object tree and
// the per-object property forms; this editor only touches the floor's
// own metadata.

import { useConfigStore } from "../state/configStore";
import { NumberField, TextField, Section } from "./fields";
import { DEFAULT_GLOBAL_CONFIG } from "../svg2d/config";

export function FloorPropertiesForm({ floorIdx }: { floorIdx: number }) {
  const config = useConfigStore((s) => s.config);
  const updateFloor = useConfigStore((s) => s.updateFloor);
  if (!config) return null;
  const floor = config.floors[floorIdx];
  if (!floor) return null;

  // Fallback chain: house-level defaults win over the code globals.
  const houseDefaults = (config as { defaults?: { floor_height?: number; slab_thickness?: number } }).defaults;
  const defaultSlab = houseDefaults?.slab_thickness ?? DEFAULT_GLOBAL_CONFIG.floor_slab_thickness;
  const defaultHeight = houseDefaults?.floor_height ?? DEFAULT_GLOBAL_CONFIG.floor_height;

  return (
    <div>
      <Section title="Identity">
        <TextField
          label="Name"
          value={floor.name}
          onCommit={(v) => updateFloor(floorIdx, { name: v || floor.name })}
        />
        <div className="mt-1 text-[11px] text-slate-500">
          Floor number: <b>{floor.floor_number}</b> · {floor.objects.length}{" "}
          object{floor.objects.length === 1 ? "" : "s"}
        </div>
      </Section>

      <Section title="Dimensions">
        <div className="mb-2 text-[11px] text-slate-400">
          Wall height + slab thickness for this floor, in project units
          (10 units = 1 ft). Blank fields fall back to the built-in
          defaults. Changing these shifts everything above (upper floors
          and roof) up or down accordingly.
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField
            label="Wall height"
            hint={`default ${defaultHeight}`}
            value={floor.height}
            onCommit={(v) => updateFloor(floorIdx, { height: v })}
            allowEmpty
            min={0.01}
          />
          <NumberField
            label="Slab thickness"
            hint={`default ${defaultSlab}`}
            value={floor.slab_thickness}
            onCommit={(v) => updateFloor(floorIdx, { slab_thickness: v })}
            allowEmpty
            min={0}
          />
        </div>
      </Section>
    </div>
  );
}
