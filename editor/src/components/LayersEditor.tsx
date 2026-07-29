// Dedicated Layers editor modal — manage the house's 3D layer GROUPING and
// ORDER. Editing materializes the full effective layer set into config.layers
// (the source of truth); the Show/hide-layers menu and the 3D scene follow this
// order. Roof layers are code-managed and excluded. Opened via useLayersUiStore
// from the House-settings section, the viewer's layer menu, or window.wadiOpenLayersEditor.
import { useMemo, useState } from "react";
import { useConfigStore } from "../state/configStore";
import { useLayersUiStore } from "../state/layersUiStore";
import { effectiveLayers, isRoofLayer, type LayerDef } from "../three/layers";
import {
  UNGROUPED,
  moveGroup,
  moveLayerInGroup,
  moveLayerToGroup,
  renameGroup,
  toGroups,
} from "../three/layerGrouping";

export function LayersEditor() {
  const open = useLayersUiStore((s) => s.open);
  const setOpen = useLayersUiStore((s) => s.setOpen);
  const config = useConfigStore((s) => s.config);
  const updateLayers = useConfigStore((s) => s.updateLayers);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Full editable set = effective layers minus the code-managed roof layers.
  const layers: LayerDef[] = useMemo(
    () => (config ? effectiveLayers(config).filter((l) => !isRoofLayer(l.id)) : []),
    [config],
  );
  const groups = useMemo(() => toGroups(layers), [layers]);
  const groupNames = groups.map((g) => g.name);

  if (!open) return null;

  const commit = (next: LayerDef[]) => updateLayers(next.length ? next : undefined);
  const patch = (id: string, p: Partial<LayerDef>) =>
    commit(layers.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const remove = (id: string) => commit(layers.filter((l) => l.id !== id));
  const addTo = (group: string) => {
    const taken = new Set(layers.map((l) => l.id));
    let n = layers.length + 1;
    while (taken.has(`layer${n}`)) n++;
    commit([
      ...layers,
      { id: `layer${n}`, label: `Layer ${n}`, color: "#888888", group: group === UNGROUPED ? undefined : group },
    ]);
  };

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="flex max-h-[86vh] w-[580px] max-w-full flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 text-slate-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold">Layers — grouping &amp; order</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded px-2 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3">
          <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
            Reorder whole <b>groups</b> (▲▼ on the group header) and the layers inside them,
            rename a group, or move a layer to another group. This is the house's 3D layer
            source of truth — the <b>Show/hide layers</b> menu and the 3D scene follow this
            order. Roof layers are managed automatically.
          </p>

          {groups.length === 0 && (
            <div className="text-[11px] text-slate-500">No layers — load a house first.</div>
          )}

          {groups.map((g, gi) => {
            const isCol = !!collapsed[g.name];
            return (
              <div key={g.name} className="mb-2 rounded border border-slate-800">
                <div className="flex items-center gap-1 bg-slate-800/60 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => setCollapsed((c) => ({ ...c, [g.name]: !isCol }))}
                    className="w-4 text-slate-400 hover:text-slate-200"
                    title={isCol ? "Expand" : "Collapse"}
                  >
                    {isCol ? "▸" : "▾"}
                  </button>
                  <input
                    key={g.name}
                    defaultValue={g.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== g.name) commit(renameGroup(layers, g.name, v));
                    }}
                    className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-[12px] font-semibold text-slate-100 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none"
                    title="Rename group (updates all its layers)"
                  />
                  <span className="shrink-0 text-[10px] text-slate-500">{g.layers.length}</span>
                  <button
                    type="button"
                    disabled={gi === 0}
                    onClick={() => commit(moveGroup(layers, g.name, -1))}
                    className="shrink-0 rounded bg-slate-800 px-1.5 text-[11px] hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                    title="Move group up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={gi === groups.length - 1}
                    onClick={() => commit(moveGroup(layers, g.name, 1))}
                    className="shrink-0 rounded bg-slate-800 px-1.5 text-[11px] hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                    title="Move group down"
                  >
                    ▼
                  </button>
                </div>

                {!isCol && (
                  <div className="space-y-1 px-2 py-1.5">
                    {g.layers.map((l, li) => (
                      <div key={l.id} className="flex items-center gap-1.5">
                        <div className="flex shrink-0 flex-col">
                          <button
                            type="button"
                            disabled={li === 0}
                            onClick={() => commit(moveLayerInGroup(layers, l.id, -1))}
                            className="rounded-t bg-slate-800 px-1 text-[9px] leading-tight text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                            title="Move up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={li === g.layers.length - 1}
                            onClick={() => commit(moveLayerInGroup(layers, l.id, 1))}
                            className="rounded-b bg-slate-800 px-1 text-[9px] leading-tight text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                            title="Move down"
                          >
                            ▼
                          </button>
                        </div>
                        <input
                          type="color"
                          value={l.color ?? "#888888"}
                          onChange={(e) => patch(l.id, { color: e.target.value })}
                          className="h-6 w-6 shrink-0 cursor-pointer rounded border border-slate-700 bg-transparent"
                          title="Layer colour"
                        />
                        <input
                          key={l.label}
                          defaultValue={l.label}
                          onBlur={(e) => patch(l.id, { label: e.target.value || l.id })}
                          className="min-w-0 flex-1 rounded bg-slate-800 px-1.5 py-1 text-[12px] text-slate-200 focus:outline-none"
                          title="Layer label"
                        />
                        <select
                          value={g.name}
                          onChange={(e) => commit(moveLayerToGroup(layers, l.id, e.target.value))}
                          className="w-24 shrink-0 rounded border border-slate-700 bg-slate-800 px-1 py-1 text-[11px] text-slate-300"
                          title="Move to group"
                        >
                          {groupNames.map((gn) => (
                            <option key={gn} value={gn}>
                              {gn}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => remove(l.id)}
                          className="shrink-0 rounded bg-slate-800 px-1.5 py-1 text-[10px] text-red-300 hover:bg-red-900"
                          title="Remove layer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addTo(g.name)}
                      className="mt-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-slate-700"
                    >
                      + layer in {g.name}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2">
          <button
            type="button"
            onClick={() => updateLayers(undefined)}
            className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
            title="Clear the custom list and regenerate the built-in floor-wise defaults"
          >
            Reset to defaults
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded bg-emerald-700 px-3 py-1 text-[12px] text-white hover:bg-emerald-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
