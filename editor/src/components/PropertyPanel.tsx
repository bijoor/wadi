import { useConfigStore, selectSelectedObject, type Selection } from "../state/configStore";
import type { HouseObject } from "../schema/houseConfig";
import { validate } from "../schema/houseConfig";
import { RoomForm } from "../forms/RoomForm";
import { WallForm } from "../forms/WallForm";
import {
  BeamForm,
  FloorSlabForm,
  FlatDoorWindowForm,
  OpaqueRoofForm,
  PillarForm,
  StaircaseForm,
} from "../forms/simpleForms";
import { HipRoofForm } from "../forms/HipRoofForm";
import { GableRoofForm } from "../forms/GableRoofForm";
import { HouseSettingsForm } from "../forms/HouseSettingsForm";
import { FloorPropertiesForm } from "../forms/FloorPropertiesForm";
import { useEffect } from "react";

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
        {selection && (
          <div className="flex gap-1">
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
          </div>
        )}
      </header>

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

function FormFor({ object, selection }: { object: HouseObject; selection: Selection }) {
  switch (object.type) {
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
    case "hip_roof":
      return <HipRoofForm obj={object} selection={selection} />;
    case "gable_roof":
      return <GableRoofForm obj={object} selection={selection} />;
    default:
      return (
        <div className="text-xs text-slate-500">
          No editor for type <code>{(object as { type: string }).type}</code>.
        </div>
      );
  }
}
