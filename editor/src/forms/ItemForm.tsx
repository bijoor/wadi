import type { HouseObject, ItemAsset } from "../schema/houseConfig";
import type { Selection } from "../state/configStore";
import { useConfigStore } from "../state/configStore";
import { Section, TextField, SelectField, ObjectMeasureField } from "./fields";
import { AnchorPicker } from "./AnchorPicker";
import { FURNITURE_CATALOG, furnitureAsset } from "../furniture/catalog";

// Editor for a GLB furniture / decor `item`. Pick the piece from the catalog, then
// place it: X/Y are the plan CENTRE, rotation is yaw in degrees, scale is a uniform
// resize on top of the asset's real-world size.
export function ItemForm({
  obj, selection,
}: {
  obj: Extract<HouseObject, { type: "item" }>;
  selection: Selection;
}) {
  const replace = useConfigStore((s) => s.replaceObject);
  const config = useConfigStore((s) => s.config);
  const patch = (next: Partial<typeof obj>) => replace(selection, { ...obj, ...next });
  const mpatch = (p: Record<string, unknown>) => replace(selection, { ...obj, ...p } as typeof obj);
  const o = obj as unknown as Record<string, unknown>;
  const asset = obj.asset as ItemAsset;
  const [w, h, d] = asset.dimensions;

  const pickAsset = (id: string) => {
    patch({ asset: furnitureAsset(id) });
  };

  // Rooms on this item's floor, for optional room-relative anchoring.
  const floorObjs = (config?.floors?.[selection.floor]?.objects ?? []) as Array<{
    type: string;
    name?: string;
  }>;
  const roomNames = floorObjs
    .filter((x) => x.type === "room" && x.name)
    .map((x) => x.name as string);
  const anchoredTo = obj.anchor_to;

  return (
    <div>
      <Section title="Identity">
        <TextField label="Name" value={obj.name ?? ""} onCommit={(v) => patch({ name: v || undefined })} />
      </Section>
      <Section title="Furniture">
        <SelectField
          label="Piece"
          value={asset.id}
          onChange={pickAsset}
          options={FURNITURE_CATALOG.map((a) => ({
            value: a.id,
            label: a.category ? `${a.name} · ${a.category}` : (a.name ?? a.id),
          }))}
        />
        <div className="mt-1 text-[11px] text-slate-400">
          {asset.name ?? asset.id} — real size {w}×{d} m footprint, {h} m tall.
        </div>
      </Section>
      <Section title="Placement">
        {anchoredTo && (
          <div className="mb-1 rounded bg-slate-900 px-2 py-1 text-[10px] text-slate-400">
            X / Y are derived from <b>{anchoredTo}</b> while anchored (below).
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-2">
          <ObjectMeasureField object={o} field="x" label="X" hint="plan centre" patch={mpatch} />
          <ObjectMeasureField object={o} field="y" label="Y" hint="plan centre" patch={mpatch} />
          <ObjectMeasureField object={o} field="rotation" label="Rotation" patch={mpatch} allowEmpty hint="yaw, degrees" />
          <ObjectMeasureField object={o} field="scale" label="Scale" patch={mpatch} allowEmpty min={0.01} hint="uniform, 1 = real size" />
          <ObjectMeasureField object={o} field="z_offset" label="Z offset" patch={mpatch} allowEmpty hint="above floor (blank → on the floor)" />
        </div>
      </Section>
      <Section title="Anchor to a room (optional)">
        <div className="mb-1 text-[11px] text-slate-400">
          For a free piece that should still follow a room's size (e.g. verandah furniture).
          Most in-room furniture is better added under the room's own <b>Furniture</b> section.
        </div>
        <SelectField
          label="Anchor to room"
          value={anchoredTo ?? ""}
          onChange={(v) => patch({ anchor_to: v || undefined })}
          options={[
            { value: "", label: "— none (absolute X/Y) —" },
            ...roomNames.map((n) => ({ value: n, label: n })),
          ]}
        />
        {anchoredTo && (
          <div className="mt-1 flex gap-3">
            <AnchorPicker label="Anchor" value={obj.anchor} onChange={(a) => patch({ anchor: a as typeof obj.anchor })} />
            <div className="grid flex-1 grid-cols-2 gap-x-2">
              <ObjectMeasureField object={o} field="gap_x" label="Gap X" patch={mpatch} allowEmpty hint="off wall (east+)" />
              <ObjectMeasureField object={o} field="gap_y" label="Gap Y" patch={mpatch} allowEmpty hint="off wall (south+)" />
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
