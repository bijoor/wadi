// Structured form for v2 unified roofs (type: "roof").
//
// Covers the RoofConfig shape from svg2d/roof/v2/model.ts:
//   - roof_type (flat / shed / pitched)
//   - roof-level slope (by height OR by angle)
//   - min_overhang, default_endpoint
//   - flat extras: slab_thickness, parapet_height, parapet_thickness
//   - segments list with add/remove/edit — each segment has:
//       start [x,y], end [x,y], width
//       (pitched) start_endpoint / end_endpoint override
//       (pitched-closed) hip_setback_start / hip_setback_end
//       (pitched-open) gable_overhang_start / gable_overhang_end
//       (shed) shed_high_side
//   - per-segment truss positions (pitched only)
//
// Unknown keys survive the schema's catchall(z.unknown()).

import type { HouseObject } from "../schema/houseConfig";
import type { Selection } from "../state/configStore";
import { useConfigStore } from "../state/configStore";
import { NumberField, SelectField, Section, TextField, ObjectMeasureField, MeasureField } from "./fields";
import { formulaFieldError } from "../param/resolve";
import { isLeafEndpoint, resolveEndpoints } from "../svg2d/roof/v2/segments";
import type { RoofSegment } from "../svg2d/roof/v2/model";

type RoofV2 = Extract<HouseObject, { type: "roof" }>;
type Bag = Record<string, unknown>;

function setPath(obj: Bag, path: (string | number)[], value: unknown): Bag {
  if (path.length === 0) return obj;
  const [head, ...rest] = path;
  if (typeof head === "number") {
    const arr = Array.isArray(obj) ? [...(obj as unknown as unknown[])] : [];
    if (rest.length === 0) {
      if (value === undefined) arr.splice(head, 1);
      else arr[head] = value;
    } else {
      const child = (arr[head] as Bag | undefined) ?? {};
      arr[head] = setPath(child, rest, value);
    }
    return arr as unknown as Bag;
  }
  if (rest.length === 0) {
    if (value === undefined) {
      const next = { ...obj };
      delete next[head];
      return next;
    }
    return { ...obj, [head]: value };
  }
  const child = (obj[head] as Bag | undefined) ?? {};
  return { ...obj, [head]: setPath(child, rest, value) };
}

function get<T>(obj: unknown, path: (string | number)[]): T | undefined {
  let cur: unknown = obj;
  for (const p of path) {
    if (cur == null) return undefined;
    if (typeof p === "number") {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[p];
    } else {
      if (typeof cur !== "object") return undefined;
      cur = (cur as Bag)[p];
    }
  }
  return cur as T | undefined;
}

