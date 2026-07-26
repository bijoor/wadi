import { useEffect, useState } from "react";
import clsx from "clsx";
import { useConfigStore } from "../state/configStore";
import type { HouseObject } from "../schema/houseConfig";
import {
  ADDABLE_TYPES,
  ADDABLE_TYPE_LABEL,
  type AddableObjectType,
} from "../state/defaultFactory";
import { addableNodeTypes, getNode } from "../registry/registry";

// The "+ Add object" menu: legacy per-type entries plus any registry-driven node
// types (item, + future ports) that aren't already listed — so a new registry node
// appears in the menu with no edit here.
function addMenuOptions(): { value: string; label: string }[] {
  const legacy = ADDABLE_TYPES.map((t) => ({ value: t as string, label: ADDABLE_TYPE_LABEL[t] }));
  const seen = new Set(ADDABLE_TYPES as string[]);
  const extra = addableNodeTypes()
    .filter((t) => !seen.has(t))
    .map((t) => ({ value: t, label: getNode(t)?.label ?? t }));
  return [...legacy, ...extra];
}

// Order used to group the object tree so it's easier to scan by category.
const TYPE_ORDER: HouseObject["type"][] = [
  "component",
  "item",
  "ground",
  "plinth",
  "floor_slab",
  "beam",
  "pillar",
  "room",
  "wall",
  "staircase",
  "door",
  "window",
  "kitchen_platform",
  "roof",
  "hip_roof",
  "gable_roof",
  "flat_roof",
  "shed_roof",
];

const TYPE_LABEL: Record<HouseObject["type"], string> = {
  component: "Components",
  item: "Furniture",
  ground: "Ground",
  plinth: "Plinth",
  floor_slab: "Floor slabs",
  beam: "Beams",
  pillar: "Pillars",
  room: "Rooms",
  wall: "Walls",
  staircase: "Staircases",
  door: "Doors (flat)",
  window: "Windows (flat)",
  kitchen_platform: "Kitchen platforms",
  roof: "Roofs (v2)",
  hip_roof: "Hip roofs (legacy)",
  gable_roof: "Gable roofs (legacy)",
  flat_roof: "Flat roofs (legacy)",
  shed_roof: "Shed roofs (legacy)",
};

function objectLabel(obj: HouseObject, index: number): string {
  const named = obj as { name?: string };
  return named.name ?? `${obj.type} #${index}`;
}

