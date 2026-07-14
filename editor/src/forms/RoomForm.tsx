import { Fragment } from "react";
import type { Room, Opening, Side } from "../schema/houseConfig";
import type { Selection } from "../state/configStore";
import { useConfigStore } from "../state/configStore";
import { NumberField, TextField, Section, SelectField } from "./fields";

const SIDES: Side[] = ["north", "south", "east", "west"];
const KINDS = [
  { value: "door" as const, label: "Door" },
  { value: "window" as const, label: "Window" },
];

// Rebinds room.walls[side].openings via replaceObject. All edits go
// through the store's replaceObject so undo/redo capture the whole
// prev/next snapshot.
export function RoomForm({ room, selection }: { room: Room; selection: Selection }) {
  const replace = useConfigStore((s) => s.replaceObject);

  const patch = (next: Partial<Room>) => replace(selection, { ...room, ...next });

  // Normalize walls to the nested-dict form for editing. On save we keep
  // the same shape the user provided (either list or dict) — but when
  // the user starts adding openings we must switch to dict form.
  //
  // Key semantic: when `room.walls` is absent from the config the
  // renderer draws ALL FOUR walls by default. Showing all checkboxes
  // unchecked in that case is misleading — the checkboxes wouldn't
  // match what the user sees. So when walls is undefined we start from
  // {N, S, E, W} implicitly-on; the first unchecking promotes the
  // config to an explicit dict of the remaining sides.
  const wallsExplicit = room.walls !== undefined;
  const wallsAsDict = wallsExplicit
    ? normalizeToDict(room.walls)
    : ({ north: {}, south: {}, east: {}, west: {} } as Record<
        Side,
        { height?: number; openings?: Opening[] } | undefined
      >);

  const setSideConfig = (
    side: Side,
    nextSide: { height?: number; openings?: Opening[] } | undefined,
  ) => {
    const dict = { ...wallsAsDict };
    if (nextSide === undefined || (!nextSide.height && !nextSide.openings?.length)) {
      // Empty side — keep the entry so the wall still gets rendered,
      // but strip openings.
      if (nextSide === undefined) {
        delete dict[side];
      } else {
        dict[side] = nextSide;
      }
    } else {
      dict[side] = nextSide;
    }
    replace(selection, { ...room, walls: dict });
  };

  const addOpening = (side: Side, kind: "door" | "window") => {
    const cur = wallsAsDict[side] ?? {};
    const openings = [...(cur.openings ?? [])];
    const width = kind === "door" ? 30 : 40;
    // Compute a default offset that doesn't overlap any existing
    // opening on this wall. Wall length depends on which side we're
    // on — north/south run along room.width, east/west run along
    // room.length. Fall back to placing the new opening right after
    // the rightmost existing edge (+ 1u gap) so users don't have to
    // manually re-shuffle. If it wouldn't fit, drop to offset 0
    // anyway and let the validator surface the issue.
    const wallLen = (side === "north" || side === "south")
      ? Number(room.width)
      : Number(room.length);
    const rightmostEnd = openings.reduce(
      (m, o) => Math.max(m, Number(o.offset) + Number(o.width)),
      0,
    );
    let offset = 0;
    if (openings.length > 0 && rightmostEnd + 1 + width <= wallLen) {
      offset = rightmostEnd + 1;
    } else if (openings.length > 0) {
      // No room after the last opening — try before the first one.
      const leftmostStart = openings.reduce(
        (m, o) => Math.min(m, Number(o.offset)),
        Number.POSITIVE_INFINITY,
      );
      if (leftmostStart >= width + 1) offset = 0;
      // else leave at 0 — the validator will complain; user can nudge.
    }
    openings.push({
      kind,
      offset,
      width,
      height: kind === "door" ? 65 : 40,
      ...(kind === "window" ? { sill_height: 25 } : {}),
    });
    setSideConfig(side, { ...cur, openings });
  };

  const updateOpening = (side: Side, index: number, next: Partial<Opening>) => {
    const cur = wallsAsDict[side] ?? {};
    const openings = [...(cur.openings ?? [])];
    openings[index] = { ...openings[index], ...next };
    setSideConfig(side, { ...cur, openings });
  };

  const deleteOpening = (side: Side, index: number) => {
    const cur = wallsAsDict[side] ?? {};
    const openings = (cur.openings ?? []).filter((_, i) => i !== index);
    setSideConfig(side, { ...cur, openings });
  };

  const toggleSide = (side: Side, on: boolean) => {
    const dict = { ...wallsAsDict };
    if (on) {
      if (!(side in dict)) dict[side] = {};
    } else {
      delete dict[side];
    }
    replace(selection, { ...room, walls: dict });
  };

  return (
    <div>
      <Section title="Identity">
        <TextField
          label="Name"
          value={room.name}
          onCommit={(v) => patch({ name: v })}
        />
        <TextField
          label="Material"
          value={room.material}
          onCommit={(v) => patch({ material: v || undefined })}
          hint="palette key from GLOBAL_CONFIG.colors"
        />
      </Section>

      <Section title="Position & size">
        <div className="grid grid-cols-2 gap-x-2">
          <NumberField label="X" value={room.x} onCommit={(v) => v !== undefined && patch({ x: v })} />
          <NumberField label="Y" value={room.y} onCommit={(v) => v !== undefined && patch({ y: v })} />
          <NumberField label="Width" value={room.width} onCommit={(v) => v !== undefined && patch({ width: v })} min={0.01} />
          <NumberField label="Length" value={room.length} onCommit={(v) => v !== undefined && patch({ length: v })} min={0.01} />
          <NumberField label="Height" value={room.height} onCommit={(v) => patch({ height: v && v > 0 ? v : undefined })} allowEmpty hint="optional; defaults to floor" />
        </div>
      </Section>

      <Section title="Walls & openings">
        {!wallsExplicit && (
          <div className="mb-2 rounded border border-slate-800 bg-slate-950/40 p-2 text-[11px] text-slate-400">
            All four walls are on by default. Unticking any wall or
            adding an opening promotes the config to an explicit list.
          </div>
        )}
        {SIDES.map((side) => {
          const cfg = wallsAsDict[side];
          const enabled = cfg !== undefined;
          return (
            <div key={side} className="mb-2 rounded border border-slate-800 bg-slate-950/50 p-2">
              <label className="mb-2 flex items-center gap-2 text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => toggleSide(side, e.target.checked)}
                  className="accent-emerald-500"
                />
                <span className="capitalize">{side} wall</span>
                {enabled && (
                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      onClick={() => addOpening(side, "door")}
                      className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
                    >
                      + Door
                    </button>
                    <button
                      type="button"
                      onClick={() => addOpening(side, "window")}
                      className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
                    >
                      + Window
                    </button>
                  </div>
                )}
              </label>

              {enabled && (
                <Fragment>
                  <NumberField
                    label="Wall height override"
                    value={cfg.height}
                    onCommit={(v) => setSideConfig(side, { ...cfg, height: v })}
                    allowEmpty
                    hint="blank ⇒ use floor height"
                  />
                  {(cfg.openings ?? []).map((op, i) => (
                    <OpeningRow
                      key={i}
                      side={side}
                      wallLength={
                        side === "north" || side === "south" ? room.width : room.length
                      }
                      opening={op}
                      onChange={(next) => updateOpening(side, i, next)}
                      onDelete={() => deleteOpening(side, i)}
                    />
                  ))}
                </Fragment>
              )}
            </div>
          );
        })}
      </Section>
    </div>
  );
}

