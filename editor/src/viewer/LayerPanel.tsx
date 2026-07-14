// Layer visibility checkboxes for the viewer's 3D tab. Reads DEFAULT_LAYERS
// + the shared useLayerStore from the editor's three/layers module, so
// toggling here has the exact same effect as toggling the editor's own
// layer panel — House3D subscribes to the store and re-renders visible
// meshes accordingly.
//
// Rendered into #viewer-layer-list by mount3D.tsx. The surrounding
// #viewer-layer-panel div + CSS live in the viewer's HTML shell.

import { DEFAULT_LAYERS, useLayerStore } from "../three/layers";

export function ViewerLayerPanel() {
  const visible = useLayerStore((s) => s.visible);
  const toggle = useLayerStore((s) => s.toggle);

  return (
    <>
      {DEFAULT_LAYERS.map((l) => (
        <label key={l.id}>
          <input
            type="checkbox"
            checked={visible[l.id] ?? true}
            onChange={() => toggle(l.id)}
          />
          <span
            className="swatch"
            style={{ backgroundColor: l.color }}
          />
          {l.label}
        </label>
      ))}
    </>
  );
}