export function Sidebar() {
  const config = useConfigStore((s) => s.config);
  const selection = useConfigStore((s) => s.selection);
  const select = useConfigStore((s) => s.select);
  const siteEditorOpen = useConfigStore((s) => s.siteEditorOpen);
  const setSiteEditorOpen = useConfigStore((s) => s.setSiteEditorOpen);
  const floorEditorIdx = useConfigStore((s) => s.floorEditorIdx);
  const setFloorEditor = useConfigStore((s) => s.setFloorEditor);
  const addObject = useConfigStore((s) => s.addObject);
  const addFloor = useConfigStore((s) => s.addFloor);
  const moveFloor = useConfigStore((s) => s.moveFloor);
  const [activeFloor, setActiveFloor] = useState(0);

  // If the config change reduced the floor count (e.g. loading a
  // 2-floor template while we were on floor 2 of a 3-floor config),
  // clamp the active floor into range before render.
  useEffect(() => {
    const count = config?.floors?.length ?? 0;
    if (count > 0 && activeFloor >= count) {
      setActiveFloor(0);
    }
  }, [config, activeFloor]);

  if (!config) {
    return (
      <aside className="flex w-72 flex-col border-r border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        Load a <code className="rounded bg-slate-800 px-1">house_config.json</code>{" "}
        to begin.
      </aside>
    );
  }

  // Clamp on read too — the useEffect above resolves the mismatch on
  // the next render, but this pass still executes with the stale index
  // and would crash on `floor.objects` without a guard.
  const safeFloorIdx = Math.min(activeFloor, config.floors.length - 1);
  const floor = config.floors[safeFloorIdx];
  const grouped = new Map<HouseObject["type"], { obj: HouseObject; idx: number }[]>();
  (floor?.objects ?? []).forEach((obj, idx) => {
    const bucket = grouped.get(obj.type) ?? [];
    bucket.push({ obj, idx });
    grouped.set(obj.type, bucket);
  });

  return (
    <aside className="flex w-72 flex-col border-r border-slate-800 bg-slate-900">
      {/* House-level settings button — sits above the floor tabs so it's
          always reachable regardless of which floor is active. Clicking
          swaps the PropertyPanel to the site/plinth form and clears any
          object selection. */}
      <button
        type="button"
        onClick={() => setSiteEditorOpen(!siteEditorOpen)}
        className={clsx(
          "border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold",
          siteEditorOpen
            ? "bg-emerald-600/30 text-emerald-200"
            : "text-slate-300 hover:bg-slate-800",
        )}
        title="Edit site + plinth (top-level house settings)"
      >
        🏠 House settings
      </button>
      <nav className="flex border-b border-slate-800">
        {config.floors.map((f, i) => (
          <button
            key={f.floor_number}
            type="button"
            onClick={() => setActiveFloor(i)}
            className={clsx(
              "flex-1 border-r border-slate-800 px-2 py-2 text-xs last:border-r-0",
              i === safeFloorIdx
                ? "bg-slate-800 text-slate-100"
                : "text-slate-400 hover:bg-slate-800/50",
            )}
          >
            {f.name.replace(/floor/i, "").trim() || `Floor ${f.floor_number}`}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const newIdx = addFloor();
            if (newIdx !== null) setActiveFloor(newIdx);
          }}
          className="border-r border-slate-800 px-2 py-2 text-xs text-emerald-300 hover:bg-slate-800/50 last:border-r-0"
          title="Add floor"
        >
          + Floor
        </button>
      </nav>

      {/* Reorder the active floor in the vertical stack. Stacking is purely
          array order (0 = bottom), so this restacks the model — e.g. move a
          newly-added Plinth floor below the ground floor. */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-1.5 text-[11px] text-slate-400">
        <span>Stack position:</span>
        <button
          type="button"
          disabled={safeFloorIdx <= 0}
          onClick={() => {
            const newIdx = moveFloor(safeFloorIdx, -1);
            if (newIdx !== null) setActiveFloor(newIdx);
          }}
          className="rounded border border-slate-700 px-1.5 py-0.5 enabled:hover:bg-slate-800 disabled:opacity-30"
          title="Move this floor DOWN the stack (toward the ground)"
        >
          ⬇ Move down
        </button>
        <button
          type="button"
          disabled={safeFloorIdx >= config.floors.length - 1}
          onClick={() => {
            const newIdx = moveFloor(safeFloorIdx, +1);
            if (newIdx !== null) setActiveFloor(newIdx);
          }}
          className="rounded border border-slate-700 px-1.5 py-0.5 enabled:hover:bg-slate-800 disabled:opacity-30"
          title="Move this floor UP the stack"
        >
          ⬆ Move up
        </button>
      </div>

      {/* Floor-level settings button — edits the active floor's name /
          height / slab_thickness. Highlights when open. */}
      <button
        type="button"
        onClick={() =>
          setFloorEditor(floorEditorIdx === safeFloorIdx ? null : safeFloorIdx)
        }
        className={clsx(
          "border-b border-slate-800 px-3 py-1.5 text-left text-xs",
          floorEditorIdx === safeFloorIdx
            ? "bg-emerald-600/30 text-emerald-200"
            : "text-slate-400 hover:bg-slate-800",
        )}
        title="Edit this floor's name, wall height, and slab thickness"
      >
        ⚙ Floor settings
      </button>

      {/* Add-object dropdown — picking a type inserts a default object
          of that type on the current floor and selects it. Reset the
          select back to the placeholder after each pick so the same
          type can be added twice in a row. */}
      <div className="border-b border-slate-800 px-2 py-2">
        <select
          value=""
          onChange={(e) => {
            const t = e.target.value as AddableObjectType | "";
            if (!t) return;
            addObject(safeFloorIdx, t);
            e.target.value = "";
          }}
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
          aria-label="Add object"
        >
          <option value="">+ Add object…</option>
          {addMenuOptions().map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-2 text-sm">
        {TYPE_ORDER.filter((t) => grouped.has(t)).map((type) => (
          <details key={type} open className="mb-1">
            <summary className="cursor-pointer rounded px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-800">
              {TYPE_LABEL[type]} · {grouped.get(type)!.length}
            </summary>
            <ul className="ml-2 border-l border-slate-800">
              {grouped.get(type)!.map(({ obj, idx }) => {
                const isSelected =
                  selection?.floor === safeFloorIdx && selection?.object === idx;
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => select({ floor: safeFloorIdx, object: idx })}
                      className={clsx(
                        "block w-full truncate px-2 py-1 text-left text-xs",
                        isSelected
                          ? "bg-emerald-600/30 text-emerald-200"
                          : "text-slate-300 hover:bg-slate-800",
                      )}
                      title={objectLabel(obj, idx)}
                    >
                      {objectLabel(obj, idx)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>
    </aside>
  );
}
