import { Suspense } from "react";
import { useConfigStore, selectSelectedObject, type Selection } from "../state/configStore";
import type { HouseObject, HouseConfig } from "../schema/houseConfig";
import { effectiveLayers } from "../three/layers";
import { validate } from "../schema/houseConfig";
import { RoomForm } from "../forms/RoomForm";
import { WallForm } from "../forms/WallForm";
import { EnabledField } from "../forms/fields";
import {
  BeamForm,
  FloorSlabForm,
  PlinthForm,
  GroundForm,
  FlatDoorWindowForm,
  PillarForm,
  StaircaseForm,
} from "../forms/simpleForms";
import { RoofV2Form } from "../forms/RoofV2Form";
import { KitchenPlatformForm } from "../forms/KitchenPlatformForm";
import { ComponentForm } from "../forms/ComponentForm";
import { getNode } from "../registry/registry";
import { HouseSettingsForm } from "../forms/HouseSettingsForm";
import { FloorPropertiesForm } from "../forms/FloorPropertiesForm";
import { useEffect, useRef, useState } from "react";
import { scopeForConfig } from "../param/resolve";

function objectDisplayName(obj: HouseObject): string | null {
  const name = (obj as { name?: unknown }).name;
  return typeof name === "string" && name.length > 0 ? name : null;
}

export function PropertyPanel() {
  const selectedObject = useConfigStore(selectSelectedObject);
  const selection = useConfigStore((s) => s.selection);
  const siteEditorOpen = useConfigStore((s) => s.siteEditorOpen);
  const floorEditorIdx = useConfigStore((s) => s.floorEditorIdx);
  const config = useConfigStore((s) => s.config);
  const validationErrors = useConfigStore((s) => s.validationErrors);
  const setValidationErrors = useConfigStore((s) => s.setValidationErrors);
  const deleteObject = useConfigStore((s) => s.deleteObject);
  const duplicateObject = useConfigStore((s) => s.duplicateObject);
  const updateObject = useConfigStore((s) => s.updateObject);
  const [refOpen, setRefOpen] = useState(false);

  const cfgRefs = config as {
    variables?: Record<string, number | string>;
    points?: Record<string, { x: number | string; y: number | string }>;
  } | null;
  const hasRefs =
    !!cfgRefs &&
    (Object.keys(cfgRefs.variables ?? {}).length > 0 ||
      Object.keys(cfgRefs.points ?? {}).length > 0);

  // Re-validate on every config change so the top-bar's "✓ valid" /
  // "✗ N errors" tag stays live as the user edits.
  useEffect(() => {
    if (!config) return;
    const result = validate(config);
    setValidationErrors(result.ok ? [] : result.errors ?? []);
  }, [config, setValidationErrors]);

  return (
    <aside className="flex w-96 flex-col border-l border-slate-800 bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400">
        <span>Properties</span>
        <div className="flex gap-1">
          {hasRefs && (
            <button
              type="button"
              onClick={() => setRefOpen((o) => !o)}
              className={
                "rounded px-2 py-0.5 text-[10px] font-normal " +
                (refOpen
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-800 text-emerald-300 hover:bg-slate-700")
              }
              title="Show all variables & points you can reference in = formulas"
            >
              ƒx refs
            </button>
          )}
        {selection && (
          <>
            <button
              type="button"
              onClick={() => duplicateObject(selection)}
              className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-normal text-slate-300 hover:bg-slate-700"
              title="Duplicate (⌘/Ctrl+D)"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("Delete this object?")) deleteObject(selection);
              }}
              className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-normal text-red-300 hover:bg-red-900"
              title="Delete (⌫)"
            >
              Delete
            </button>
          </>
        )}
        </div>
      </header>
      {refOpen && hasRefs && (
        <RefPopover config={config} onClose={() => setRefOpen(false)} />
      )}

      {siteEditorOpen ? (
        <div className="flex-1 overflow-y-auto p-3 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
            house
          </div>
          <div className="mb-3 text-base font-medium text-slate-100">
            Site &amp; plinth
          </div>
          <HouseSettingsForm />
        </div>
      ) : floorEditorIdx !== null && config?.floors[floorEditorIdx] ? (
        <div className="flex-1 overflow-y-auto p-3 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
            floor
          </div>
          <div className="mb-3 text-base font-medium text-slate-100">
            {config.floors[floorEditorIdx].name}
          </div>
          <FloorPropertiesForm floorIdx={floorEditorIdx} />
        </div>
      ) : selection && selectedObject ? (
        <div className="flex-1 overflow-y-auto p-3 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
            {selectedObject.type}
          </div>
          <div className="mb-3 text-base font-medium text-slate-100">
            {objectDisplayName(selectedObject) ?? `#${selection.object}`}
          </div>
          <LayerAssignField object={selectedObject} selection={selection} />
          <EnabledField
            object={selectedObject as unknown as Record<string, unknown>}
            patch={(p) => updateObject(selection, p as Partial<HouseObject>)}
          />
          <FormFor object={selectedObject} selection={selection} />
        </div>
      ) : (
        <div className="p-4 text-sm text-slate-500">
          Select an object from the sidebar to edit its properties, or
          click <b>🏠 House settings</b> to edit the site &amp; plinth.
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="border-t border-slate-800 bg-red-950/30 p-3 text-xs">
          <div className="mb-1 font-semibold text-red-300">
            Validation errors
          </div>
          <ul className="space-y-1 text-red-200">
            {validationErrors.slice(0, 10).map((e, i) => (
              <li key={i} className="font-mono">
                /{e.path}: {e.message}
              </li>
            ))}
            {validationErrors.length > 10 && (
              <li className="text-red-300">
                … and {validationErrors.length - 10} more
              </li>
            )}
          </ul>
        </div>
      )}
    </aside>
  );
}

