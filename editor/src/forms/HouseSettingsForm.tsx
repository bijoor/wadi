// Editor for the two top-level house fields — site and plinth. Rendered
// by PropertyPanel when useConfigStore.siteEditorOpen is true (toggled
// from the Sidebar's "🏠 House settings" button).
//
// site: plot dimensions + reference origin
// plinth: raised base rectangle + height

import { useConfigStore } from "../state/configStore";
import { NumberField, Section } from "./fields";
import { DEFAULT_GLOBAL_CONFIG } from "../svg2d/config";

export function HouseSettingsForm() {
  const config = useConfigStore((s) => s.config);
  const updateSite = useConfigStore((s) => s.updateSite);
  const updatePlinth = useConfigStore((s) => s.updatePlinth);
  const updateDefaults = useConfigStore((s) => s.updateDefaults);

  if (!config) return null;
  const site = config.site;
  const plinth = config.plinth;
  const defaults = (config as { defaults?: { floor_height?: number; slab_thickness?: number } }).defaults ?? {};

  return (
    <div>
      <Section title="Site (plot dimensions)">
        <div className="mb-2 text-[11px] text-slate-400">
          Overall plot the house sits on. Units follow the project
          convention: 10 units = 1 ft.
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField
            label="Plot width"
            hint="X extent (units)"
            value={site.plot_width}
            onCommit={(v) => v !== undefined && updateSite({ plot_width: v })}
            min={0.01}
          />
          <NumberField
            label="Plot length"
            hint="Y extent (units)"
            value={site.plot_length}
            onCommit={(v) => v !== undefined && updateSite({ plot_length: v })}
            min={0.01}
          />
          <NumberField
            label="Reference X"
            hint="origin offset"
            value={site.reference_x}
            onCommit={(v) => v !== undefined && updateSite({ reference_x: v })}
          />
          <NumberField
            label="Reference Y"
            hint="origin offset"
            value={site.reference_y}
            onCommit={(v) => v !== undefined && updateSite({ reference_y: v })}
          />
        </div>
      </Section>

      <Section title="Plinth (raised base)">
        <div className="mb-2 text-[11px] text-slate-400">
          Raised base on which the ground floor sits. Usually matches the
          plot in width/length. Height is how tall the plinth stands
          above ground.
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField
            label="X"
            hint="offset from plot NW corner"
            value={plinth.x}
            onCommit={(v) => v !== undefined && updatePlinth({ x: v })}
          />
          <NumberField
            label="Y"
            hint="offset from plot NW corner"
            value={plinth.y}
            onCommit={(v) => v !== undefined && updatePlinth({ y: v })}
          />
          <NumberField
            label="Width"
            hint="X extent"
            value={plinth.width}
            onCommit={(v) => v !== undefined && updatePlinth({ width: v })}
            min={0.01}
          />
          <NumberField
            label="Length"
            hint="Y extent"
            value={plinth.length}
            onCommit={(v) => v !== undefined && updatePlinth({ length: v })}
            min={0.01}
          />
          <NumberField
            label="Height"
            hint="above ground"
            value={plinth.height}
            onCommit={(v) => v !== undefined && updatePlinth({ height: v })}
            min={0.01}
          />
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          Tip: per-floor wall heights + slab thickness live on each
          floor — pick a floor in the sidebar, then click{" "}
          <b>⚙ Floor settings</b>.
        </div>
      </Section>

      <Section title="Defaults (used by any floor without an override)">
        <div className="mb-2 text-[11px] text-slate-400">
          House-wide fallbacks used when a floor doesn't specify its own
          <code className="mx-1 rounded bg-slate-800 px-1">height</code> /
          <code className="mx-1 rounded bg-slate-800 px-1">slab_thickness</code>.
          Leave blank to fall back to the built-in defaults
          ({DEFAULT_GLOBAL_CONFIG.floor_height} /{" "}
          {DEFAULT_GLOBAL_CONFIG.floor_slab_thickness}).
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField
            label="Floor height"
            hint={`code default ${DEFAULT_GLOBAL_CONFIG.floor_height}`}
            value={defaults.floor_height}
            onCommit={(v) => updateDefaults({ floor_height: v })}
            allowEmpty
            min={0.01}
          />
          <NumberField
            label="Slab thickness"
            hint={`code default ${DEFAULT_GLOBAL_CONFIG.floor_slab_thickness}`}
            value={defaults.slab_thickness}
            onCommit={(v) => updateDefaults({ slab_thickness: v })}
            allowEmpty
            min={0}
          />
        </div>
      </Section>
    </div>
  );
}
