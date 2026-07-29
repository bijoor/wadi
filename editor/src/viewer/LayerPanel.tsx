// Layer visibility checkboxes for the viewer's 3D tab. Reads DEFAULT_LAYERS
// + the shared useLayerStore from the editor's three/layers module, so
// toggling here has the exact same effect as toggling the editor's own
// layer panel — House3D subscribes to the store and re-renders visible
// meshes accordingly.
//
// Rendered into #viewer-layer-list by mount3D.tsx. The surrounding
// #viewer-layer-panel div + CSS live in the viewer's HTML shell.

import { useMemo } from "react";
import { effectiveLayers, useLayerStore } from "../three/layers";
import { useConfigStore } from "../state/configStore";
import { useLayersUiStore } from "../state/layersUiStore";

export function ViewerLayerPanel() {
  // Layer list derived from the config (same helper the 3D scene uses), so
  // adding/removing layers or reassigning objects updates the menu live.
  const config = useConfigStore((s) => s.config);
  const layers = useMemo(() => effectiveLayers(config), [config]);
  const visible = useLayerStore((s) => s.visible);
  const toggle = useLayerStore((s) => s.toggle);

  if (layers.length === 0) {
    return <div style={{ fontSize: "0.8rem", color: "#888" }}>No layers.</div>;
  }

  return (
    <>
      {layers.map((l) => (
        <label key={l.id}>
          <input
            type="checkbox"
            checked={visible[l.id] !== false}
            onChange={() => toggle(l.id)}
          />
          <span
            className="swatch"
            style={{ backgroundColor: l.color }}
          />
          {l.label}
        </label>
      ))}
      <button
        type="button"
        className="layer-edit-btn"
        onClick={() => useLayersUiStore.getState().setOpen(true)}
        style={{
          marginTop: "0.4rem",
          width: "100%",
          background: "transparent",
          border: "1px solid #d9cfc2",
          borderRadius: "6px",
          padding: "0.25rem 0.4rem",
          fontSize: "0.78rem",
          color: "#B85028",
          cursor: "pointer",
        }}
        title="Edit layer grouping and order"
      >
        ✏️ Edit layers…
      </button>
    </>
  );
}