function OpeningRow({
  side,
  wallLength,
  opening,
  onChange,
  onDelete,
}: {
  side: Side;
  wallLength: number;
  opening: Opening;
  onChange: (next: Partial<Opening>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="mb-1 rounded bg-slate-900 p-2">
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
        <span>
          <span className="capitalize">{opening.kind}</span>
          {opening.name ? ` · ${opening.name}` : ""}
        </span>
        <button
          type="button"
          onClick={onDelete}
          className="rounded bg-slate-800 px-1 py-0.5 text-[10px] text-red-300 hover:bg-red-900"
        >
          Delete
        </button>
      </div>
      <TextField label="Name" value={opening.name} onCommit={(v) => onChange({ name: v || undefined })} />
      <SelectField
        label="Kind"
        value={opening.kind}
        onChange={(v) => onChange({ kind: v })}
        options={KINDS}
      />
      <div className="grid grid-cols-2 gap-x-2">
        <NumberField
          label="Offset"
          value={opening.offset}
          onCommit={(v) => v !== undefined && onChange({ offset: v })}
          min={0}
          max={wallLength}
          hint={`along wall (0..${wallLength})`}
        />
        <NumberField
          label="Width"
          value={opening.width}
          onCommit={(v) => v !== undefined && onChange({ width: v })}
          min={0.01}
        />
        <NumberField
          label="Height"
          value={opening.height}
          onCommit={(v) => v !== undefined && onChange({ height: v })}
          min={0.01}
        />
        {opening.kind === "window" && (
          <NumberField
            label="Sill height"
            value={opening.sill_height}
            onCommit={(v) => onChange({ sill_height: v })}
            min={0}
            allowEmpty
          />
        )}
      </div>
      <SelectField
        label="Direction override"
        hint={`default: ${side}`}
        value={opening.direction ?? side}
        onChange={(v) => onChange({ direction: v as Side })}
        options={SIDES.map((s) => ({ value: s, label: s }))}
      />
    </div>
  );
}

function normalizeToDict(walls: Room["walls"]): Record<Side, { height?: number; openings?: Opening[] } | undefined> {
  const out: Record<string, { height?: number; openings?: Opening[] } | undefined> = {};
  if (Array.isArray(walls)) {
    for (const s of walls) out[s] = {};
  } else if (walls && typeof walls === "object") {
    for (const [s, cfg] of Object.entries(walls)) {
      out[s] = { height: cfg?.height, openings: cfg?.openings };
    }
  }
  return out as Record<Side, { height?: number; openings?: Opening[] } | undefined>;
}