export function RoofV2Form({
  obj,
  selection,
}: {
  obj: RoofV2;
  selection: Selection;
}) {
  const replace = useConfigStore((s) => s.replaceObject);
  const bag = obj as unknown as Bag;

  const setAt = (path: (string | number)[], value: unknown) => {
    const next = setPath(bag, path, value);
    replace(selection, next as unknown as RoofV2);
  };

  // Formula-aware patches for ObjectMeasureField: it emits `{ field: value,
  // formulas }` (or just `{ formulas }`), which we merge into the target
  // container in ONE write so the value and its formula stay consistent.
  const patchRoof = (p: Record<string, unknown>) =>
    replace(selection, { ...bag, ...p } as unknown as RoofV2);
  const patchSlope = (p: Record<string, unknown>) => {
    const slope = (get<Bag>(bag, ["slope"]) ?? {}) as Record<string, unknown>;
    setAt(["slope"], { ...slope, ...p });
  };
  // Per-side (asymmetric gable) slope patches. Exposed as ANGLE only. Clearing
  // the field removes the whole side (so a half-set pair falls back to symmetric).
  const patchSlopeSide = (side: "slope_left" | "slope_right") =>
    (p: Record<string, unknown>) => {
      const cur = (get<Bag>(bag, [side]) ?? {}) as Record<string, unknown>;
      const next = { ...cur, by: "angle", ...p } as Record<string, unknown>;
      const hasVal = next.angle_deg !== undefined && next.angle_deg !== null;
      const fm = next.formulas as Record<string, unknown> | undefined;
      const hasFormula = !!fm && Object.keys(fm).length > 0;
      setAt([side], hasVal || hasFormula ? next : undefined);
    };

  const roofType = (get<string>(bag, ["roof_type"]) as
    | "flat" | "shed" | "pitched" | undefined) ?? "pitched";
  const segments = (get<Bag[]>(bag, ["segments"]) ?? []) as Bag[];
  const slopeBy = (get<string>(bag, ["slope", "by"]) as
    | "height" | "angle" | undefined) ?? "height";

  return (
    <div>
      <Section title="Roof">
        <TextField
          label="Name"
          hint="Shown in the object tree. Optional."
          value={(get<string>(bag, ["name"]) as string | undefined) ?? ""}
          onCommit={(v) => setAt(["name"], v || undefined)}
        />
        <NumberField
          label="Z offset"
          value={get<number>(bag, ["z_offset"]) as number | undefined}
          onCommit={(v) => setAt(["z_offset"], v)}
          allowEmpty
          hint="lift roof above wall top (10u=1ft); blank = 0"
        />
      </Section>

      <Section title="Roof type">
        <SelectField
          label="Roof type"
          value={roofType}
          onChange={(v) => setAt(["roof_type"], v)}
          options={[
            { value: "pitched", label: "Pitched (gable + hip + dutch)" },
            { value: "flat", label: "Flat" },
            { value: "shed", label: "Shed (mono-pitch)" },
          ]}
          hint="Unified type — per-endpoint styles distinguish gable vs hip vs dutch."
        />
      </Section>

      <Section title="Slope">
        <SelectField
          label="Slope spec by"
          value={slopeBy}
          onChange={(v) => {
            const other = v === "height" ? "angle_deg" : "ridge_h";
            const newKey = v === "height" ? "ridge_h" : "angle_deg";
            // Migrate existing value if user flips the picker.
            const cur = get<number>(bag, ["slope", other]);
            const next = { by: v, [newKey]: cur ?? (v === "height" ? 50 : 20) };
            setAt(["slope"], next);
          }}
          options={[
            { value: "height", label: "Height (ridge_h in units)" },
            { value: "angle", label: "Angle (degrees)" },
          ]}
        />
        {slopeBy === "height" ? (
          <ObjectMeasureField
            object={(get<Bag>(bag, ["slope"]) ?? {}) as Record<string, unknown>}
            field="ridge_h"
            label="Ridge height"
            hint="Rise above wall_top. 10 units = 1 ft."
            patch={patchSlope}
            min={1} suffix="u"
          />
        ) : (
          <ObjectMeasureField
            object={(get<Bag>(bag, ["slope"]) ?? {}) as Record<string, unknown>}
            field="angle_deg"
            label="Pitch angle"
            patch={patchSlope}
            min={1} max={89} suffix="°"
          />
        )}
        <ObjectMeasureField
          object={bag as Record<string, unknown>}
          field="min_overhang"
          label="Min overhang"
          hint="Eave overhang past the wall. 10 u = 1 ft."
          patch={patchRoof}
          min={0} suffix="u"
        />
      </Section>

      {roofType === "pitched" && (
        <Section title="Pitched roof options">
          <SelectField
            label="Default endpoint style"
            hint='"closed" = pure hip. "open" = pure gable. Segments can override per-endpoint.'
            value={(get<string>(bag, ["default_endpoint"]) as "open" | "closed" | undefined) ?? "closed"}
            onChange={(v) => setAt(["default_endpoint"], v)}
            options={[
              { value: "closed", label: "closed (hip)" },
              { value: "open", label: "open (gable)" },
            ]}
          />
          {/* Asymmetric (saltbox) gable: set BOTH to override the uniform Slope.
              The eaves stay put and the ridge shifts so each side takes its
              angle. left/right by the segment's left normal (as overhang_left/
              right). Best on a single-segment gable (open ends). */}
          <ObjectMeasureField
            object={(get<Bag>(bag, ["slope_left"]) ?? {}) as Record<string, unknown>}
            field="angle_deg"
            label="Left slope angle"
            hint="Asymmetric gable: set BOTH left & right to override Slope. Blank = symmetric."
            patch={patchSlopeSide("slope_left")}
            min={1} max={89} suffix="°" allowEmpty
          />
          <ObjectMeasureField
            object={(get<Bag>(bag, ["slope_right"]) ?? {}) as Record<string, unknown>}
            field="angle_deg"
            label="Right slope angle"
            hint="Blank = symmetric. Both required for an asymmetric ridge."
            patch={patchSlopeSide("slope_right")}
            min={1} max={89} suffix="°" allowEmpty
          />
        </Section>
      )}

      {roofType === "flat" && (
        <Section title="Flat roof options">
          <NumberField
            label="Slab thickness"
            value={get<number>(bag, ["slab_thickness"])}
            onCommit={(n) => setAt(["slab_thickness"], n)}
            min={1} suffix="u"
          />
          <NumberField
            label="Parapet height"
            hint="0 = no parapet."
            value={get<number>(bag, ["parapet_height"])}
            onCommit={(n) => setAt(["parapet_height"], n)}
            min={0} suffix="u"
          />
          <NumberField
            label="Parapet thickness"
            value={get<number>(bag, ["parapet_thickness"])}
            onCommit={(n) => setAt(["parapet_thickness"], n)}
            min={0} suffix="u"
          />
        </Section>
      )}

      <Section title={`Segments (${segments.length})`}>
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            className="rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-600"
            onClick={() => {
              const newSeg: Bag = {
                id: `seg${segments.length}`,
                start: [0, 0],
                end: [100, 0],
                width: 100,
              };
              setAt(["segments"], [...segments, newSeg]);
            }}
          >
            + Add segment
          </button>
        </div>
        {segments.length === 0 && (
          <div className="text-xs text-slate-500">
            No segments — click <strong>+ Add segment</strong> to create one.
          </div>
        )}
        {(() => {
          // Compute leaf/joint status for each segment endpoint by
          // running resolveEndpoints across the whole segment list.
          // Joint endpoints are handled by joint resolution; their
          // per-segment endpoint style is ignored, so we hide the
          // picker there and show a "(joint)" indicator instead.
          const roofSegs: RoofSegment[] = segments.map((s, i) => ({
            id: (get<string>(s, ["id"]) as string | undefined) ?? `seg${i}`,
            start: ((get<number[]>(s, ["start"]) ?? [0, 0]).slice(0, 2)) as [number, number],
            end: ((get<number[]>(s, ["end"]) ?? [0, 0]).slice(0, 2)) as [number, number],
            width: (get<number>(s, ["width"]) as number | undefined) ?? 100,
          }));
          const endpoints = resolveEndpoints(roofSegs);
          return segments.map((seg, i) => {
            const segId = roofSegs[i].id;
            const startIsLeaf = isLeafEndpoint(endpoints, segId, "start");
            const endIsLeaf = isLeafEndpoint(endpoints, segId, "end");
            return (
              <SegmentEditor
                key={i}
                segment={seg}
                index={i}
                roofType={roofType}
                defaultEndpoint={
                  (get<string>(bag, ["default_endpoint"]) as "open" | "closed" | undefined) ??
                  "closed"
                }
                startIsLeaf={startIsLeaf}
                endIsLeaf={endIsLeaf}
                onUpdate={(path, value) => setAt(["segments", i, ...path], value)}
                onPatch={(p) => setAt(["segments", i], { ...(seg as Bag), ...p })}
                onRemove={() => {
                  const next = segments.slice();
                  next.splice(i, 1);
                  setAt(["segments"], next);
                }}
              />
            );
          });
        })()}
      </Section>

      {(roofType === "pitched" || roofType === "shed") && segments.length > 0 && (
        <Section title={`Trusses (${roofType === "shed" ? "mono-pitch" : "fink"})`}>
          {segments.map((seg, i) => (
            <TrussEditor
              key={i}
              segment={seg}
              index={i}
              trusses={(get<Bag[]>(bag, ["trusses"]) ?? []) as Bag[]}
              onSet={(positions, formulas) => {
                const cur = (get<Bag[]>(bag, ["trusses"]) ?? []) as Bag[];
                const segId = get<string>(seg, ["id"]) ?? `seg${i}`;
                const otherEntries = cur.filter((e) => get<string>(e, ["segment_id"]) !== segId);
                // Truss type follows the roof type: pitched → fink,
                // shed → mono_pitch.
                const trussType = roofType === "shed" ? "mono_pitch" : "fink";
                if (positions.length === 0) {
                  setAt(["trusses"], otherEntries.length === 0 ? undefined : otherEntries);
                } else {
                  const entry: Bag = { segment_id: segId, type: trussType, positions_along: positions };
                  if (formulas && Object.keys(formulas).length) entry.formulas = formulas;
                  setAt(["trusses"], [...otherEntries, entry]);
                }
              }}
            />
          ))}
        </Section>
      )}

      <Section title="Framing (member sections)">
        <div className="mb-2 text-[10px] text-slate-500">
          Steel pipe cross-sections in inches (H × W). Empty = use
          default. Sizes drive both the 3D cylinder thickness AND the
          Metal BOM's material spec grouping.
        </div>
        <SectionSizePair
          label="Ridge"
          value={get<[number, number]>(bag, ["framing", "ridge_size_in"])}
          onChange={(v) => setAt(["framing", "ridge_size_in"], v)}
          defaultText="6 × 3"
        />
        <SectionSizePair
          label="Hip (defaults to ridge)"
          value={get<[number, number]>(bag, ["framing", "hip_size_in"])}
          onChange={(v) => setAt(["framing", "hip_size_in"], v)}
          defaultText="= ridge"
        />
        {roofType === "pitched" && (
          <SectionSizePair
            label="Valley (defaults to ridge)"
            value={get<[number, number]>(bag, ["framing", "valley_size_in"])}
            onChange={(v) => setAt(["framing", "valley_size_in"], v)}
            defaultText="= ridge"
          />
        )}
        <SectionSizePair
          label="Ring beam"
          value={get<[number, number]>(bag, ["framing", "ring_beam_size_in"])}
          onChange={(v) => setAt(["framing", "ring_beam_size_in"], v)}
          defaultText="4 × 2"
        />
        <SectionSizePair
          label="Rafter"
          value={get<[number, number]>(bag, ["framing", "rafter_size_in"])}
          onChange={(v) => setAt(["framing", "rafter_size_in"], v)}
          defaultText="2 × 4"
        />
        <SectionSizePair
          label="Purlin"
          value={get<[number, number]>(bag, ["framing", "purlin_size_in"])}
          onChange={(v) => setAt(["framing", "purlin_size_in"], v)}
          defaultText="2 × 1"
        />
        {roofType === "pitched" && (
          <>
            <div className="mt-2 text-[10px] font-semibold text-slate-400">Truss</div>
            <SectionSizePair
              label="Truss chord"
              value={get<[number, number]>(bag, ["framing", "truss", "chord_size_in"])}
              onChange={(v) => setAt(["framing", "truss", "chord_size_in"], v)}
              defaultText="2 × 4"
            />
            <SectionSizePair
              label="Truss web"
              value={get<[number, number]>(bag, ["framing", "truss", "web_size_in"])}
              onChange={(v) => setAt(["framing", "truss", "web_size_in"], v)}
              defaultText="2 × 2"
            />
            <div className="mt-2 text-[10px] font-semibold text-slate-400">Eave border</div>
            <SectionSizePair
              label="Eave L-channel"
              value={get<[number, number]>(bag, ["framing", "eave_L_channel_size_in"])}
              onChange={(v) => setAt(["framing", "eave_L_channel_size_in"], v)}
              defaultText="1 × 1"
            />
            <SectionSizePair
              label="Corner double angle"
              value={get<[number, number]>(bag, ["framing", "corner_double_angle_size_in"])}
              onChange={(v) => setAt(["framing", "corner_double_angle_size_in"], v)}
              defaultText="1 × 1"
            />
            <div className="mt-1 grid grid-cols-2 gap-2">
              <NumberField
                label="Pani patti height (in)"
                hint="Default 6″"
                value={get<number>(bag, ["framing", "pani_patti", "height_in"])}
                onCommit={(n) => setAt(["framing", "pani_patti", "height_in"], n)}
                min={0} suffix="in" allowEmpty
              />
              <NumberField
                label="Pani patti thickness (mm)"
                hint="Default 1.2 mm GI"
                value={get<number>(bag, ["framing", "pani_patti", "thickness_mm"])}
                onCommit={(n) => setAt(["framing", "pani_patti", "thickness_mm"], n)}
                min={0} suffix="mm" allowEmpty
              />
            </div>
          </>
        )}
      </Section>
    </div>
  );
}