// Floating, non-modal reference card listing every house variable and point
// (with resolved values) so you can see what's available to reference in
// `= formula` fields without leaving the object editor. Toggled from the
// panel header's "ƒx refs" button.
function RefPopover({
  config,
  onClose,
}: {
  config: HouseConfig | null;
  onClose: () => void;
}) {
  const scope = scopeForConfig(config);
  const c = config as {
    variables?: Record<string, number | string>;
    points?: Record<string, { x: number | string; y: number | string }>;
  } | null;
  const vars = Object.entries(c?.variables ?? {});
  const points = Object.entries(c?.points ?? {});

  const fmt = (v: number | undefined) =>
    v === undefined || !Number.isFinite(v)
      ? "⚠"
      : Number.isInteger(v)
        ? String(v)
        : String(Math.round(v * 1000) / 1000);
  const isFormula = (v: unknown) =>
    typeof v === "string" && v.trimStart().startsWith("=");

  const [min, setMin] = useState(false);
  // Position: null = the default anchor (top of the 3D area, just LEFT of the
  // ~384px properties panel via CSS `right`, so it never covers the fields and
  // needs no window measurement). Dragging the header switches to explicit
  // {x,y} computed from the card's actual on-screen rect.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const onDown = (e: React.MouseEvent) => {
    const card = (e.currentTarget as HTMLElement).parentElement;
    const rect = card?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    const move = (ev: MouseEvent) => {
      if (!drag.current) return;
      setPos({
        x: Math.max(0, ev.clientX - drag.current.dx),
        y: Math.max(0, ev.clientY - drag.current.dy),
      });
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, maxHeight: min ? undefined : "70vh" }
    : { right: "25rem", top: 150, maxHeight: min ? undefined : "70vh" };

  return (
    <div
      className="fixed z-50 flex w-80 flex-col rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
      style={style}
    >
      <div
        className="flex cursor-move select-none items-center justify-between border-b border-slate-800 px-3 py-2"
        onMouseDown={onDown}
        title="Drag to move"
      >
        <span className="text-xs font-semibold text-emerald-300">
          ⠿ Variables &amp; points
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMin((m) => !m)}
            className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] leading-none text-slate-300 hover:bg-slate-700"
            title={min ? "Expand" : "Minimize"}
          >
            {min ? "▢" : "—"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>
      {!min && (
      <div className="overflow-y-auto p-3 text-[11px] text-slate-200">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
          Variables
        </div>
        {vars.length === 0 ? (
          <div className="mb-3 text-slate-500">none</div>
        ) : (
          <table className="mb-3 w-full">
            <tbody>
              {vars.map(([name, val]) => (
                <tr key={name} className="align-top">
                  <td className="pr-2 font-mono text-emerald-300">{name}</td>
                  <td className="pr-2 text-right font-mono text-slate-100">
                    {fmt(scope[name])}
                  </td>
                  <td className="max-w-[8rem] truncate font-mono text-slate-500">
                    {isFormula(val) ? String(val) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
          Points <span className="normal-case">(.x/.w · .y/.l)</span>
        </div>
        {points.length === 0 ? (
          <div className="text-slate-500">none</div>
        ) : (
          <table className="w-full">
            <tbody>
              {points.map(([name]) => (
                <tr key={name} className="align-top">
                  <td className="pr-2 font-mono text-emerald-300">{name}</td>
                  <td className="font-mono text-slate-100">
                    x {fmt(scope[`${name}.x`])} · y {fmt(scope[`${name}.y`])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-3 border-t border-slate-800 pt-2 text-[10px] text-slate-500">
          Use in any coordinate field:{" "}
          <code className="rounded bg-slate-800 px-1">= name</code> or{" "}
          <code className="rounded bg-slate-800 px-1">= P.w</code>. ⚠ = unresolved.
        </div>
      </div>
      )}
    </div>
  );
}

// Shared "Layer" dropdown shown for every object type (above its type
// form). Assigns the object to one of the configured 3D layers; blank =
// "Auto", which falls back to the built-in per-type/floor mapping.
function LayerAssignField({
  object,
  selection,
}: {
  object: HouseObject;
  selection: Selection;
}) {
  const config = useConfigStore((s) => s.config);
  const updateObject = useConfigStore((s) => s.updateObject);
  const layers = effectiveLayers(config);
  const current = (object as { layer?: string }).layer ?? "";
  return (
    <div className="mb-3">
      <label className="mb-0.5 block text-xs font-medium text-slate-300">
        Layer
      </label>
      <select
        value={current}
        onChange={(e) =>
          updateObject(selection, {
            layer: e.target.value || undefined,
          } as Partial<HouseObject>)
        }
        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-emerald-500"
      >
        <option value="">— Auto (by type / floor) —</option>
        {layers.map((l) => (
          <option key={l.id} value={l.id}>
            {l.group ? `${l.group} · ${l.label}` : l.label}
          </option>
        ))}
      </select>
      <div className="mt-0.5 text-[10px] text-slate-500">
        Which 3D layer this object toggles with. Manage the list in{" "}
        <b>🏠 House settings → Layers</b>.
      </div>
    </div>
  );
}

function FormFor({ object, selection }: { object: HouseObject; selection: Selection }) {
  // Registry-driven types (item, + future ports) bring their own editor. The form
  // is loaded lazily (keeps the node module importable by the headless 2D engine).
  const def = getNode(object.type);
  if (def?.Form) {
    const NodeForm = def.Form;
    return (
      <Suspense fallback={<div className="text-xs text-slate-500">Loading…</div>}>
        <NodeForm obj={object} selection={selection} />
      </Suspense>
    );
  }
  switch (object.type) {
    case "component":
      return <ComponentForm obj={object} selection={selection} />;
    case "plinth":
      return <PlinthForm obj={object} selection={selection} />;
    case "ground":
      return <GroundForm obj={object} selection={selection} />;
    case "room":
      return <RoomForm room={object} selection={selection} />;
    case "wall":
      return <WallForm wall={object} selection={selection} />;
    case "pillar":
      return <PillarForm obj={object} selection={selection} />;
    case "beam":
      return <BeamForm obj={object} selection={selection} />;
    case "floor_slab":
      return <FloorSlabForm obj={object} selection={selection} />;
    case "staircase":
      return <StaircaseForm obj={object} selection={selection} />;
    case "door":
    case "window":
      return <FlatDoorWindowForm obj={object} selection={selection} />;
    case "roof":
      return <RoofV2Form obj={object} selection={selection} />;
    case "kitchen_platform":
      return <KitchenPlatformForm obj={object} selection={selection} />;
    default:
      return (
        <div className="text-xs text-slate-500">
          No editor for type <code>{(object as { type: string }).type}</code>.
        </div>
      );
  }
}