// Compact two-input row for a [H, W] section-size pair. Empty →
// clears the override (falls back to DEFAULT_V2_FRAMING).
function SectionSizePair({
  label,
  value,
  onChange,
  defaultText,
}: {
  label: string;
  value: [number, number] | undefined;
  onChange: (v: [number, number] | undefined) => void;
  defaultText: string;
}) {
  const h = value?.[0];
  const w = value?.[1];
  return (
    <div className="mb-1 grid grid-cols-[1fr_auto_auto_auto] items-center gap-1 text-xs">
      <span className="text-slate-300">{label}</span>
      <NumberField
        label="H"
        value={h}
        onCommit={(n) => {
          if (n === undefined && w === undefined) onChange(undefined);
          else onChange([n ?? 0, w ?? 0]);
        }}
        min={0} suffix="in" allowEmpty
      />
      <span className="text-slate-500">×</span>
      <NumberField
        label="W"
        value={w}
        onCommit={(n) => {
          if (n === undefined && h === undefined) onChange(undefined);
          else onChange([h ?? 0, n ?? 0]);
        }}
        min={0} suffix="in" allowEmpty
      />
      {h === undefined && w === undefined && (
        <span className="col-span-4 -mt-1 text-[9px] text-slate-500">Default: {defaultText}</span>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Per-segment editor
// ------------------------------------------------------------------

// A formula-aware editor for one coordinate of a segment's start/end point.
// The point is an [x,y] array, so a formula drives it via the synthetic key
// `start_x`/`start_y`/`end_x`/`end_y` in the segment's `formulas` map (resolved
// into the array by resolveParametric); a plain number writes the array in place.
function SegPointField({
  seg,
  onPatch,
  arrName,
  idx,
  label,
}: {
  seg: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
  arrName: "start" | "end";
  idx: 0 | 1;
  label: string;
}) {
  const config = useConfigStore((s) => s.config);
  const arr = Array.isArray(seg[arrName]) ? (seg[arrName] as number[]) : [0, 0];
  const value = arr[idx];
  const coordKey = `${arrName}_${idx === 0 ? "x" : "y"}`;
  const formulas = seg.formulas as Record<string, string> | undefined;
  const formula = formulas?.[coordKey];
  const formulaError = formulaFieldError(config, formula) ?? undefined;

  const setNumber = (n: number | undefined) => {
    const nextArr = [...arr];
    nextArr[idx] = n ?? 0;
    const nf = { ...(formulas ?? {}) };
    delete nf[coordKey];
    onPatch({ [arrName]: nextArr, formulas: Object.keys(nf).length ? nf : undefined });
  };
  const setFormula = (src: string) =>
    onPatch({ formulas: { ...(formulas ?? {}), [coordKey]: src } });

  return (
    <MeasureField
      label={label}
      value={value}
      formula={formula}
      formulaError={formulaError}
      onCommitNumber={setNumber}
      onCommitFormula={setFormula}
    />
  );
}

function SegmentEditor({
  segment,
  index,
  roofType,
  defaultEndpoint,
  startIsLeaf,
  endIsLeaf,
  onUpdate,
  onPatch,
  onRemove,
}: {
  segment: Bag;
  index: number;
  roofType: "flat" | "shed" | "pitched";
  defaultEndpoint: "open" | "closed";
  startIsLeaf: boolean;
  endIsLeaf: boolean;
  onUpdate: (path: (string | number)[], value: unknown) => void;
  // Merge a partial into the whole segment in one write — used by the
  // formula-aware fields (they emit `{ field, formulas }`).
  onPatch: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const seg = segment as Record<string, unknown>;
  const id = get<string>(segment, ["id"]) ?? `seg${index}`;
  const startStyle =
    (get<string>(segment, ["start_endpoint"]) as "open" | "closed" | undefined) ??
    defaultEndpoint;
  const endStyle =
    (get<string>(segment, ["end_endpoint"]) as "open" | "closed" | undefined) ??
    defaultEndpoint;

  return (
    <div className="mb-3 rounded border border-slate-700 bg-slate-800/50 p-2">
      <div className="mb-2 flex items-center justify-between">
        <TextField
          label="ID"
          value={id}
          onCommit={(v) => onUpdate(["id"], v || `seg${index}`)}
        />
        <button
          type="button"
          className="ml-2 rounded bg-red-800 px-2 py-1 text-[10px] text-white hover:bg-red-700"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SegPointField seg={seg} onPatch={onPatch} arrName="start" idx={0} label="Start X" />
        <SegPointField seg={seg} onPatch={onPatch} arrName="start" idx={1} label="Start Y" />
        <SegPointField seg={seg} onPatch={onPatch} arrName="end" idx={0} label="End X" />
        <SegPointField seg={seg} onPatch={onPatch} arrName="end" idx={1} label="End Y" />
      </div>
      <ObjectMeasureField
        object={seg}
        field="width"
        label="Width (perpendicular)"
        patch={onPatch}
        min={1} suffix="u"
      />
      {roofType === "pitched" && (
        <div className="grid grid-cols-2 gap-2">
          <ObjectMeasureField
            object={seg}
            field="width_left"
            label="Left width (off-centre ridge)"
            hint="Optional. Set BOTH left + right to put the ridge off-centre — the eaves stay at the span edges and the ridge sits at 'left' from the left eave (segment's left normal). Their sum is the span; leave blank for a ridge centred on Width."
            patch={onPatch}
            min={1} suffix="u" allowEmpty
          />
          <ObjectMeasureField
            object={seg}
            field="width_right"
            label="Right width"
            hint="Optional. The run from the ridge to the right eave. Set together with Left width."
            patch={onPatch}
            min={1} suffix="u" allowEmpty
          />
        </div>
      )}
      <ObjectMeasureField
        object={seg}
        field="min_overhang"
        label="Min overhang (segment override)"
        hint="Overrides the roof-level min_overhang for this segment only. Leave blank to inherit."
        patch={onPatch}
        min={0} suffix="u" allowEmpty
      />
      <ObjectMeasureField
        object={seg}
        field="tie_beam_count"
        label="Tie beams (count)"
        hint="Flat wall-top ceiling ties running the segment length, spread evenly across the width. 0 / blank = none."
        patch={onPatch}
        min={0} allowEmpty
      />

      {roofType === "shed" && (
        <SelectField
          label="Shed high side"
          hint="Which side of the segment is the high (ridge) edge."
          value={
            (get<string>(segment, ["shed_high_side"]) as
              | "left" | "right" | undefined) ?? "left"
          }
          onChange={(v) => onUpdate(["shed_high_side"], v)}
          options={[
            { value: "left", label: "left (+90° CCW from direction)" },
            { value: "right", label: "right (-90°)" },
          ]}
        />
      )}

      {roofType === "pitched" && (
        <>
          <div className="mt-2 text-[10px] text-slate-500">
            Endpoint styles apply to <strong>leaf</strong> endpoints only.
            Joint endpoints (shared with another segment) are resolved
            automatically by the joint solver.
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {startIsLeaf ? (
              <SelectField
                label="Start endpoint (leaf)"
                value={startStyle}
                onChange={(v) => onUpdate(["start_endpoint"], v)}
                options={[
                  { value: "closed", label: "closed (hip)" },
                  { value: "open", label: "open (gable)" },
                ]}
              />
            ) : (
              <JointBadge label="Start endpoint" />
            )}
            {endIsLeaf ? (
              <SelectField
                label="End endpoint (leaf)"
                value={endStyle}
                onChange={(v) => onUpdate(["end_endpoint"], v)}
                options={[
                  { value: "closed", label: "closed (hip)" },
                  { value: "open", label: "open (gable)" },
                ]}
              />
            ) : (
              <JointBadge label="End endpoint" />
            )}
            {startIsLeaf && startStyle === "closed" && (
              <>
                <ObjectMeasureField
                  object={seg}
                  field="hip_setback_start"
                  label="Start hip setback"
                  hint="Ridge trim at start end. Default = width/2 (equal-pitch pyramid)."
                  patch={onPatch}
                  min={0} suffix="u" allowEmpty
                />
                <ObjectMeasureField
                  object={seg}
                  field="hip_ridge_extension_start"
                  label="Start ridge vent extension"
                  hint="How far the ridge extends PAST the hip apex (flying ridge for ventilation). Default 0."
                  patch={onPatch}
                  min={0} suffix="u" allowEmpty
                />
              </>
            )}
            {endIsLeaf && endStyle === "closed" && (
              <>
                <ObjectMeasureField
                  object={seg}
                  field="hip_setback_end"
                  label="End hip setback"
                  patch={onPatch}
                  min={0} suffix="u" allowEmpty
                />
                <ObjectMeasureField
                  object={seg}
                  field="hip_ridge_extension_end"
                  label="End ridge vent extension"
                  hint="Default 0."
                  patch={onPatch}
                  min={0} suffix="u" allowEmpty
                />
              </>
            )}
            {startIsLeaf && startStyle === "open" && (
              <ObjectMeasureField
                object={seg}
                field="gable_overhang_start"
                label="Start gable overhang"
                hint="Eave + ridge extension past segment endpoint. Default = min_overhang. Set to 0 to disable."
                patch={onPatch}
                min={0} suffix="u" allowEmpty
              />
            )}
            {endIsLeaf && endStyle === "open" && (
              <ObjectMeasureField
                object={seg}
                field="gable_overhang_end"
                label="End gable overhang"
                hint="Default = min_overhang."
                patch={onPatch}
                min={0} suffix="u" allowEmpty
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Small badge shown in place of the endpoint picker for joint (non-
// leaf) endpoints. Makes it explicit that the endpoint style config
// doesn't apply here — joint resolution handles it.
// ------------------------------------------------------------------

function JointBadge({ label }: { label: string }) {
  return (
    <div className="rounded border border-dashed border-slate-600 bg-slate-800/30 p-2">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="mt-1 text-xs font-semibold text-slate-400">
        joint · auto
      </div>
      <div className="mt-0.5 text-[9px] text-slate-500">
        Shared with another segment. Handled by joint resolver.
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Per-segment truss positions editor
// ------------------------------------------------------------------

function TrussEditor({
  segment,
  index,
  trusses,
  onSet,
}: {
  segment: Bag;
  index: number;
  trusses: Bag[];
  onSet: (positions: number[], formulas?: Record<string, string>) => void;
}) {
  const config = useConfigStore((s) => s.config);
  const segId = get<string>(segment, ["id"]) ?? `seg${index}`;
  const entry = trusses.find((e) => get<string>(e, ["segment_id"]) === segId);
  const positions = (get<number[]>(entry ?? {}, ["positions_along"]) ?? []).slice();
  const formulas = (get<Record<string, string>>(entry ?? {}, ["formulas"]) ?? {});
  const key = (i: number) => `pos${i}`;

  // A plain number for position i: write the value, drop any formula on it.
  const setNumber = (i: number, v: number | undefined) => {
    const next = positions.slice();
    next[i] = v ?? 0;
    const nf = { ...formulas };
    delete nf[key(i)];
    onSet(next, nf);
  };
  const setFormula = (i: number, src: string) => {
    onSet(positions.slice(), { ...formulas, [key(i)]: src });
  };
  // Remove position i and re-index the pos<n> formula keys (drop i, shift the
  // higher ones down) so each formula stays attached to its position.
  const removePos = (i: number) => {
    const next = positions.slice();
    next.splice(i, 1);
    const nf: Record<string, string> = {};
    for (const [k, val] of Object.entries(formulas)) {
      const m = /^pos(\d+)$/.exec(k);
      if (!m) { nf[k] = val; continue; }
      const idx = Number(m[1]);
      if (idx === i) continue;
      nf[key(idx > i ? idx - 1 : idx)] = val;
    }
    onSet(next, nf);
  };
  const addPos = () => {
    const last = positions.length === 0 ? 50 : positions[positions.length - 1] + 50;
    onSet([...positions, last], formulas);
  };

  return (
    <div className="mb-3 rounded border border-slate-700 bg-slate-800/50 p-2">
      <div className="mb-1 text-xs text-slate-400">
        Segment <code>{segId}</code> — {positions.length} truss(es)
      </div>
      {positions.map((p, i) => {
        const f = formulas[key(i)];
        return (
          <div key={i} className="mb-1 flex items-center gap-2">
            <div className="flex-1">
              <MeasureField
                label={`Position ${i + 1} (along)`}
                value={p}
                formula={f}
                formulaError={formulaFieldError(config, f) ?? undefined}
                onCommitNumber={(n) => setNumber(i, n)}
                onCommitFormula={(src) => setFormula(i, src)}
                min={0} suffix="u"
              />
            </div>
            <button
              type="button"
              className="rounded bg-red-800 px-2 py-1 text-[10px] text-white hover:bg-red-700"
              onClick={() => removePos(i)}
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="mt-1 rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-600"
        onClick={addPos}
      >
        + Add truss
      </button>
    </div>
  );
}
